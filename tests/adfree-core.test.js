// Unit test untuk helper murni di shared/adfree-core.js (diekspor lewat _internal).
// Jalankan: npm test
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { _internal } = require('../shared/adfree-core.js');
const { cleanTitle, cleanArtist, parseLrc, findLyrics } = _internal;

// ---------------------------------------------------------------------------
// cleanTitle
// ---------------------------------------------------------------------------
describe('cleanTitle', () => {
  test('membuang tag dalam kurung seperti (Official Video)', () => {
    assert.equal(cleanTitle('Sandiwaramu Luar Biasa (Official Video)'), 'Sandiwaramu Luar Biasa');
  });

  test('membuang [Official Lyric Video] dan (HD / 4K / Remastered)', () => {
    assert.equal(cleanTitle('Song [Official Lyric Video] (4K)'), 'Song');
    assert.equal(cleanTitle('Song (Remastered 2020)'), 'Song');
  });

  test('membuang feats di akhir judul', () => {
    assert.equal(cleanTitle('Song ft. Someone'), 'Song');
    assert.equal(cleanTitle('Song feat. Someone Else'), 'Song');
    assert.equal(cleanTitle('Song featuring X'), 'Song');
  });

  test('membuang bagian setelah pipa |', () => {
    assert.equal(cleanTitle('Song | Official Channel'), 'Song');
  });

  test('membiarkan kurung non-junk (bukan metadata iklan)', () => {
    assert.equal(cleanTitle('Na - Na (La La La)'), 'Na - Na (La La La)');
    assert.equal(cleanTitle('36 (Tiga Puluh Enam)'), '36 (Tiga Puluh Enam)');
  });

  test('membiarkan karakter lain (apostrof, tanda hubung, unicode)', () => {
    assert.equal(cleanTitle('Jangan’ Menyerelah'), 'Jangan’ Menyerelah');
    assert.equal(cleanTitle('Åh – What A Wonder'), 'Åh – What A Wonder');
  });

  test('membersihkan spasi ganda hasil pembuangan', () => {
    assert.equal(cleanTitle('Song   (Official Video)  (4K)'), 'Song');
  });
});

// ---------------------------------------------------------------------------
// cleanArtist
// ---------------------------------------------------------------------------
describe('cleanArtist', () => {
  test('membuang akhiran "- Topic" dari channel auto-generated', () => {
    assert.equal(cleanArtist('Sheila On 7 - Topic'), 'Sheila On 7');
  });

  test('membuang akhiran VEVO', () => {
    assert.equal(cleanArtist('NoahVEVO'), 'Noah');
    assert.equal(cleanArtist('NoahVEVO'.toLowerCase()), 'noah');
  });

  test('membuang feats di akhir nama artis', () => {
    assert.equal(cleanArtist('Artist A ft. Artist B'), 'Artist A');
    assert.equal(cleanArtist('Artist A feat Artist B'), 'Artist A');
  });

  test('membiarkan nama normal', () => {
    assert.equal(cleanArtist('Dewa 19'), 'Dewa 19');
  });
});

// ---------------------------------------------------------------------------
// parseLrc
// ---------------------------------------------------------------------------
describe('parseLrc', () => {
  test('mem-parse timestamp dasar menit:detik.persepuluh', () => {
    const lines = parseLrc('[00:12.5]Halo dunia');
    assert.equal(lines.length, 1);
    assert.equal(lines[0].t, 12.5);
    assert.equal(lines[0].text, 'Halo dunia');
  });

  test('mem-parse persepuluh dengan koma atau titik', () => {
    assert.equal(parseLrc('[01:02,3]x')[0].t, 62.3);
    assert.equal(parseLrc('[01:02.34]x')[0].t, 62.34);
  });

  test('mendukung beberapa timestamp untuk satu baris (repeat)', () => {
    const lines = parseLrc('[00:10.0][01:10.0]Reff');
    assert.deepEqual(lines, [
      { t: 10, text: 'Reff' },
      { t: 70, text: 'Reff' },
    ]);
  });

  test('mengabaikan tag metadata id3 dan baris kosong', () => {
    const lines = parseLrc('[ti:Judul Lagu]\n[ar:Artis]\n[00:01.0]Lirik\n\n[00:02.0]Lanjut');
    assert.deepEqual(lines, [
      { t: 1, text: 'Lirik' },
      { t: 2, text: 'Lanjut' },
    ]);
  });

  test('baris tanpa timestamp dilewati', () => {
    assert.deepEqual(parseLrc('tanpa timestamp\n[00:05.0]ada'), [{ t: 5, text: 'ada' }]);
  });

  test('hasil terurut naik meski file tidak berurutan', () => {
    const lines = parseLrc('[00:20.0]kedua\n[00:10.0]pertama\n[00:30.0]ketiga');
    assert.deepEqual(lines.map((l) => l.text), ['pertama', 'kedua', 'ketiga']);
  });

  test('menghasilkan array kosong untuk teks tanpa timestamp', () => {
    assert.deepEqual(parseLrc('halo\n dunia'), []);
  });
});

