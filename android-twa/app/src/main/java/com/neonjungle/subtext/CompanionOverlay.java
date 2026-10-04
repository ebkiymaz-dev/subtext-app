package com.neonjungle.subtext;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.util.Base64;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import org.json.JSONObject;

/** In-memory screenshot handoff to a first-party panel; never a URL or file. */
final class CompanionOverlay {
    private static final String PAGE = "https://neonjungletools.com/subtext/assist/";
    private final Context context;
    private final WindowManager windows;
    private final Handler main;
    private final Runnable scan;
    private LinearLayout panel;
    private WebView web;
    private byte[] pending;

    CompanionOverlay(Context context, Runnable scan) {
        this.context = context;
        this.scan = scan;
        windows = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        main = new Handler(context.getMainLooper());
    }

    void show(byte[] bytes) {
        close();
        synchronized (this) { pending = bytes; }
        panel = new LinearLayout(context);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setBackgroundColor(Color.parseColor("#F3E9D9"));
        LinearLayout controls = new LinearLayout(context);
        Button rescan = new Button(context);
        rescan.setText("Scan again");
        rescan.setOnClickListener(view -> { close(); scan.run(); });
        controls.addView(rescan, new LinearLayout.LayoutParams(0, dp(48), 1));
        Button dismiss = new Button(context);
        dismiss.setText("Close panel");
        dismiss.setOnClickListener(view -> close());
        controls.addView(dismiss, new LinearLayout.LayoutParams(0, dp(48), 1));
        panel.addView(controls);
        web = new WebView(context);
        web.setBackgroundColor(Color.parseColor("#F3E9D9"));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new Bridge(), "SubtextCompanion");
        web.setOnKeyListener((view, keyCode, event) -> {
            if (keyCode != KeyEvent.KEYCODE_BACK) return false;
            if (event.getAction() == KeyEvent.ACTION_UP) close();
            return true;
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Do not expose the bridge to other pages, schemes, or subframes.
                return !request.isForMainFrame() || !PAGE.equals(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return !PAGE.equals(url); }
        });
        panel.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            context.getResources().getDisplayMetrics().widthPixels - dp(24),
            (int) (context.getResources().getDisplayMetrics().heightPixels * 0.78),
            type, WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_SECURE,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.CENTER;
        params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        windows.addView(panel, params);
        web.loadUrl(PAGE);
    }

    void close() {
        synchronized (this) { pending = null; }
        if (web != null) {
            if (panel != null) panel.removeView(web);
            web.removeJavascriptInterface("SubtextCompanion");
            web.stopLoading();
            web.destroy();
            web = null;
        }
        if (panel != null) { try { windows.removeView(panel); } catch (IllegalArgumentException ignored) { } panel = null; }
    }

    private int dp(int value) { return Math.round(value * context.getResources().getDisplayMetrics().density); }
    private final class Bridge {
        @JavascriptInterface public String getEntitlementProof() { return MainActivity.companionEntitlementProof(); }
        @JavascriptInterface public String consumeCapture() {
            byte[] bytes;
            synchronized (CompanionOverlay.this) { bytes = pending; pending = null; }
            if (bytes == null) return "{}";
            try { return new JSONObject().put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP)).toString(); }
            catch (Exception ignored) { return "{}"; }
        }
        @JavascriptInterface public void copyReply(String text) {
            if (text == null || text.length() > 12000) return;
            main.post(() -> ((ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Subtext reply", text)));
        }
        @JavascriptInterface public void closePanel() { main.post(() -> close()); }
        @JavascriptInterface public void scanAgain() { main.post(() -> { close(); scan.run(); }); }
    }
}
