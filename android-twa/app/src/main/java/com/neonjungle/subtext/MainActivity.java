package com.neonjungle.subtext;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
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

import java.util.Collections;
import java.util.List;

/** Native, standalone Subtext shell. No Chrome Custom Tab or TWA UI. */
public class MainActivity extends Activity implements PurchasesUpdatedListener {
    private static final String START_URL = "https://neonjungletools.com/subtext/?app=6";
    private static final String COACH_PRODUCT_ID = "answer_coach_premium";
    private static final int FILE_CHOOSER_REQUEST = 4104;
    private WebView webView;
    private FrameLayout rootView;
    private View launchOverlay;
    private ValueCallback<Uri[]> fileCallback;
    private boolean pageShown;
    private BillingClient billingClient;
    private ProductDetails coachProduct;
    private String billingStatus = "loading";
    private String billingMessage = "Connecting to Google Play…";
    private String billingPrice;
    private boolean coachEntitled;
    private String coachPurchaseToken;

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
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Keep the responsive site locked to the device viewport. Some Android
        // WebView versions retain a focused form field's temporary page scale
        // after client-side navigation, which leaves the next screen clipped
        // horizontally. System font scaling and Android magnification remain
        // available for accessibility.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString() + " SubtextAndroid/1.5");
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.addJavascriptInterface(new BillingBridge(), "SubtextBilling");
        initializeBilling();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openOutsideIfNeeded(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openOutsideIfNeeded(Uri.parse(url));
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                revealPage();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                revealPage();
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
                setBillingError("Answer Coach is not available in Google Play yet.");
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
                billingMessage = "Answer Coach is already active.";
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
                setBillingError("No eligible Answer Coach subscription offer was found.");
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
        billingStatus = purchased ? "purchased" : pending ? "pending" : "ready";
        billingMessage = purchased
                ? "Answer Coach unlocked. Thank you."
                : pending ? "Payment is pending. Answer Coach unlocks after Google Play confirms it."
                : "No active Answer Coach subscription was found.";
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
        return START_URL;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null) webView.loadUrl(urlFromIntent(intent));
    }

    @Override
    protected void onResume() {
        super.onResume();
        restorePurchases();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
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
