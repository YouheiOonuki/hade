// ド派手版（yorozu-plans ROADMAP 7.39.1 K170、企画書 86、ACCEPTANCE「K170」）のテスト: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../engine.js');
const { resultOf } = require('../nenmatsu/app.js');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SCRIPT = JSON.parse(read('scripts/nenmatsu.json'));
const strip = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

test('台本: 型・長さ（1 場面 6 秒・全体 30 秒まで）・点滅の周期・最後は決め・人を動かす偽の警告の語が無い', () => {
  const v = H.validate(SCRIPT);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(Object.keys(SCRIPT.variants).sort(), ['even', 'owe', 'refund']);
  const bad = { variants: { x: { scenes: [{ type: 'drumroll', ms: 7000, flashMs: 200 }, { type: 'fakeError', ms: 100, body: '今すぐクリックしてください' }] } } };
  const e = H.validate(bad).errors.join(' / ');
  assert.match(e, /最後は finale/); assert.match(e, /長すぎる/); assert.match(e, /点滅が速い/); assert.match(e, /偽の警告/);
  assert.ok(H.FLASH_MIN_MS >= 334, '1 秒に 3 回まで');
});

test('視差効果を減らす設定なら決めの画面だけ。そうでなければ台本どおり', () => {
  assert.deepEqual(H.plan(SCRIPT, 'refund', { reduced: true }).map((s) => s.type), ['finale']);
  assert.equal(H.plan(SCRIPT, 'refund', {}).length, SCRIPT.variants.refund.scenes.length);
});

test('共有の金額のぼかし（既定）: 1 万円以上は「N 万円台」、未満は「1 万円未満」', () => {
  assert.equal(H.blurYen(32400), '3万円台');
  assert.equal(H.blurYen(-128000), '12万円台');
  assert.equal(H.blurYen(9999), '1万円未満');
  assert.equal(H.yen(1234567), '1,234,567円');
  assert.equal(H.fill('還付 {amount}', { amount: '1円' }), '還付 1円');
});

test('数字はまじめな版と同じ: lib の calc を直接呼んだ diff と、決めの画面の値（resultOf）が一致', (t) => {
  const libDir = path.join(ROOT, '..', 'seido-keisan', 'lib');
  if (!fs.existsSync(libDir)) { t.skip('seido-keisan が隣に無い'); return; }
  const N = require(path.join(libDir, 'nenmatsu.js'));
  const TAX = require(path.join(libDir, 'tax2026.js'));
  const cases = [
    { income: 5000000, withheld: 120000, shakai: 720000 },
    { income: 5000000, withheld: 60000, shakai: 720000, seimei: { newIppan: 100000 } },
    { income: 3500000, withheld: 80000, shakai: 500000, spouse: { has: true, incomeType: 'kyuyo', amount: 1000000 }, jutaku: 150000 },
    { income: 25000000, withheld: 1, shakai: 0 },
  ];
  let seen = new Set();
  for (const c of cases) {
    const r = N.calc(c, TAX.CURRENT);
    const h = resultOf(N, TAX, c);
    if (!r.ok) { assert.equal(h.ok, false); assert.equal(h.message, r.message); seen.add('error'); continue; }
    assert.equal(h.diff, r.diff);
    assert.equal(h.abs, Math.abs(r.diff));
    assert.equal(h.variant, r.diff > 0 ? 'refund' : r.diff < 0 ? 'owe' : 'even');
    assert.equal(h.source.url, TAX.years[TAX.CURRENT].SOURCES[0].url, '出典もまじめな版の値');
    seen.add(h.variant);
  }
  assert.ok(seen.has('refund') && seen.has('owe') && seen.has('error'), [...seen].join(','));
});

