package com.aladin.driver;

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

    // Production Cloud URL (Vercel) & Embedded Offline Fallback for Driver
    public static final String CLOUD_URL = "https://aladinexpress.vercel.app/driver";
    public static final String OFFLINE_URL = "file:///android_asset/driver.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Root container with dark driver background (#0B0F19)
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

        // Build elegant Driver splash / loading screen
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
        titleView.setText("ALADIN DRIVER");
        titleView.setTextColor(Color.parseColor("#F59E0B")); // Amber Gold
        titleView.setTextSize(24);
        titleView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        titleView.setGravity(Gravity.CENTER);
        mSplashLayout.addView(titleView);

        TextView subView = new TextView(this);
        subView.setText("Portail Chauffeur & Coursier Partenaire");
        subView.setTextColor(Color.parseColor("#94A3B8"));
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
        mStatusText.setText("Connexion au réseau de dispatch Aladin...");
        mStatusText.setTextColor(Color.parseColor("#94A3B8"));
        mStatusText.setTextSize(12);
        mSplashLayout.addView(mStatusText);

        FrameLayout.LayoutParams splashParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        rootLayout.addView(mSplashLayout, splashParams);

        setContentView(rootLayout);

        // Configure modern WebView Settings
        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setGeolocationEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setLoadsImagesAutomatically(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setSupportZoom(false);
        webSettings.setBuiltInZoomControls(false);
        webSettings.setDisplayZoomControls(false);

        // Optimize caching and rendering
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        mWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Geolocation & chrome client
        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Grant geolocation for GPS driver positioning
                callback.invoke(origin, true, false);
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress > 60 && mSplashLayout != null && mSplashLayout.getVisibility() == View.VISIBLE) {
                    mSplashLayout.setVisibility(View.GONE);
                }
            }
        });

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                mHasLoadedSuccessfully = true;
                if (mSplashLayout != null) {
                    mSplashLayout.setVisibility(View.GONE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    fallbackToOffline("Hors ligne: chargement du mode embarqué");
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                fallbackToOffline("Mode hors ligne activé");
            }
        });

        // Smart Loader: Online Cloud vs Embedded Offline fallback
        loadApp();
    }

    private void loadApp() {
        if (isNetworkAvailable()) {
            if (mStatusText != null) mStatusText.setText("Chargement du réseau Aladin...");
            mWebView.loadUrl(CLOUD_URL);

            // Timeout watchdog: fallback to offline if cloud does not load in 4.5 seconds
            mWebView.postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (!mHasLoadedSuccessfully && !isFinishing()) {
                        fallbackToOffline("Réseau distant indisponible, bascule locale...");
                    }
                }
            }, 4500);
        } else {
            fallbackToOffline("Pas de connexion Internet, bascule locale...");
        }
    }

    private void fallbackToOffline(final String reason) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (mStatusText != null) mStatusText.setText(reason);
                mWebView.loadUrl(OFFLINE_URL);
                if (mSplashLayout != null) {
                    mSplashLayout.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            if (mSplashLayout != null) {
                                mSplashLayout.setVisibility(View.GONE);
                            }
                        }
                    }, 500);
                }
            }
        });
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnected();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && mWebView.canGoBack()) {
            mWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mWebView != null) {
            mWebView.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mWebView != null) {
            mWebView.onPause();
        }
    }

    @Override
    protected void onDestroy() {
        if (mWebView != null) {
            mWebView.destroy();
        }
        super.onDestroy();
    }
}
