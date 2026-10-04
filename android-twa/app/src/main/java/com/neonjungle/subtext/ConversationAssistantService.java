package com.neonjungle.subtext;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * User-started, visible screen-capture session. A frame is retained only when
 * the user taps Scan, then handed to MainActivity in process memory.
 */
public class ConversationAssistantService extends Service {
    static final String ACTION_START = "com.neonjungle.subtext.assistant.START";
    static final String ACTION_CAPTURE = "com.neonjungle.subtext.assistant.CAPTURE";
    static final String ACTION_STOP = "com.neonjungle.subtext.assistant.STOP";
    static final String ACTION_ANALYZE_CAPTURE = "com.neonjungle.subtext.assistant.ANALYZE_CAPTURE";
    static final String EXTRA_RESULT_CODE = "projection_result_code";
    static final String EXTRA_RESULT_DATA = "projection_result_data";

    private static final String CHANNEL_ID = "subtext_conversation_assist";
    private static final int NOTIFICATION_ID = 4120;
    private static volatile boolean running;

    private HandlerThread captureThread;
    private Handler captureHandler;
    private Handler mainHandler;
    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private WindowManager windowManager;
    private CompanionOverlay companion;
    private volatile boolean captureRequested;
    private volatile boolean captureBusy;

    static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        mainHandler = new Handler(getMainLooper());
        captureThread = new HandlerThread("SubtextScreenCapture");
        captureThread.start();
        captureHandler = new Handler(captureThread.getLooper());
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_CAPTURE.equals(action)) {
            requestCapture();
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(action)) return START_NOT_STICKY;

        startVisibleForeground();
        if (projection == null) startProjection(intent);
        return START_NOT_STICKY;
    }

    private void startVisibleForeground() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        running = true;
    }

    private void startProjection(Intent intent) {
        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
        Intent resultData;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent.class);
        } else {
            //noinspection deprecation
            resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        }
        if (resultCode == 0 || resultData == null) {
            stopSelf();
            return;
        }

        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        projection = manager.getMediaProjection(resultCode, resultData);
        projection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() {
                stopSelf();
            }
        }, mainHandler);

        DisplayMetrics metrics = new DisplayMetrics();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        //noinspection deprecation
        windowManager.getDefaultDisplay().getRealMetrics(metrics);
        int width = Math.max(1, metrics.widthPixels);
        int height = Math.max(1, metrics.heightPixels);
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        imageReader.setOnImageAvailableListener(this::onImageAvailable, captureHandler);
        virtualDisplay = projection.createVirtualDisplay(
                "SubtextConversationAssist",
                width,
                height,
                metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                captureHandler
        );
    }

    private void requestCapture() {
        if (projection == null || imageReader == null || captureBusy) return;
        if (companion != null) companion.close();
        captureBusy = true;
        captureHandler.postDelayed(() -> captureRequested = true, 140);
        captureHandler.postDelayed(() -> {
            if (!captureRequested) return;
            captureRequested = false;
            captureBusy = false;
        }, 2_500);
    }

    private void onImageAvailable(ImageReader reader) {
        Image image;
        try { image = reader.acquireLatestImage(); }
        catch (IllegalStateException stopped) { return; }
        if (image == null) return;
        try {
            if (!captureRequested) return;
            captureRequested = false;
            byte[] encoded;
            try {
                encoded = encodeImage(image);
            } catch (RuntimeException error) {
                encoded = null;
            }
            if (encoded == null) {
                mainHandler.post(() -> finishCaptureFailure());
                return;
            }
            final byte[] captured = encoded;
            mainHandler.post(() -> {
                captureBusy = false;
                if (!running) return;
                if (Settings.canDrawOverlays(this)) {
                    try {
                        if (companion == null) companion = new CompanionOverlay(this, this::requestCapture);
                        companion.show(captured);
                        return;
                    } catch (RuntimeException error) {
                        if (companion != null) companion.close();
                    }
                }
                PendingCaptureStore.put(captured, "image/jpeg");
                Intent open = new Intent(this, MainActivity.class)
                        .setAction(ACTION_ANALYZE_CAPTURE)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(open);
            });
        } finally {
            image.close();
        }
    }

    private void finishCaptureFailure() {
        captureBusy = false;
        Toast.makeText(this, "Subtext could not capture this screen. Try Share screenshot instead.", Toast.LENGTH_LONG).show();
    }

    private byte[] encodeImage(Image image) {
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        int pixelStride = plane.getPixelStride();
        int rowStride = plane.getRowStride();
        int rowPadding = rowStride - pixelStride * image.getWidth();
        Bitmap padded = Bitmap.createBitmap(
                image.getWidth() + rowPadding / pixelStride,
                image.getHeight(),
                Bitmap.Config.ARGB_8888
        );
        padded.copyPixelsFromBuffer(buffer);
        Bitmap cropped = Bitmap.createBitmap(padded, 0, 0, image.getWidth(), image.getHeight());
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        cropped.compress(Bitmap.CompressFormat.JPEG, 88, output);
        padded.recycle();
        if (cropped != padded) cropped.recycle();
        byte[] bytes = output.toByteArray();
        return bytes.length <= 8 * 1024 * 1024 ? bytes : null;
    }

    private Notification buildNotification() {
        PendingIntent scan = PendingIntent.getActivity(
                this,
                1,
                new Intent(this, CaptureActionActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        PendingIntent stop = PendingIntent.getService(
                this,
                2,
                new Intent(this, ConversationAssistantService.class).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return builder
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Subtext Conversation Assist is on")
                .setContentText("Use Subtext to analyze text · only when you choose")
                .setContentIntent(scan)
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .addAction(new Notification.Action.Builder(null, "Use Subtext to analyze text", scan).build())
                .addAction(new Notification.Action.Builder(null, "Stop", stop).build())
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Conversation Assist",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Visible while Subtext can scan the screen on your command.");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        running = false;
        captureRequested = false;
        captureBusy = false;
        if (companion != null) companion.close();
        companion = null;
        if (virtualDisplay != null) virtualDisplay.release();
        virtualDisplay = null;
        if (imageReader != null) imageReader.close();
        imageReader = null;
        if (projection != null) projection.stop();
        projection = null;
        PendingCaptureStore.clear();
        if (captureThread != null) captureThread.quitSafely();
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
