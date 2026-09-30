// Helper murni tanpa DOM — dipakai initAdFree dan diekspor untuk unit test
// (lihat _internal di index.js). fetchJson selalu dilempar sebagai argumen.

const JUNK = /\b(official|video|audio|lyrics?|lirik|mv|m\/v|visuali[sz]er|hd|hq|4k|remaster(ed)?|explicit|clean|color coded|performance)\b/i;

export function cleanTitle(t) {
  return t
    .replace(/[(\[[\u3010][^)\]\u3011]*[)\]\u3011]/g, (m) => (JUNK.test(m) ? '' : m))
    .replace(/\s+(ft\.?|feat\.?|featuring)\s.*$/i, '')
    .replace(/\s*\|.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanArtist(a) {
  return a.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/\s+(ft\.?|feat\.?)\s.*$/i, '').trim();
}

export function parseLrc(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    // Fraksi desimal boleh titik, koma, atau titik dua (beda-beda tiap generator LRC).
    const tags = [...raw.matchAll(/\[(\d+):(\d+(?:[.,:]\d+)?)\]/g)];
    if (!tags.length) continue;
    const words = raw.replace(/\[[^\]]*\]/g, '').trim();
    // Normalisasi desimal: koma atau titik dua (mis. [00:12,5] / [00:12:5]) -> titik.
    for (const t of tags) out.push({ t: +t[1] * 60 + parseFloat(t[2].replace(/[:,]/, '.')), text: words });
  }
  return out.sort((a, b) => a.t - b.t);
}

const LRCLIB = 'https://lrclib.net/api';

// Rantai pencarian LRCLIB: /get eksak -> /search per artis -> loose search.
// Memilih hasil synced dengan durasi terdekat (toleransi 6 dtk), fallback plain.
export async function findLyrics(fetchJson, track) {
  const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const firstArtist = track.artist.split(/\s*(?:,|&| x | and | dan )\s*/i)[0];
  if (track.artist) {
    const exact = await fetchJson(`${LRCLIB}/get?` + q({ track_name: track.title, artist_name: track.artist, duration: track.duration }));
    if (exact && (exact.syncedLyrics || exact.plainLyrics)) return exact;
  }
  const results = (await fetchJson(`${LRCLIB}/search?` + q({ track_name: track.title, artist_name: firstArtist }))) || [];
  let list = Array.isArray(results) ? results : [];
  if (!list.length) {
    const loose = await fetchJson(`${LRCLIB}/search?` + q({ q: `${track.title} ${firstArtist}`.trim() }));
    list = Array.isArray(loose) ? loose : [];
  }
  const diff = (r) => (track.duration && r.duration ? Math.abs(r.duration - track.duration) : 0);
  const synced = list.filter((r) => r.syncedLyrics && diff(r) <= 6).sort((a, b) => diff(a) - diff(b));
  return synced[0] || list.find((r) => r.syncedLyrics && !track.duration) || list.find((r) => r.plainLyrics) || null;
}
