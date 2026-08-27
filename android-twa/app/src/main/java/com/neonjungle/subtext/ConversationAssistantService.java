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
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
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
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
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
    private View overlay;
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
        mainHandler.postDelayed(this::showOverlayIfAllowed, 300);
    }

    private void requestCapture() {
        if (projection == null || imageReader == null || captureBusy) return;
        captureBusy = true;
        if (overlay != null) overlay.setVisibility(View.INVISIBLE);
        captureHandler.postDelayed(() -> captureRequested = true, 140);
        captureHandler.postDelayed(() -> {
            if (!captureRequested) return;
            captureRequested = false;
            captureBusy = false;
            mainHandler.post(() -> {
                if (overlay != null) overlay.setVisibility(View.VISIBLE);
            });
        }, 2_500);
    }

    private void onImageAvailable(ImageReader reader) {
        Image image = reader.acquireLatestImage();
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
            PendingCaptureStore.put(encoded, "image/jpeg");
            mainHandler.post(() -> {
                captureBusy = false;
                if (overlay != null) overlay.setVisibility(View.VISIBLE);
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
        if (overlay != null) overlay.setVisibility(View.VISIBLE);
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
        cropped.recycle();
        byte[] bytes = output.toByteArray();
        return bytes.length <= 8 * 1024 * 1024 ? bytes : null;
    }

    private void showOverlayIfAllowed() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return;
        if (overlay != null || windowManager == null) return;

        LinearLayout pill = new LinearLayout(this);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER);
        pill.setPadding(dp(5), dp(5), dp(5), dp(5));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor("#1F1D1A"));
        background.setCornerRadius(dp(24));
        background.setStroke(dp(1), Color.parseColor("#D8C7A1"));
        pill.setBackground(background);

        TextView scan = overlayButton("Scan", 14);
        scan.setContentDescription("Scan the visible conversation with Subtext");
        scan.setOnClickListener(view -> requestCapture());
        pill.addView(scan, new LinearLayout.LayoutParams(dp(66), dp(42)));

        TextView close = overlayButton("×", 21);
        close.setContentDescription("Stop Subtext Conversation Assist");
        close.setOnClickListener(view -> stopSelf());
        pill.addView(close, new LinearLayout.LayoutParams(dp(38), dp(42)));

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        params.x = dp(8);
        overlay = pill;
        windowManager.addView(overlay, params);
    }

    private TextView overlayButton(String text, int textSize) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(Color.parseColor("#FBF8F2"));
        view.setTextSize(textSize);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private Notification buildNotification() {
        PendingIntent openApp = PendingIntent.getActivity(
                this,
                0,
                new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        PendingIntent scan = PendingIntent.getService(
                this,
                1,
                new Intent(this, ConversationAssistantService.class).setAction(ACTION_CAPTURE),
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
                .setContentText("Tap Scan only when the conversation you want analyzed is visible.")
                .setContentIntent(openApp)
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .addAction(new Notification.Action.Builder(null, "Scan", scan).build())
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

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void removeOverlay() {
        if (windowManager != null && overlay != null) {
            try {
                windowManager.removeView(overlay);
            } catch (IllegalArgumentException ignored) { }
        }
        overlay = null;
    }

    @Override
    public void onDestroy() {
        running = false;
        captureRequested = false;
        captureBusy = false;
        removeOverlay();
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
