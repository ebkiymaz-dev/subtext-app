package com.neonjungle.subtext;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.List;

/** Native, standalone Subtext shell. No Chrome Custom Tab or TWA UI. */
public class MainActivity extends Activity implements PurchasesUpdatedListener {
    private static final String COACH_PRODUCT_ID = "answer_coach_premium";
    private static final int FILE_CHOOSER_REQUEST = 4104;
    private static final int SCREEN_CAPTURE_REQUEST = 4105;
    private static final int OVERLAY_REQUEST = 4106;
    private static final int ASSIST_NOTIFICATION_REQUEST = 4107;
    private static final int MAX_SHARED_TEXT_CHARS = 12_000;
    private static final int MAX_SHARED_IMAGE_BYTES = 8 * 1024 * 1024;
    private WebView webView;
    private FrameLayout rootView;
    private View launchOverlay;
    private View recoveryOverlay;
    private ValueCallback<Uri[]> fileCallback;
    private boolean pageShown;
    private boolean mainFrameFailed;
    private BillingClient billingClient;
    private ProductDetails coachProduct;
    private String billingStatus = "loading";
    private String billingMessage = "Connecting to Google Play…";
    private String billingPrice;
    private boolean coachEntitled;
    private String coachPurchaseToken;
    private static volatile String companionPurchaseToken;

    static String companionEntitlementProof() {
        JSONObject proof = new JSONObject();
        try {
            proof.put("packageName", "com.neonjungle.subtext");
            proof.put("productId", COACH_PRODUCT_ID);
            if (companionPurchaseToken != null) proof.put("purchaseToken", companionPurchaseToken);
        } catch (JSONException ignored) { }
        return proof.toString();
    }
    private final Object shareLock = new Object();
    private String pendingSharedText;
    private boolean pendingSharedTextTruncated;
    private Uri pendingSharedImage;
    private String pendingSharedImageType;
    private byte[] pendingSharedImageBytes;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#1F1D1A"));
        getWindow().setNavigationBarColor(Color.BLACK);

