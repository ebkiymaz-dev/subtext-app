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
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Native, standalone Subtext shell. No Chrome Custom Tab or TWA UI. */
public class MainActivity extends Activity {
    private static final String START_URL = "https://neonjungletools.com/subtext/?app=4";
    private static final int FILE_CHOOSER_REQUEST = 4104;
    private WebView webView;
    private FrameLayout rootView;
    private View launchOverlay;
    private ValueCallback<Uri[]> fileCallback;
    private boolean pageShown;

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
        settings.setUserAgentString(settings.getUserAgentString() + " SubtextAndroid/1.3");
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

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
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
