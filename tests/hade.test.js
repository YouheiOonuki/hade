// 5000兆円欲しい館（yorozu-plans ROADMAP 7.46.1 K180、企画書 89、ACCEPTANCE「K180」）のテスト: node --test tests/hade.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../engine.js');
const R = require('../roulette/app.js');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SCRIPT = JSON.parse(read('scripts/roulette.json'));
const NG = JSON.parse(read('ng-words.json'));
const NG_WORDS = Object.values(NG.categories).flat();
const strip = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const PAGES = ['index.html', 'roulette/index.html'];
// 画面に出る文（コメントとビーコンの script を除いた HTML）
const shownHtml = (f) => read(f).replace(/<!--[\s\S]*?-->/g, '').replace(/<script[^>]*cloudflareinsights[^>]*><\/script>/g, '');
// 台本の中で画面に出る文（note・href・型の名前を除く）
function scriptTexts(script) {
  const out = [];
  for (const v of Object.values(script.variants)) for (const s of v.scenes) for (const [k, val] of Object.entries(s)) if (typeof val === 'string' && !['type', 'href'].includes(k)) out.push(val);
  return out;
}

test('台本: 3 本、型・場面 3 つまで・ためは 3 秒まで・一言 20 字以内・点滅の周期・最後は決め・偽の警告の語が無い', () => {
  assert.deepEqual(H.validate(SCRIPT).errors, []);
  assert.equal(Object.keys(SCRIPT.variants).length, 3);
  const bad = { variants: { x: { scenes: [{ type: 'drumroll', ms: 3500, flashMs: 200 }, { type: 'gougai', ms: 100, head: '今すぐクリックしてください' }, { type: 'cm', ms: 100 }, { type: 'slot', ms: 100 }, { type: 'finale', line: 'あ'.repeat(21) }] }, y: { scenes: [{ type: 'fakeError', ms: 100 }] } } };
  const e = H.validate(bad).errors.join(' / ');
  for (const re of [/場面が多い/, /ためが長い/, /点滅が速い/, /偽の警告/, /決めの一言/, /最後は finale/, /型 fakeError/]) assert.match(e, re);
  assert.ok(H.FLASH_MIN_MS >= 334, '1 秒に 3 回まで');
});

test('D313: 偽エラー・再起動・確認の場面を持たない（年末調整のド派手版とともに消した）', () => {
  assert.deepEqual(H.TYPES, ['drumroll', 'slot', 'gougai', 'cm', 'finale']);
  assert.doesNotMatch(strip(read('engine.js')), /fakeError|reboot|confirm|blurYen/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'nenmatsu')), '/hade/nenmatsu/ は消して root の _redirects で /hade/ へ 301');
});

test('台本の文に禁止語が無い（ng-words.json）', () => {
  for (const t of scriptTexts(SCRIPT)) for (const w of NG_WORDS) assert.ok(!t.includes(w), `「${t}」に「${w}」`);
});

test('視差効果を減らす設定なら決めの画面だけ。そうでなければ台本どおり', () => {
  for (const v of Object.keys(SCRIPT.variants)) {
    assert.deepEqual(H.plan(SCRIPT, v, { reduced: true }).map((s) => s.type), ['finale']);
    assert.equal(H.plan(SCRIPT, v, {}).length, SCRIPT.variants[v].scenes.length);
  }
});

test('当たりはまじめなルーレットと同じ: 同じ種なら pick.js の pickMultiple を直接呼んだ当たりと一致', (t) => {
  const libFile = path.join(ROOT, '..', 'web-roulette', 'pick.js');
  if (!fs.existsSync(libFile)) { t.skip('web-roulette が隣に無い'); return; }
  const P = require(libFile);
  const text = 'カレー\nラーメン\n寿司\n焼肉\nパスタ\n';
  const names = P.parseText(text, 'newline');
  for (const [seed, count] of [[1, 1], [42, 2], [7, 5], [99, 9]]) {
    const h = R.draw(P, text, count, P.seeded(seed));
    const direct = P.pickMultiple(names.map((name) => ({ name, weight: 1 })), Math.min(count, R.COUNT_MAX), false, P.seeded(seed)).map((r) => r.candidate.name);
    assert.equal(h.ok, true);
    assert.deepEqual(h.winners, direct, `seed ${seed}`);
  }
  assert.equal(R.draw(P, 'ひとつ', 1, Math.random).ok, false, '候補 1 つでは回さない');
});