        rootView = new FrameLayout(this);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#FBF8F2"));
        webView.setVisibility(View.INVISIBLE);
        rootView.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        launchOverlay = createLaunchOverlay();
        rootView.addView(launchOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(rootView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Keep the responsive site fitted to the viewport while respecting
        // the user's Android font scale and allowing pinch zoom.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(Math.round(getResources().getConfiguration().fontScale * 100));
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString()
                + " SubtextAndroid/" + BuildConfig.VERSION_NAME
                + " (" + BuildConfig.VERSION_CODE + ")");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.addJavascriptInterface(new BillingBridge(), "SubtextBilling");
        webView.addJavascriptInterface(new ShareBridge(), "SubtextShare");
        webView.addJavascriptInterface(new AssistantBridge(), "SubtextAssistant");
        captureShareIntent(getIntent());
        captureAssistantIntent(getIntent());
        initializeBilling();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                return openOutsideIfNeeded(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openOutsideIfNeeded(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
                removeRecoveryOverlay();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showLoadFailure(
                        "Subtext could not connect. Check your connection and try again.", false);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showLoadFailure(
                        "Subtext is temporarily unavailable. Your conversation was not sent.", false);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showLoadFailure("Subtext stopped because the secure connection could not be verified.", false);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (rootView != null) rootView.removeView(view);
                view.destroy();
                webView = null;
                showLoadFailure("The secure reader stopped unexpectedly. Restart it to continue.", true);
                return true;
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (!mainFrameFailed) revealPage();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!mainFrameFailed) revealPage();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params
            ) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent chooser;
                try {
                    chooser = params.createIntent();
                    chooser.addCategory(Intent.CATEGORY_OPENABLE);
                    chooser.setType("image/*");
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(urlFromIntent(getIntent()));
    }

    private View createLaunchOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(Color.parseColor("#1F1D1A"));
        ImageView wordmark = new ImageView(this);
        wordmark.setImageResource(R.drawable.subtext_wordmark_static);
        wordmark.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        int size = Math.round(280 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams mark = new FrameLayout.LayoutParams(size, size);
        mark.gravity = android.view.Gravity.CENTER;
        overlay.addView(wordmark, mark);
        return overlay;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showLoadFailure(String message, boolean rendererGone) {
        mainFrameFailed = true;
        revealPage();
        removeRecoveryOverlay();
        if (rootView == null) return;

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(Color.parseColor("#FAF7F2"));

        TextView title = new TextView(this);
        title.setText("Subtext needs a moment");
        title.setTextColor(Color.parseColor("#1F1D1A"));
        title.setTextSize(24);
        title.setGravity(Gravity.CENTER);
        panel.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView detail = new TextView(this);
        detail.setText(message);
        detail.setTextColor(Color.parseColor("#3A342C"));
        detail.setTextSize(16);
        detail.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        detailParams.setMargins(0, dp(14), 0, dp(22));
        panel.addView(detail, detailParams);

        Button retry = new Button(this);
        retry.setText(rendererGone ? "Restart Subtext" : "Try again");
        retry.setTextColor(Color.WHITE);
        retry.setBackgroundColor(Color.parseColor("#836524"));
        retry.setOnClickListener(view -> {
            if (rendererGone || webView == null) {
                recreate();
                return;
            }
            removeRecoveryOverlay();
            webView.loadUrl(urlFromIntent(getIntent()));
        });
        panel.addView(retry, new LinearLayout.LayoutParams(dp(220), dp(52)));

        recoveryOverlay = panel;
        rootView.addView(panel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void removeRecoveryOverlay() {
        if (rootView != null && recoveryOverlay != null) rootView.removeView(recoveryOverlay);
        recoveryOverlay = null;
    }

    private void revealPage() {
        if (pageShown || webView == null) return;
        pageShown = true;
        publishBillingState();
        getWindow().setStatusBarColor(Color.parseColor("#FBF8F2"));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        webView.setAlpha(0f);
        webView.setVisibility(View.VISIBLE);
        webView.animate().alpha(1f).setDuration(220).start();
        if (launchOverlay != null) {
            launchOverlay.animate().alpha(0f).setDuration(220).withEndAction(() -> {
                if (rootView != null && launchOverlay != null) rootView.removeView(launchOverlay);
                launchOverlay = null;
            }).start();
        }
    }

    private void initializeBilling() {
        billingClient = BillingClient.newBuilder(this)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    billingStatus = "ready";
                    billingMessage = "Google Play is ready.";
                    queryCoachProduct();
                    restorePurchases();
                } else {
                    setBillingError("Google Play billing is unavailable: " + result.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                billingStatus = "loading";
                billingMessage = "Reconnecting to Google Play…";
                publishBillingState();
            }
        });
    }

    private void queryCoachProduct() {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(COACH_PRODUCT_ID)
                .setProductType(BillingClient.ProductType.SUBS)
                .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();
        billingClient.queryProductDetailsAsync(params, (result, detailsResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK
                    || detailsResult.getProductDetailsList().isEmpty()) {
                setBillingError("AnswerAce is not available in Google Play yet.");
                return;
            }
            coachProduct = detailsResult.getProductDetailsList().get(0);
            List<ProductDetails.SubscriptionOfferDetails> offers = coachProduct.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                List<ProductDetails.PricingPhase> phases = offers.get(0).getPricingPhases().getPricingPhaseList();
                if (!phases.isEmpty()) billingPrice = phases.get(phases.size() - 1).getFormattedPrice() + "/month";
            }
            publishBillingState();
        });
    }

