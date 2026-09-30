# Jembatan JavaScript (JsBridge di MainActivity): method @JavascriptInterface
# dipanggil dari WebView lewat refleksi, jadi tidak boleh diganti nama/dibuang.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Callback MediaSessionCompat dipanggil dari framework media lewat interface
# publik; androidx membawa aturannya sendiri, ini hanya lapisan cadangan.
-keep class android.support.v4.media.** { *; }