test('共有の画像に当たりの名前は既定で入らない（選んだときだけ）。URL に値を入れない', () => {
  const res = { winners: ['たろう', 'はなこ'] };
  const f = SCRIPT.variants.gougai.scenes.at(-1);
  assert.doesNotMatch(JSON.stringify(R.shareLines(f, res, false)), /たろう|はなこ/);
  assert.match(R.shareLines(f, res, true).win, /たろう、はなこ/);
  const js = read('roulette/app.js');
  assert.match(js, /var SHARE_URL = 'https:\/\/yorozu-craft\.com\/hade\/roulette\/\?from=share-roulette';/);
  const intent = js.split('\n').find((l) => l.includes('intent/post'));
  assert.doesNotMatch(intent, /winner|names/);
  assert.match(js, /shareImage\(shareLines\(f, res, cb\.checked\), note\)/, 'チェックの状態だけで決める');
  assert.doesNotMatch(js, /cb\.checked = true|checked: true/);
});

test('禁止の挙動が無い（本物の窓・閉じる確認・履歴の書き換え・止まらない繰り返し）。抽選を写していない。保存しない', () => {
  for (const f of ['engine.js', 'roulette/app.js']) {
    const js = strip(read(f));
    assert.doesNotMatch(js, /window\.open|\bopen\(|beforeunload|onbeforeunload|history\.(pushState|replaceState|go|back)|while\s*\(\s*true|for\s*\(\s*;\s*;|location\.(href\s*=|assign|replace)|requestFullscreen/, f);
    assert.doesNotMatch(js, /pool\.push|remaining\.splice|16807/, f + ': 抽選の写し');
    assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie/, f + ': 保存しない');
  }
  assert.equal((strip(read('roulette/app.js')).match(/fetch\(/g) || []).length, 1, 'fetch は自分の台本を読む 1 か所だけ');
  assert.match(read('roulette/app.js'), /fetch\('\.\.\/scripts\/roulette\.json'\)/);
});

test('ページ: 広告なし・noindex でない・sitemap にある・英語版なし・まじめな版の lib を同じ URL で読む', () => {
  const sm = read('sitemap.xml');
  for (const [f, url] of [['index.html', 'https://yorozu-craft.com/hade/'], ['roulette/index.html', 'https://yorozu-craft.com/hade/roulette/']]) {
    const html = read(f);
    assert.doesNotMatch(html, /adsbygoogle|googlesyndication/, f);
    assert.doesNotMatch(html, /noindex/, f);
    assert.doesNotMatch(html, /hreflang/, f);
    assert.ok(sm.includes(`<loc>${url}</loc>`), f);
    if (f !== 'index.html') assert.match(html, /まじめな版/, f + ': まじめな版への道');
  }
  const page = read('roulette/index.html');
  assert.ok(page.includes('<script src="/web-roulette/pick.js"></script>'));
  assert.ok(page.indexOf('/web-roulette/pick.js') < page.indexOf('../engine.js'));
});

test('D311: 入力欄・ログインの偽装をしない、他社・Cloudflare・銀行・役所の名前を出さない', () => {
  const shown = [JSON.stringify(SCRIPT), strip(read('engine.js')), strip(read('roulette/app.js')), ...PAGES.map(shownHtml)];
  for (const t of shown) {
    assert.doesNotMatch(t, /type="(password|email|tel)"|パスワード|ログイン|サインイン|暗証/, '入力欄・ログインの偽装');
    assert.doesNotMatch(t, /Cloudflare|Microsoft|Windows|Google|Apple|銀行|国税庁|税務署|市役所|区役所|役場/, '他社・役所の名前');
  }
  // 演出（エンジンと台本）は入力欄を作らない
  assert.doesNotMatch(strip(read('engine.js')) + JSON.stringify(SCRIPT), /<input|<form/);
});

test('点滅と音: CSS の点滅は 340ms 以上、視差効果を減らす設定で止める（紙吹雪も出さない）。音は既定で無音。「飛ばす」常時', () => {
  const css = read('style.css');
  const m = css.match(/animation:\s*hade-flash\s+(\d+)ms/);
  assert.ok(m && Number(m[1]) >= H.FLASH_MIN_MS, m && m[1]);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*hade-spot[\s\S]*animation: none[\s\S]*\.hade-confetti \{ display: none; \}/);
  assert.match(read('engine.js'), /var audio = \{ on: false, ctx: null \};/);
  assert.match(read('engine.js'), /var skip = el\('button', 'hade-skip', '×'\);/);
});

test('D321 ワードアート: 館の見出し・決めの画面・共有の画像の 3 か所だけ。帯と文字の明るさの比 4.5:1 以上。点滅しない。まじめな版には無い', () => {
  const W = require('../wordart.js');
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.ok(ratio(W.FILL, W.BAND) >= 4.5, String(ratio(W.FILL, W.BAND)));
  const css = read('style.css');
  const rule = css.match(/\.wordart \{[^}]*\}/)[0];
  assert.match(rule, /background: #1b1464; color: #ffe600/);
  assert.doesNotMatch(rule, /animation/);
  for (const f of ['index.html', 'roulette/index.html']) assert.match(read(f), /<h1 class="wordart">/, f + ': 見出し');
  assert.match(read('roulette/app.js'), /'hade-finale-head wordart'/, '決めの画面');
  for (const f of ['roulette/app.js']) assert.match(read(f), /root\.Wordart\.draw\(g, /, f + ': 共有の画像');
  const serious = path.join(ROOT, '..', 'web-roulette', 'index.html');
  if (fs.existsSync(serious)) assert.doesNotMatch(fs.readFileSync(serious, 'utf8'), /wordart/i, 'まじめな版には入れない');
});

test('D324（とオーナー 2026-10-11）: 館の説明の文も「※演出です」も無い。「まじめな版」1 つだけ。「飛ばす」は小さな ×', () => {
  const shownText = (f) => read(f).replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, '');
  for (const f of ['index.html', 'roulette/index.html']) {
    const t = shownText(f);
    assert.doesNotMatch(t, /演出が苦手|使い方|視差効果|大げさに決める|別館です|ための/, f);
    assert.doesNotMatch(t, /※演出です/, f);
    assert.doesNotMatch(t, /class="subtitle"/, f);
  }
  assert.equal((shownText('roulette/index.html').match(/まじめな版/g) || []).length, 1);
  assert.doesNotMatch(strip(read('roulette/app.js')), /まじめな版/, '決めの画面にも出さない');
  assert.match(read('engine.js'), /var skip = el\('button', 'hade-skip', '×'\);/);
  assert.match(read('engine.js'), /skip\.setAttribute\('aria-label', '飛ばす'\)/);
});

test('D326: 全然違うやつメーカーは消した（/hade/chigau/ は root の _redirects で /hade/ へ）', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'chigau')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'scripts', 'chigau.json')));
  assert.doesNotMatch(read('sitemap.xml') + read('index.html'), /chigau/);
});

