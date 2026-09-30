// Membundel shared/src/core/ (ES modules) menjadi shared/adfree-core.js —
// file tunggal yang dipakai tiga tempat:
//   - preload desktop: require('../shared/adfree-core.js') (di-inline esbuild preload)
//   - Android: concat ke asset inject.js (dievaluasi sebagai script di main world)
//   - unit test Node: module.exports
// Guard di footer memilih jalur ekspor yang tepat untuk masing-masing.
// Jalankan: npm run build:core (juga otomatis via pretest/prestart/predist).
const esbuild = require('esbuild');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const BANNER = '/* GENERATED FILE — jangan edit langsung. Sumber: shared/src/core/*.js (npm run build:core) */';

// catatan: index.js mengekspor api sebagai `default`; guard di bawah membongkar
// namespace ESM agar require() dan window.__adfreeCore mendapat objek api langsung
// ({pruneAds, initAdFree, _internal}) — kontrak yang sama dengan versi lama.
const FOOTER = [
  'const __adfreeApi = __adfreeCoreApi.default || __adfreeCoreApi;',
  'if (typeof module !== "undefined" && module.exports) {',
  '  module.exports = __adfreeApi;',
  '} else {',
  '  window.__adfreeCore = __adfreeApi;',
  '}',
].join('\n');

(async () => {
  const result = await esbuild.build({
    entryPoints: [join(__dirname, 'src/core/index.js')],
    bundle: true,
    format: 'iife',
    globalName: '__adfreeCoreApi',
    target: 'es2020',
    minify: false,
    write: false,
    banner: { js: BANNER },
    footer: { js: FOOTER },
    logLevel: 'warning',
  });
  const js = result.outputFiles[0].text;
  writeFileSync(join(__dirname, 'adfree-core.js'), js, 'utf8');
  console.log('build-core: shared/adfree-core.js tertulis (' + js.length + ' bytes)');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