// ---------------------------------------------------------------------------
// findLyrics (fetchJson di-mock, tidak ada network sungguhan)
// ---------------------------------------------------------------------------
describe('findLyrics', () => {
  const track = { title: 'Laskar Pelangi', artist: 'Nidji', duration: 249 };

  test('prioritas: /get eksak dengan artis & durasi', async () => {
    const exact = { syncedLyrics: '[00:01.0]eksak', plainLyrics: 'eksak' };
    const calls = [];
    const fetchJson = async (url) => {
      calls.push(url);
      return url.includes('/get?') ? exact : [];
    };
    const res = await findLyrics(fetchJson, track);
    assert.equal(res, exact);
    assert.ok(calls[0].includes('/get?'));
    assert.ok(calls[0].includes('track_name=Laskar%20Pelangi'));
    assert.ok(calls[0].includes('artist_name=Nidji'));
    assert.ok(calls[0].includes('duration=249'));
  });

  test('fallback ke /search lalu memilih hasil synced dengan durasi terdekat', async () => {
    const near = { syncedLyrics: '[00:01.0]dekat', duration: 251 };
    const far = { syncedLyrics: '[00:01.0]jauh', duration: 400 };
    const plain = { plainLyrics: 'plain', duration: 249 };
    const fetchJson = async (url) => (url.includes('/get?') ? null
      : url.includes('/search?') ? [far, plain, near] : []);
    const res = await findLyrics(fetchJson, track);
    assert.equal(res, near);
  });

  test('artis multiple: pakai artis pertama untuk pencarian', async () => {
    const multi = { syncedLyrics: '[00:01.0]multi', duration: 249 };
    const urls = [];
    const fetchJson = async (url) => {
      urls.push(url);
      return url.includes('/get?') ? null : [multi];
    };
    const res = await findLyrics(fetchJson, { ...track, artist: 'Nidji, Gita Gutawa' });
    assert.equal(res, multi);
    const searchUrl = urls.find((u) => u.includes('/search?'));
    assert.ok(searchUrl.includes('artist_name=Nidji'));
    assert.ok(!searchUrl.includes('Gita'));
  });

  test('hasil synced dengan durasi menyimpang >6 detik ditolak (tanpa kandidat lain -> null)', async () => {
    const off = { syncedLyrics: '[00:01.0]meleset', duration: 260 }; // |260-249| = 11 > 6
    const fetchJson = async (url) => (url.includes('/get?') ? null : [off]);
    const res = await findLyrics(fetchJson, track);
    assert.equal(res, null);
  });

  test('tanpa synced lolos: kembali ke plain lyrics', async () => {
    const plain = { plainLyrics: 'lirik polos', duration: 249 };
    const fetchJson = async (url) => (url.includes('/get?') ? null : [plain]);
    const res = await findLyrics(fetchJson, track);
    assert.equal(res, plain);
  });

  test('tanpa hasil sama sekali: null', async () => {
    const res = await findLyrics(async () => null, track);
    assert.equal(res, null);
  });

  test('search kosong lalu loose search dengan q', async () => {
    const loose = { syncedLyrics: '[00:01.0]loose', duration: 249 };
    const urls = [];
    const fetchJson = async (url) => {
      urls.push(url);
      if (url.includes('/get?')) return null;
      if (url.includes('artist_name=')) return [];
      return [loose]; // loose search pakai parameter q
    };
    const res = await findLyrics(fetchJson, track);
    assert.equal(res, loose);
    const last = urls[urls.length - 1];
    assert.ok(last.includes('/search?q='));
    assert.ok(last.includes('Laskar%20Pelangi'));
  });

  test('durasi 0/tidak diketahui: ambil synced pertama tanpa filter durasi', async () => {
    const a = { syncedLyrics: '[00:01.0]a', duration: 100 };
    const b = { syncedLyrics: '[00:01.0]b', duration: 999 };
    const fetchJson = async (url) => (url.includes('/get?') ? null : [a, b]);
    const res = await findLyrics(fetchJson, { ...track, duration: 0 });
    assert.equal(res, a);
  });
});