test('K180 第 2 版（3D の盤）: three.js と LICENSE が vendor に。盤の JS は押してから import()。WebGL 無し・視差効果を減らす設定は 2D。音は押すまで鳴らない', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'vendor', 'three', 'three.module.min.js')));
  assert.match(read('vendor/three/LICENSE'), /MIT License/);
  const html = read('roulette/index.html');
  assert.doesNotMatch(html, /board3d|three/, '初回の HTML は盤を読まない');
  const js = strip(read('roulette/app.js'));
  assert.match(js, /import\('\.\/board3d\.js'\)/);
  assert.ok(js.indexOf("import('./board3d.js')") > js.indexOf("$('form').addEventListener('submit'"), '回すを押してから読む');
  assert.match(js, /prefers-reduced-motion: reduce\)'\)\.matches\) return false/);
  assert.match(js, /getContext\('webgl2'\) \|\| c\.getContext\('webgl'\)/);
  assert.match(js, /\.then\(function \(\) \{ play2d\(rest\); \}, function \(\) \{ play2d\(script\); \}\);/, '読めない・描けないときは 2D');
  assert.match(read('engine.js'), /var audio = \{ on: false, ctx: null \};/, '既定は無音');
  assert.ok(js.indexOf('H.audio.on = true') > js.indexOf("$('form').addEventListener('submit'"), '音は回すを押した後');
  const b3 = strip(read('roulette/board3d.js'));
  assert.match(b3, /from '\.\.\/vendor\/three\/three\.module\.min\.js'/, 'CDN を使わない');
  assert.match(b3, /CONFETTI_MAX = 300/);
  assert.match(b3, /setPixelRatio\(Math\.min\(2, window\.devicePixelRatio \|\| 1\)\)/);
  // 初回の JS（盤を押す前）は 1 MB 以内。盤を読んだ後も gzip で 300 KB 以内
  const zlib = require('node:zlib');
  const first = ['../web-roulette/pick.js', 'engine.js', 'wordart.js', 'roulette/app.js'].map((f) => fs.readFileSync(path.join(ROOT, f)));
  const firstBytes = first.reduce((n, b) => n + b.length, 0);
  const all = [...first, fs.readFileSync(path.join(ROOT, 'roulette/board3d.js')), fs.readFileSync(path.join(ROOT, 'vendor/three/three.module.min.js'))];
  const gz = all.reduce((n, b) => n + zlib.gzipSync(b).length, 0);
  assert.ok(firstBytes < 1024 * 1024, String(firstBytes));
  assert.ok(gz < 300 * 1024, `gzip ${gz}`);
});

