# AdFree Music

Pemutar **YouTube & YouTube Music tanpa iklan** untuk desktop Windows dan Android (termasuk Android TV).

Tersedia dua aplikasi dari satu logika inti yang sama:

| Platform | Teknologi | Output |
|---|---|---|
| Desktop (Windows) | Electron | `dist/AdFree Music Setup <versi>.exe` |
| Android / Android TV | WebView + foreground service | `android/app/build/outputs/apk/` |

## Fitur

- **Blokir iklan dua lapis** — engine network [@ghostery/adblocker-electron](https://github.com/ghostery/adblocker) (desktop) / filter domain+URL (Android), plus pemangkas `adPlacements` dari respons YouTube dan peloncat iklan (mute + skip) sebagai lapis cadangan.
- **Lirik real-time** — panel lirik tersinkronisasi waktu dengan sumber [LRCLIB](https://lrclib.net), ketuk baris untuk lompat, geser offset ±.
- **Kontrol pemutar** — media key, tray (Windows), notifikasi media + lockscreen (Android), tombol putar/jeda/next/prev.
- **Pindah situs sekali klik** — YouTube ↔ YouTube Music, situs terakhir diingat.
- **Android TV** — navigasi D-pad/remote, menu aplikasi via tombol Menu/Info atau tahan Back, panel lirik besar di sisi kanan.
- **Tutup ke tray** — musik tetap jalan saat jendela ditutup (opsional, default aktif).

## Struktur project

```
├── src/                  # Aplikasi Electron (desktop)
│   ├── main.js           # Main process: jendela, tray, menu, adblock, IPC
│   └── preload.js        # Preload: jembatan halaman YouTube ↔ main process
├── shared/
│   └── adfree-core.js    # Logika inti lintas platform (iklan, lirik, TV D-pad)
├── android/              # Aplikasi Android (Java, WebView)
│   └── app/src/main/java/com/fadlan/adfreemusic/
│       ├── MainActivity.java   # WebView, intent, menu TV, remote handling
│       ├── MusicService.java   # Foreground service + notifikasi media
│       ├── PlayerBridge.java   # Kontrol notifikasi → WebView
│       └── AdBlocker.java      # Filter request berbasis domain/URL
└── dist/                 # Hasil build desktop (tidak di-commit)
```

`shared/adfree-core.js` dipakai bersama: di desktop via `require()` di preload, di Android di-concat ke dalam asset `inject.js` saat runtime.

## Menjalankan & build

### Desktop (Windows)

```bash
npm install
npm start          # jalankan app
npm run dist       # build installer NSIS
```

### Android

```bash
cd android
./gradlew assembleDebug    # APK debug siap pasang
./gradlew assembleRelease  # APK release (keystore release bila tersedia, fallback debug key)
```

Buka folder `android/` di Android Studio jika ingin build dari IDE. `minSdk 26`, `targetSdk 35`.

### Test

```bash
npm test   # unit test helper inti (parseLrc, cleanTitle, cleanArtist, findLyrics)
```

Test memakai `node:test` bawaan Node (tanpa dependency tambahan) dan berjalan tanpa
jaringan — `fetchJson` di-mock. Helper murni diekspor dari `shared/adfree-core.js`
lewat `_internal` khusus untuk keperluan testing.

## Versi & signing

**Satu sumber versi**: nomor versi diatur hanya di [`package.json`](package.json).

- Desktop Electron otomatis memakai `version` dari sana.
- Android membaca file yang sama saat build Gradle: `versionName` = versi tersebut,
  `versionCode` dihitung dari semver (`1.3.0` → `10300`), jadi selalu naik tiap rilis.
- String `User-Agent` di kedua app (fetch lirik LRCLIB) ikut versi asli secara dinamis.

Naikkan versi dengan mengedit `version` di `package.json`, lalu build ulang kedua platform.

**Keystore release Android** ada di `android/keystore/release.keystore`, konfigurasinya di
`android/keystore.properties` — keduanya **tidak di-commit** (lihat `android/.gitignore`).
Tanpa file tersebut build tetap jalan dan APK release ditandatangani debug key (sideload).

> Simpan backup keystore + password di tempat aman. Kehilangan keystore berarti tidak bisa
> mengirim update ke pengguna yang sudah memasang APK lama (Android menolak update dengan
> signature berbeda).

## Catatan

- Proyek pribadi, **tidak berafiliasi dengan Google/YouTube**.
- Login Google berjalan di session terpisah (`persist:ytmusic`) dengan user-agent Chrome.
- Mengubah pengaturan adblock dari menu memuat ulang halaman — skrip pemangkas iklan harus jalan sebelum skrip YouTube.
