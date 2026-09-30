package com.fadlan.adfreemusic;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Foreground service: menjaga proses tetap hidup saat di background + notifikasi media & kontrol lockscreen. */
public class MusicService extends Service {
    static final String ACTION_UPDATE = "update";
    private static final String ACTION_CONTROL = "control";
    private static final String ACTION_STOP = "stop";
    private static final String CHANNEL = "playback";
    private static final int NOTIF_ID = 1;

    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock wakeLock;
    private String title = "AdFree Music", artist = "", artUrl = "";
    private boolean playing;
    private Bitmap art;

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Pemutar musik", NotificationManager.IMPORTANCE_LOW);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);

        mediaSession = new MediaSessionCompat(this, "AdFreeMusic");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { PlayerBridge.control("play"); }
            @Override public void onPause() { PlayerBridge.control("pause"); }
            @Override public void onSkipToNext() { PlayerBridge.control("next"); }
            @Override public void onSkipToPrevious() { PlayerBridge.control("prev"); }
            @Override public void onStop() { PlayerBridge.control("pause"); }
        });
        mediaSession.setActive(true);

        PowerManager pm = getSystemService(PowerManager.class);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AdFreeMusic:playback");
        wakeLock.setReferenceCounted(false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            PlayerBridge.control("pause");
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_CONTROL.equals(action)) {
            PlayerBridge.control(intent.getStringExtra("cmd"));
        } else if (ACTION_UPDATE.equals(action)) {
            title = intent.getStringExtra("title");
            artist = intent.getStringExtra("artist");
            playing = intent.getBooleanExtra("playing", false);
            String newArt = intent.getStringExtra("art");
            if (newArt != null && !newArt.equals(artUrl)) {
                artUrl = newArt;
                art = null;
                loadArt(newArt);
            }
        }
        if (playing) wakeLock.acquire(6 * 60 * 60 * 1000L);
        else if (wakeLock.isHeld()) wakeLock.release();
        updateSession();
        showNotification();
        return START_NOT_STICKY;
    }

    private void updateSession() {
        mediaSession.setMetadata(new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art)
                .build());
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                        | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                        | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_STOP)
                .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                        PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build());
    }

    private PendingIntent controlIntent(String cmd, int req) {
        Intent i = new Intent(this, MusicService.class).setAction(ACTION_CONTROL).putExtra("cmd", cmd);
        return PendingIntent.getService(this, req, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void showNotification() {
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 9,
                new Intent(this, MusicService.class).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(artist)
                .setLargeIcon(art)
                .setContentIntent(open)
                .setDeleteIntent(stop)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .addAction(R.drawable.ic_prev, "Sebelumnya", controlIntent("prev", 1))
                .addAction(playing ? R.drawable.ic_pause : R.drawable.ic_play,
                        playing ? "Jeda" : "Putar", controlIntent(playing ? "pause" : "play", 2))
                .addAction(R.drawable.ic_next, "Berikutnya", controlIntent("next", 3))
                .addAction(R.drawable.ic_close, "Tutup", stop)
                .setStyle(new MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2));

        int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, NOTIF_ID, b.build(), type);
    }

    private void loadArt(String url) {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                try (InputStream in = c.getInputStream()) {
                    Bitmap bmp = BitmapFactory.decodeStream(in);
                    if (bmp != null && url.equals(artUrl)) {
                        art = bmp;
                        getMainExecutor().execute(() -> {
                            updateSession();
                            showNotification();
                        });
                    }
                }
            } catch (Exception ignored) {
            }
        }).start();
    }

    @Override
    public void onDestroy() {
        if (wakeLock.isHeld()) wakeLock.release();
        mediaSession.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
