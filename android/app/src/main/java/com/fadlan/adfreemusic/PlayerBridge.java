package com.fadlan.adfreemusic;

import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import java.lang.ref.WeakReference;

/** Menghubungkan notifikasi/lockscreen (MusicService) dengan WebView di MainActivity. */
final class PlayerBridge {
    private static WeakReference<WebView> webView = new WeakReference<>(null);
    private static final Handler main = new Handler(Looper.getMainLooper());

    static void attach(WebView view) {
        webView = new WeakReference<>(view);
    }

    static void control(String action) {
        main.post(() -> {
            WebView view = webView.get();
            if (view != null) {
                view.evaluateJavascript("window.__adfreeControl && window.__adfreeControl('" + action + "')", null);
            }
        });
    }

    private PlayerBridge() {}
}