test('K180 第 2 版: 盤は抽選の当たりの扇形で止まる（角度の式。画面で 4・6・10 で確かめた形）', async () => {
  const { targetAngle } = await import('../roulette/board3d.js');
  for (const n of [2, 4, 6, 10, 30]) for (let i = 0; i < n; i++) {
    const step = (Math.PI * 2) / n;
    const a = targetAngle(i, n, 7);
    // 盤の角度 0 のとき扇形 i の真ん中は (i+0.5)*step − π/2。回した後の真ん中が針（π/2）に来る
    const mid = ((i + 0.5) * step - Math.PI / 2 + a) % (Math.PI * 2);
    assert.ok(Math.abs(mid - Math.PI / 2) < 1e-9, `${i}/${n}`);
    assert.ok(a > 6 * Math.PI * 2, '十分に回ってから止まる');
  }
});

test('段 2 の 7（ROADMAP 7.60）: 盤を最初から見せる（入力は盤の下）。入口にも盤。2D の盤は wheel.js、色は 3D と同じ 1 か所。盤から当たりを決めない', async () => {
  const page = read('roulette/index.html');
  assert.ok(page.indexOf('data-hade-wheel="items"') > 0 && page.indexOf('data-hade-wheel="items"') < page.indexOf('id="items"'), '盤は候補の欄より上');
  assert.ok(page.indexOf('id="go"') < page.indexOf('id="items"'), '回すは盤のすぐ下、入力はその下');
  assert.match(page, /<script type="module" src="\.\.\/wheel\.js"><\/script>/);
  assert.match(read('index.html'), /class="hade-door"[^>]*><span class="hade-wheel" data-hade-wheel aria-hidden="true">/, '入口の盤');
  assert.match(strip(read('roulette/board3d.js')), /import \{ COLORS \} from '\.\.\/wheel\.js'/, '3D の盤も同じ色');
  assert.doesNotMatch(strip(read('roulette/board3d.js')), /const COLORS =/, '色を写さない');
  const w = strip(read('wheel.js'));
  assert.doesNotMatch(w, /pickMultiple|Math\.random|innerHTML/, '当たりを決めない・入れた字を HTML にしない');
  const { sectorPath, COLORS } = await import('../wheel.js');
  assert.equal(COLORS.length, 8);
  assert.equal(sectorPath(0, 4, 100), 'M0 0L0.00 -100.00A100 100 0 0 1 100.00 0.00Z', '扇形 0 は上から時計回り');
  assert.match(read('style.css'), /prefers-reduced-motion: reduce\) \{ \.hade-wheel-spin \{ animation: none; \} \}/);
});
