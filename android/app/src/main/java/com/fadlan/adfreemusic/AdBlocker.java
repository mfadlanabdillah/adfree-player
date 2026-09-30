package com.fadlan.adfreemusic;

import android.net.Uri;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Pemblokir request iklan/pelacak berbasis domain + pola URL YouTube. */
final class AdBlocker {
    private static final Set<String> AD_HOSTS = new HashSet<>(Arrays.asList(
            "doubleclick.net", "googlesyndication.com", "googleadservices.com",
            "googletagservices.com", "googletagmanager.com", "google-analytics.com",
            "adservice.google.com", "pagead2.googlesyndication.com", "imasdk.googleapis.com",
            "ad.doubleclick.net", "static.doubleclick.net", "stats.g.doubleclick.net",
            "securepubads.g.doubleclick.net", "pubads.g.doubleclick.net",
            "adsafeprotected.com", "moatads.com", "scorecardresearch.com",
            "2mdn.net", "innovid.com", "serving-sys.com", "adnxs.com",
            "amazon-adsystem.com", "criteo.com", "taboola.com", "outbrain.com"));

    private static final String[] AD_PATHS = {
            "/pagead/", "/ptracking", "/api/stats/ads", "/api/stats/atr",
            "/get_midroll_", "/ad_break", "/youtubei/v1/player/ad_break",
            "/generate_204", "/csi_204", "/log_event", "/pcs/activeview",
            "/adview", "/ad_data_204", "/get_video_info?ad", "/api/stats/qoe?adformat"
    };

    private static int blocked = 0;

    static int blockedCount() {
        return blocked;
    }

    static boolean shouldBlock(Uri uri) {
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase();
        // Cek host dan semua parent domain-nya (a.b.doubleclick.net -> doubleclick.net).
        for (String h = host; h.contains("."); h = h.substring(h.indexOf('.') + 1)) {
            if (AD_HOSTS.contains(h)) return true;
        }
        if (host.endsWith("youtube.com") || host.endsWith("google.com")) {
            String path = uri.getEncodedPath() + (uri.getEncodedQuery() != null ? "?" + uri.getEncodedQuery() : "");
            for (String p : AD_PATHS) if (path.contains(p)) return true;
        }
        return false;
    }

    static WebResourceResponse emptyResponse() {
        blocked++;
        return new WebResourceResponse("text/plain", "utf-8", 204, "No Content",
                null, new ByteArrayInputStream(new byte[0]));
    }

    private AdBlocker() {}
}