    private void purchaseAnswerCoach() {
        runOnUiThread(() -> {
            if (coachEntitled) {
                billingMessage = "AnswerAce is already active.";
                publishBillingState();
                return;
            }
            if (billingClient == null || !billingClient.isReady() || coachProduct == null) {
                billingMessage = "Google Play is still connecting. Try again in a moment.";
                publishBillingState();
                return;
            }
            List<ProductDetails.SubscriptionOfferDetails> offers = coachProduct.getSubscriptionOfferDetails();
            if (offers == null || offers.isEmpty()) {
                setBillingError("No eligible AnswerAce subscription offer was found.");
                return;
            }
            BillingFlowParams.ProductDetailsParams item = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(coachProduct)
                    .setOfferToken(offers.get(0).getOfferToken())
                    .build();
            BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(item))
                    .build();
            BillingResult result = billingClient.launchBillingFlow(this, flow);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                setBillingError("Google Play could not open checkout: " + result.getDebugMessage());
            }
        });
    }

    private void restorePurchases() {
        if (billingClient == null || !billingClient.isReady()) return;
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();
        billingClient.queryPurchasesAsync(params, (result, purchases) -> {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                processPurchases(purchases);
            } else {
                setBillingError("Could not restore purchases: " + result.getDebugMessage());
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            processPurchases(purchases);
        } else if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            billingMessage = "Purchase canceled. Nothing was charged.";
            publishBillingState();
        } else {
            setBillingError("Google Play purchase did not complete: " + result.getDebugMessage());
        }
    }

    private void processPurchases(List<Purchase> purchases) {
        boolean purchased = false;
        boolean pending = false;
        String purchaseToken = null;
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(COACH_PRODUCT_ID)) continue;
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                purchased = true;
                purchaseToken = purchase.getPurchaseToken();
                if (!purchase.isAcknowledged()) {
                    AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchase.getPurchaseToken())
                            .build();
                    billingClient.acknowledgePurchase(params, result -> {
                        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            setBillingError("Purchase succeeded, but Google Play acknowledgement is still pending.");
                        }
                    });
                }
            } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                pending = true;
            }
        }
        coachEntitled = purchased;
        coachPurchaseToken = purchased ? purchaseToken : null;
        companionPurchaseToken = coachPurchaseToken;
        billingStatus = purchased ? "purchased" : pending ? "pending" : "ready";
        billingMessage = purchased
                ? "AnswerAce unlocked. Thank you."
                : pending ? "Payment is pending. AnswerAce unlocks after Google Play confirms it."
                : "No active AnswerAce subscription was found.";
        publishBillingState();
    }

    private void setBillingError(String message) {
        billingStatus = "error";
        billingMessage = message;
        publishBillingState();
    }

    private JSONObject billingState() {
        JSONObject state = new JSONObject();
        try {
            state.put("android", true);
            // Google Play installs must keep the Play purchase path unless the
            // app is enrolled in an applicable alternative-billing program.
            String installer = getPackageManager().getInstallerPackageName(getPackageName());
            state.put("solanaAllowed", BuildConfig.DEBUG ||
                    (installer != null && !installer.trim().isEmpty() && !"com.android.vending".equals(installer)));
            state.put("status", billingStatus);
            state.put("entitled", coachEntitled);
            state.put("message", billingMessage);
            if (billingPrice != null) state.put("price", billingPrice);
        } catch (JSONException ignored) { }
        return state;
    }

    private void publishBillingState() {
        if (webView == null || !pageShown) return;
        final String json = billingState().toString();
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('subtext:billing',{detail:JSON.parse(" + JSONObject.quote(json) + ")}));",
                null
        ));
    }

    private JSONObject assistantState() {
        JSONObject state = new JSONObject();
        try {
            state.put("android", true);
            state.put("active", ConversationAssistantService.isRunning());
        } catch (JSONException ignored) { }
        return state;
    }

    private void publishAssistantState() {
        if (webView == null || !pageShown) return;
        final String json = assistantState().toString();
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('subtext:assistant',{detail:JSON.parse(" + JSONObject.quote(json) + ")}));",
                null
        ));
    }

    private final class BillingBridge {
        @JavascriptInterface
        public String getState() {
            return billingState().toString();
        }

        @JavascriptInterface
        public void purchaseAnswerCoach() {
            MainActivity.this.purchaseAnswerCoach();
        }

        @JavascriptInterface
        public void restorePurchases() {
            runOnUiThread(() -> MainActivity.this.restorePurchases());
        }

        @JavascriptInterface
        public void manageSubscription() {
            Uri uri = Uri.parse("https://play.google.com/store/account/subscriptions?sku="
                    + COACH_PRODUCT_ID + "&package=" + getPackageName());
            runOnUiThread(() -> startActivity(new Intent(Intent.ACTION_VIEW, uri)));
        }

        @JavascriptInterface
        public String getEntitlementProof() {
            JSONObject proof = new JSONObject();
            try {
                proof.put("packageName", getPackageName());
                proof.put("productId", COACH_PRODUCT_ID);
                if (coachPurchaseToken != null) proof.put("purchaseToken", coachPurchaseToken);
            } catch (JSONException ignored) { }
            return proof.toString();
        }
    }

    /**
     * One-time, in-memory handoff from Android's Share sheet to the reader.
     * Shared conversations never become a URL, cache key, log line, or file.
     */
    private final class ShareBridge {
        @JavascriptInterface
        public String consumePendingShare() {
            String text;
            boolean truncated;
            Uri image;
            String imageType;
            byte[] imageBytes;
            synchronized (shareLock) {
                text = pendingSharedText;
                truncated = pendingSharedTextTruncated;
                image = pendingSharedImage;
                imageType = pendingSharedImageType;
                imageBytes = pendingSharedImageBytes;
                pendingSharedText = null;
                pendingSharedTextTruncated = false;
                pendingSharedImage = null;
                pendingSharedImageType = null;
                pendingSharedImageBytes = null;
            }

            JSONObject payload = new JSONObject();
            try {
                if (text != null) {
                    payload.put("kind", "text");
                    payload.put("text", text);
                    payload.put("truncated", truncated);
                } else if (image != null || imageBytes != null) {
                    byte[] bytes = imageBytes != null ? imageBytes : readSharedImage(image);
                    payload.put("kind", "image");
                    payload.put("type", imageType == null ? "image/jpeg" : imageType);
                    payload.put("name", sharedImageName(imageType));
                    payload.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                } else {
                    payload.put("kind", "none");
                }
            } catch (ShareTooLargeException error) {
                putShareError(payload, "That shared screenshot is over 8 MB. Crop it and share it again.");
            } catch (IOException | SecurityException error) {
                putShareError(payload, "Subtext could not read that shared screenshot. Save it to Photos, then upload it inside Subtext.");
            } catch (JSONException ignored) {
                return "{\"kind\":\"error\",\"message\":\"Subtext could not open the shared item.\"}";
            }
            return payload.toString();
        }
    }

    private final class AssistantBridge {
        @JavascriptInterface
        public String getState() {
            return assistantState().toString();
        }

        @JavascriptInterface
        public void startConversationAssist() {
            runOnUiThread(() -> requestConversationAssistant());
        }

        @JavascriptInterface
        public void stopConversationAssist() {
            runOnUiThread(() -> {
                stopService(new Intent(MainActivity.this, ConversationAssistantService.class));
                publishAssistantState();
            });
        }
    }

    private void requestConversationAssistant() {
        if (ConversationAssistantService.isRunning()) {
            publishAssistantState();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Turn on Conversation Assist?")
                .setMessage("While this session is on, Android lets Subtext view your screen. Subtext captures a screenshot only when you tap Scan. The screenshot is analyzed on this device, is not automatically saved, and is never sent to AnswerAce unless you separately request coaching. Protected screens remain protected. Stop anytime from the Subtext control or notification.")
                .setNegativeButton("Not now", null)
                .setPositiveButton("Continue", (dialog, which) -> {
                    if (!Settings.canDrawOverlays(this)) {
                        startActivityForResult(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())), OVERLAY_REQUEST);
                    } else requestCaptureConsent();
                })
                .show();
    }

    private void requestCaptureConsent() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, ASSIST_NOTIFICATION_REQUEST);
            return;
        }
        android.app.NotificationManager notifications = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 24 && !notifications.areNotificationsEnabled()) {
            new AlertDialog.Builder(this).setMessage("Enable Subtext notifications in Android settings to use the Analyze text action. Sharing text or screenshots still works without it.").setPositiveButton("OK", null).show();
            return;
        }
        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        startActivityForResult(manager.createScreenCaptureIntent(), SCREEN_CAPTURE_REQUEST);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != ASSIST_NOTIFICATION_REQUEST) return;
        if (results.length > 0 && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) requestCaptureConsent();
        else new AlertDialog.Builder(this).setMessage("Notifications are needed for the Analyze text button. You can still share a conversation to Subtext without enabling this mode.").setPositiveButton("OK", null).show();
    }

    private void captureAssistantIntent(Intent intent) {
        if (intent == null || !ConversationAssistantService.ACTION_ANALYZE_CAPTURE.equals(intent.getAction())) return;
        PendingCaptureStore.Item item = PendingCaptureStore.take();
        if (item == null || item.bytes == null) return;
        synchronized (shareLock) {
            pendingSharedText = null;
            pendingSharedTextTruncated = false;
            pendingSharedImage = null;
            pendingSharedImageType = item.type;
            pendingSharedImageBytes = item.bytes;
        }
    }

    private void captureShareIntent(Intent intent) {
        if (intent == null || (!Intent.ACTION_SEND.equals(intent.getAction())
                && !Intent.ACTION_PROCESS_TEXT.equals(intent.getAction()))) return;
        String type = intent.getType();
        synchronized (shareLock) {
            pendingSharedText = null;
            pendingSharedTextTruncated = false;
            pendingSharedImage = null;
            pendingSharedImageType = null;
            pendingSharedImageBytes = null;

            if ("text/plain".equalsIgnoreCase(type)) {
                CharSequence sharedValue = Intent.ACTION_PROCESS_TEXT.equals(intent.getAction())
                        ? intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)
                        : intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
                String shared = sharedValue == null ? null : sharedValue.toString();
                if (shared != null && !shared.trim().isEmpty()) {
                    pendingSharedTextTruncated = shared.length() > MAX_SHARED_TEXT_CHARS;
                    pendingSharedText = pendingSharedTextTruncated
                            ? shared.substring(0, MAX_SHARED_TEXT_CHARS)
                            : shared;
                }
                return;
            }

            if (type != null && type.toLowerCase(java.util.Locale.ROOT).startsWith("image/")) {
                Uri sharedImage;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    sharedImage = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
                } else {
                    //noinspection deprecation
                    sharedImage = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                }
                if (sharedImage == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
                    sharedImage = intent.getClipData().getItemAt(0).getUri();
                }
                if (sharedImage != null && "content".equalsIgnoreCase(sharedImage.getScheme())) {
                    pendingSharedImage = sharedImage;
                    String resolvedType = getContentResolver().getType(sharedImage);
                    pendingSharedImageType = resolvedType != null ? resolvedType : type;
                }
            }
        }
    }

    private byte[] readSharedImage(Uri uri) throws IOException, ShareTooLargeException {
        try (InputStream input = getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IOException("Shared image stream unavailable");
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > MAX_SHARED_IMAGE_BYTES) throw new ShareTooLargeException();
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private String sharedImageName(String type) {
        if ("image/png".equalsIgnoreCase(type)) return "shared-screenshot.png";
        if ("image/webp".equalsIgnoreCase(type)) return "shared-screenshot.webp";
        if ("image/heic".equalsIgnoreCase(type) || "image/heif".equalsIgnoreCase(type)) return "shared-screenshot.heic";
        return "shared-screenshot.jpg";
    }

    private void putShareError(JSONObject payload, String message) {
        try {
            payload.put("kind", "error");
            payload.put("message", message);
        } catch (JSONException ignored) { }
    }

    private static final class ShareTooLargeException extends Exception { }

    private boolean openOutsideIfNeeded(Uri uri) {
        String host = uri.getHost();
        String path = uri.getPath();
        if ("neonjungletools.com".equalsIgnoreCase(host) && path != null && path.startsWith("/subtext/")) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // Leave the current safe page in place when no external handler exists.
        }
        return true;
    }

    private String urlFromIntent(Intent intent) {
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            Uri uri = intent.getData();
            if ("neonjungletools.com".equalsIgnoreCase(uri.getHost()) && uri.getPath() != null && uri.getPath().startsWith("/subtext/")) {
                return uri.toString();
            }
        }
        return "https://neonjungletools.com/subtext/?app=" + BuildConfig.VERSION_CODE;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureShareIntent(intent);
        captureAssistantIntent(intent);
        if (webView != null) webView.loadUrl(urlFromIntent(intent));
    }

    @Override
    protected void onResume() {
        super.onResume();
        restorePurchases();
        publishAssistantState();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == OVERLAY_REQUEST) {
            if (Settings.canDrawOverlays(this)) requestCaptureConsent();
            else new AlertDialog.Builder(this).setMessage("The on-demand analysis panel needs Display over other apps permission. It appears only when requested. You can still share screenshots to Subtext without it.").setPositiveButton("OK", null).show();
            return;
        }
        if (requestCode == SCREEN_CAPTURE_REQUEST) {
            if (resultCode == RESULT_OK && data != null) {
                Intent service = new Intent(this, ConversationAssistantService.class)
                        .setAction(ConversationAssistantService.ACTION_START)
                        .putExtra(ConversationAssistantService.EXTRA_RESULT_CODE, resultCode)
                        .putExtra(ConversationAssistantService.EXTRA_RESULT_DATA, data);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
                else startService(service);
                webView.postDelayed(this::publishAssistantState, 500);
            } else {
                publishAssistantState();
            }
            return;
        }
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (billingClient != null) billingClient.endConnection();
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
