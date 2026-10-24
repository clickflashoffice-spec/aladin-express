package com.aladin.express;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {

    private WebView mWebView;
    private LinearLayout mSplashLayout;
    private TextView mStatusText;
    private boolean mHasLoadedSuccessfully = false;

    // Production Cloud URL (Vercel) & Embedded Offline Fallback
    public static final String CLOUD_URL = "https://aladinexpress.vercel.app/";
    public static final String OFFLINE_URL = "file:///android_asset/index.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Root container with brand dark background (#0B0F19)
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.parseColor("#0B0F19"));

        // Initialize WebView
        mWebView = new WebView(this);
        mWebView.setBackgroundColor(Color.parseColor("#0B0F19"));
        FrameLayout.LayoutParams webViewParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        rootLayout.addView(mWebView, webViewParams);

        // Build elegant splash / loading screen
        mSplashLayout = new LinearLayout(this);
        mSplashLayout.setOrientation(LinearLayout.VERTICAL);
        mSplashLayout.setGravity(Gravity.CENTER);
        mSplashLayout.setBackgroundColor(Color.parseColor("#0B0F19"));
        mSplashLayout.setPadding(32, 32, 32, 32);

        ImageView logoView = new ImageView(this);
        int logoResId = getResources().getIdentifier("logo", "drawable", getPackageName());
        if (logoResId != 0) {
            logoView.setImageResource(logoResId);
        }
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(220, 220);
        logoParams.bottomMargin = 28;
        mSplashLayout.addView(logoView, logoParams);

        TextView titleView = new TextView(this);
        titleView.setText("ALADIN EXPRESS");
        titleView.setTextColor(Color.parseColor("#F1F5F9"));
        titleView.setTextSize(24);
        titleView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        titleView.setGravity(Gravity.CENTER);
        mSplashLayout.addView(titleView);

        TextView subView = new TextView(this);
        subView.setText("Delivery & Fintech Ecosystem");
        subView.setTextColor(Color.parseColor("#F59E0B")); // Warm amber gold
        subView.setTextSize(14);
        subView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subParams.bottomMargin = 32;
        mSplashLayout.addView(subView, subParams);

        ProgressBar progressBar = new ProgressBar(this);
        LinearLayout.LayoutParams progParams = new LinearLayout.LayoutParams(70, 70);
        progParams.bottomMargin = 16;
        mSplashLayout.addView(progressBar, progParams);

        mStatusText = new TextView(this);
        mStatusText.setText("Connecting to Aladin Network...");
        mStatusText.setTextColor(Color.parseColor("#94A3B8"));
        mStatusText.setTextSize(12);
        mSplashLayout.addView(mStatusText);

        FrameLayout.LayoutParams splashParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        rootLayout.addView(mSplashLayout, splashParams);

        setContentView(rootLayout);

        configureWebView();
        loadEcosystem();
    }

    private void configureWebView() {
        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        try {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        } catch (Exception ignored) {}

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                mHasLoadedSuccessfully = true;
                // Fade out / hide splash screen once page is ready
                if (mSplashLayout != null && mSplashLayout.getVisibility() == View.VISIBLE) {
                    mSplashLayout.animate()
                            .alpha(0f)
                            .setDuration(300)
                            .withEndAction(new Runnable() {
                                @Override
                                public void run() {
                                    mSplashLayout.setVisibility(View.GONE);
                                }
                            });
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                handleLoadFailure(failingUrl, description);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    handleLoadFailure(request.getUrl().toString(), error.getDescription().toString());
                }
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });
    }

    private void handleLoadFailure(String failingUrl, String errorMsg) {
        // If Cloud URL failed, fallback to local offline asset
        if (!mHasLoadedSuccessfully && failingUrl != null && !failingUrl.startsWith("file://")) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    mStatusText.setText("Loading Offline Delivery Station...");
                    mWebView.loadUrl(OFFLINE_URL);
                }
            });
        }
    }

    private void loadEcosystem() {
        if (isNetworkAvailable()) {
            mStatusText.setText("Loading Aladin Express Cloud...");
            mWebView.loadUrl(CLOUD_URL);
        } else {
            mStatusText.setText("No Internet: Loading Offline Delivery Station...");
            mWebView.loadUrl(OFFLINE_URL);
        }
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnected();
        } catch (Exception e) {
            return true; // Default try online
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if ((keyCode == KeyEvent.KEYCODE_BACK) && mWebView.canGoBack()) {
            mWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