test('禁止の挙動が無い（本物の窓・閉じる確認・履歴の書き換え・止まらない繰り返し）。計算を写していない', () => {
  for (const f of ['engine.js', 'nenmatsu/app.js']) {
    const js = strip(read(f));
    assert.doesNotMatch(js, /window\.open|\bopen\(|beforeunload|onbeforeunload|history\.(pushState|replaceState|go|back)|while\s*\(\s*true|for\s*\(\s*;\s*;|location\.(href\s*=|assign|replace)|requestFullscreen/, f);
    assert.doesNotMatch(js, /kyuyoShotoku|sokusan|kisoKojo|102\.1|fukkou/, f + ': 計算の写し');
    assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie/, f + ': 保存しない');
  }
  assert.equal((strip(read('nenmatsu/app.js')).match(/fetch\(/g) || []).length, 1, 'fetch は自分の台本（同じサイトの静的ファイル）を読む 1 か所だけ');
  assert.match(read('nenmatsu/app.js'), /fetch\('\.\.\/scripts\/nenmatsu\.json'\)/);
});

test('共有: URL に値を入れない（?from=share-nenmatsu だけ）。画像の金額は既定でぼかす', () => {
  const js = read('nenmatsu/app.js');
  assert.match(js, /var SHARE_URL = 'https:\/\/yorozu-craft\.com\/hade\/nenmatsu\/\?from=share-nenmatsu';/);
  const intent = js.split('\n').find((l) => l.includes('intent/post'));
  assert.doesNotMatch(intent, /abs|yen\(|diff|amount/);
  assert.match(js, /realAmount \? H\.yen\(res\.abs\) : H\.blurYen\(res\.abs\)/);
  assert.match(js, /<input type="checkbox" id="share-real">/, '実額は自分で選んだときだけ');
});

test('ページ: 「※演出です」常時・広告なし・AdSense の結果までは noindex で sitemap なし（D310）・英語版なし・まじめな版の lib を同じ URL で読む', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'sitemap.xml')), 'D310: 結果が出るまで sitemap を持たない');
  for (const f of ['index.html', 'nenmatsu/index.html']) {
    const html = read(f);
    assert.ok(html.includes('※演出です'), f);
    assert.doesNotMatch(html, /adsbygoogle|googlesyndication/, f);
    assert.match(html, /<meta name="robots" content="noindex, follow">/, f);
    assert.doesNotMatch(html, /hreflang/, f);
  }
  const page = read('nenmatsu/index.html');
  for (const lib of ['kyuyo-table-2026.js', 'kyuyo-table-2025.js', 'tax2026.js', 'nenmatsu.js']) assert.ok(page.includes(`<script src="/seido-keisan/lib/${lib}"></script>`), lib);
  assert.ok(page.indexOf('/seido-keisan/lib/nenmatsu.js') < page.indexOf('../engine.js'));
  assert.match(page, /まじめな版/);
  assert.ok(strip(read('engine.js')).includes("'※演出です（中身の計算はまじめな版と同じ）'"), '演出の舞台にも常時');
});

test('D311: 入力欄・ログインの偽装をしない、他社・Cloudflare・銀行・役所の名前を出さない', () => {
  // 画面に出る文（台本・エンジン・ページの JS と、コメントとビーコンの script を除いた HTML）
  const shown = [JSON.stringify(SCRIPT), strip(read('engine.js')), strip(read('nenmatsu/app.js')),
    ...['index.html', 'nenmatsu/index.html'].map((f) => read(f).replace(/<!--[\s\S]*?-->/g, '').replace(/<script[^>]*cloudflareinsights[^>]*><\/script>/g, ''))];
  for (const t of shown) {
    assert.doesNotMatch(t, /type="(password|email|tel)"|パスワード|ログイン|サインイン|暗証/, '入力欄・ログインの偽装');
    assert.doesNotMatch(t, /Cloudflare|Microsoft|Windows|Google|Apple|銀行|国税庁|税務署|市役所|区役所|役場/, '他社・役所の名前');
  }
  // 演出（エンジンと台本）は入力欄を作らない。入力欄はまじめな計算の欄と共有のチェックだけ
  assert.doesNotMatch(strip(read('engine.js')) + JSON.stringify(SCRIPT), /<input|<form/);
});

test('点滅と音: CSS の点滅は 340ms 以上、視差効果を減らす設定で止める。音は既定で無音', () => {
  const css = read('style.css');
  const m = css.match(/animation:\s*hade-flash\s+(\d+)ms/);
  assert.ok(m && Number(m[1]) >= H.FLASH_MIN_MS, m && m[1]);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*hade-spot[\s\S]*animation: none/);
  assert.match(read('engine.js'), /var audio = \{ on: false, ctx: null \};/);
  assert.match(read('engine.js'), /var skip = el\('button', 'hade-skip', '飛ばす ▶▶'\);/, '「飛ばす」常時');
});
