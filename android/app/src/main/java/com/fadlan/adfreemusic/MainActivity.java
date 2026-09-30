package com.fadlan.adfreemusic;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;

public class MainActivity extends Activity {
    private static final String MUSIC_URL = "https://music.youtube.com/";
    private static final String YOUTUBE_URL = "https://m.youtube.com/";
    // Android TV: YouTube memakai tampilan TV resminya (dikendalikan remote), yang hanya mau
    // terbuka untuk perangkat "Cobalt" (mesin aplikasi YouTube TV). YouTube Music memakai tampilan desktop.
    private static final String TV_URL = "https://www.youtube.com/tv";
    private static final String TV_UA = "Mozilla/5.0 (Linux armeabi-v7a; Android 9) Cobalt/23.lts.4.308722-gold (unlike Gecko) "
            + "v8/8.8.278.17-jit gles Starboard/14, SHARP_ATV_R_2021/1.0 (Sharp, 4T-C50DL7NR, Wireless) com.google.android.youtube.tv/4.35.0";
    private static final String DESKTOP_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

    private boolean tv;
    private boolean backLongHandled;
    private android.app.AlertDialog tvMenu;

    private WebView webView;
    private String injectJs = "";
    private boolean documentStartSupported;
    private long lastBackPress;

    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Logika bersama desktop & Android + bagian khusus Android.
        tv = getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK)
                || ((android.app.UiModeManager) getSystemService(UI_MODE_SERVICE)).getCurrentModeType()
                == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION;
        injectJs = (tv ? "window.__adfreeTv = true;\n" : "")
                + readAsset("adfree-core.js") + "\n;\n" + readAsset("inject.js");

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#030303"));

        // Android 15 memaksa tampilan edge-to-edge: beri jarak sebesar status bar, navigation bar,
        // notch dan keyboard supaya halaman tidak tertutup.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#030303"));
        root.addView(webView);
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        // Hilangkan penanda "wv" agar Google memperlakukan ini seperti Chrome biasa (penting untuk login).
        s.setUserAgentString(s.getUserAgentString().replace("; wv", "").replaceAll("Version/\\S+ ", ""));

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new JsBridge(), "AdFree");
        PlayerBridge.attach(webView);

        // Suntik skrip sebelum script YouTube berjalan (paling efektif untuk memangkas iklan).
        documentStartSupported = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
        if (documentStartSupported) {
            WebViewCompat.addDocumentStartJavaScript(webView, injectJs, new HashSet<>(Arrays.asList(
                    "https://music.youtube.com", "https://www.youtube.com", "https://m.youtube.com")));
        }

        webView.setWebChromeClient(new WebChromeClient() {
            // Video layar penuh (tombol fullscreen di pemutar YouTube).
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                view.setBackgroundColor(Color.BLACK);
                ((ViewGroup) getWindow().getDecorView()).addView(view,
                        new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                c.hide(WindowInsetsCompat.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (AdBlocker.shouldBlock(request.getUrl())) return AdBlocker.emptyResponse();
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                // Tautan "Buka di aplikasi YouTube" diabaikan supaya tetap di aplikasi ini.
                if (scheme.equals("intent") || scheme.startsWith("vnd.youtube") || scheme.equals("youtube")) return true;
                String host = uri.getHost() == null ? "" : uri.getHost();
                boolean internal = host.endsWith("youtube.com") || host.equals("youtu.be")
                        || host.endsWith("google.com") || host.endsWith("google.co.id") || host.endsWith("gstatic.com");
                if (internal && tv && !uaFor(uri.toString()).equals(view.getSettings().getUserAgentString())) {
                    // Pindah antara YouTube (TV) dan YouTube Music: ganti identitas browser dulu.
                    openSite(uri.toString());
                    return true;
                }
                if (internal) return false;
                // Link di luar YouTube/Google dibuka di browser biasa.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!documentStartSupported) view.evaluateJavascript(injectJs, null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!documentStartSupported) view.evaluateJavascript(injectJs, null);
                CookieManager.getInstance().flush();
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            openSite(startUrl(getIntent()));
        }

        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    /** Link YouTube dari intent VIEW atau dari tombol Bagikan (SEND), atau null. */
    private static String linkFrom(Intent intent) {
        if (intent == null) return null;
        String text = intent.getDataString();
        if (Intent.ACTION_SEND.equals(intent.getAction())) text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("https://(?:[a-z]+\\.)?(?:youtube\\.com|youtu\\.be)/\\S*").matcher(text);
        return m.find() ? m.group() : null;
    }

    private String startUrl(Intent intent) {
        String link = linkFrom(intent);
        if (link != null) return link;
        // Buka situs terakhir yang dipakai (YouTube atau YouTube Music).
        String site = getPreferences(MODE_PRIVATE).getString("lastSite", MUSIC_URL);
        if (tv && !site.equals(MUSIC_URL)) return TV_URL;
        return site;
    }

    private void rememberSite(String url) {
        String site = url.startsWith(MUSIC_URL) ? MUSIC_URL
                : url.contains("youtube.com") ? YOUTUBE_URL : null;
        if (site != null) getPreferences(MODE_PRIVATE).edit().putString("lastSite", site).apply();
    }

    private String uaFor(String url) {
        return url.contains("music.youtube.com") ? DESKTOP_UA : TV_UA;
    }

    /** Membuka situs; di TV sekaligus memasang identitas browser yang cocok. */
    private void openSite(String url) {
        if (tv) {
            // Link video biasa (youtube.com/watch, youtu.be) dibuka di tampilan TV.
            if (!url.contains("music.youtube.com") && !url.contains("youtube.com/tv")) {
                String id = Uri.parse(url).getQueryParameter("v");
                if (id == null && url.contains("youtu.be/")) id = Uri.parse(url).getLastPathSegment();
                url = id != null ? TV_URL + "#/watch?v=" + id : TV_URL;
            }
            webView.getSettings().setUserAgentString(uaFor(url));
        }
        webView.loadUrl(url);
    }

    // ---- Android TV: tombol remote ----------------------------------------

    @Override
    public boolean dispatchKeyEvent(android.view.KeyEvent e) {
        if (!tv) return super.dispatchKeyEvent(e);
        int key = e.getKeyCode();
        if (key == android.view.KeyEvent.KEYCODE_MENU || key == android.view.KeyEvent.KEYCODE_INFO
                || key == android.view.KeyEvent.KEYCODE_GUIDE || key == android.view.KeyEvent.KEYCODE_PROG_RED) {
            if (e.getAction() == android.view.KeyEvent.ACTION_UP) showTvMenu();
            return true;
        }
        if (key == android.view.KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == android.view.KeyEvent.ACTION_DOWN) {
                if (e.getRepeatCount() == 0) {
                    backLongHandled = false;
                } else if (!backLongHandled && e.getEventTime() - e.getDownTime() > 600) {
                    // Tahan Back = buka menu aplikasi (remote Google TV tidak punya tombol Menu).
                    backLongHandled = true;
                    showTvMenu();
                }
            } else if (e.getAction() == android.view.KeyEvent.ACTION_UP && !backLongHandled && !e.isCanceled()) {
                handleTvBack();
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    private void handleTvBack() {
        if (fullscreenView != null) {
            exitFullscreen();
            return;
        }
        webView.evaluateJavascript("(window.__adfreeUi && window.__adfreeUi.back()) || false", handled -> {
            if ("true".equals(handled)) return;
            String url = webView.getUrl() == null ? "" : webView.getUrl();
            if (url.contains("youtube.com/tv")) {
                // Tampilan TV YouTube memakai Escape sebagai tombol kembali.
                webView.requestFocus();
                webView.dispatchKeyEvent(new android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_ESCAPE));
                webView.dispatchKeyEvent(new android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_ESCAPE));
            } else if (webView.canGoBack()) {
                webView.goBack();
            } else {
                showTvMenu();
            }
        });
    }

    private void showTvMenu() {
        if (tvMenu != null && tvMenu.isShowing()) return;
        String[] items = {"▶  YouTube", "♪  YouTube Music", "≡  Lirik real-time", "⟳  Muat ulang",
                AdBlocker.blockedCount() + " iklan diblokir  ·  Keluar"};
        tvMenu = new android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("AdFree Music")
                .setItems(items, (d, which) -> {
                    if (which == 0) openSite(TV_URL);
                    if (which == 1) openSite(MUSIC_URL);
                    if (which == 2) webView.evaluateJavascript("window.__adfreeUi && window.__adfreeUi.toggleLyrics()", null);
                    if (which == 3) webView.reload();
                    if (which == 4) finish();
                })
                .create();
        tvMenu.show();
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        ((ViewGroup) getWindow().getDecorView()).removeView(fullscreenView);
        fullscreenView = null;
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
                .show(WindowInsetsCompat.Type.systemBars());
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String link = linkFrom(intent);
        if (link != null) openSite(link);
    }

    // Sengaja TIDAK memanggil webView.onPause()/pauseTimers() supaya musik tetap jalan di latar belakang.

    @Override
    protected void onStop() {
        super.onStop();
        String url = webView.getUrl();
        if (url != null) rememberSite(url);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            exitFullscreen();
            return;
        }
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackPress < 2000) {
            // Kembali ke home screen, musik tetap berjalan.
            moveTaskToBack(true);
        } else {
            lastBackPress = now;
            Toast.makeText(this, AdBlocker.blockedCount() + " iklan/pelacak diblokir. Tekan kembali lagi untuk keluar ke layar utama.",
                    Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        if (isFinishing()) stopService(new Intent(this, MusicService.class));
        webView.destroy();
        super.onDestroy();
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            return "";
        }
    }

    private class JsBridge {
        /** Dipanggil dari halaman setiap kali lagu/status putar berubah. */
        @JavascriptInterface
        public void onState(String title, String artist, String artUrl, boolean playing) {
            Intent i = new Intent(MainActivity.this, MusicService.class)
                    .setAction(MusicService.ACTION_UPDATE)
                    .putExtra("title", title)
                    .putExtra("artist", artist)
                    .putExtra("art", artUrl)
                    .putExtra("playing", playing);
            try {
                ContextCompat.startForegroundService(MainActivity.this, i);
            } catch (Exception ignored) {
                // Android 12+ bisa menolak start dari background; notifikasi akan muncul saat app dibuka lagi.
            }
        }

        /** YouTube versi TV meminta keluar (window.close) -> tampilkan menu aplikasi. */
        @JavascriptInterface
        public void exitRequested() {
            runOnUiThread(MainActivity.this::showTvMenu);
        }

        /** Mengambil data lirik untuk panel lirik real-time. Hanya boleh ke lrclib.net. */
        @JavascriptInterface
        public void fetchText(String id, String url) {
            new Thread(() -> {
                String body = null;
                try {
                    URL u = new URL(url);
                    if ("https".equals(u.getProtocol()) && "lrclib.net".equals(u.getHost())) {
                        HttpURLConnection c = (HttpURLConnection) u.openConnection();
                        c.setConnectTimeout(10000);
                        c.setReadTimeout(10000);
                        c.setRequestProperty("User-Agent", "AdFreeMusic/1.2 (personal player)");
                        if (c.getResponseCode() == 200) {
                            try (InputStream in = c.getInputStream()) {
                                ByteArrayOutputStream out = new ByteArrayOutputStream();
                                byte[] buf = new byte[8192];
                                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                                body = out.toString(StandardCharsets.UTF_8.name());
                            }
                        }
                        c.disconnect();
                    }
                } catch (Exception ignored) {
                }
                String js = "window.__adfreeCb && window.__adfreeCb(" + JSONObject.quote(id) + ","
                        + (body == null ? "null" : JSONObject.quote(body)) + ")";
                runOnUiThread(() -> webView.evaluateJavascript(js, null));
            }).start();
        }
    }
}
