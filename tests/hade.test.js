// あほらし館（yorozu-plans ROADMAP 7.46.1 K180、企画書 89、ACCEPTANCE「K180」）のテスト: node --test tests/hade.test.js
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
  return out.concat(script.noticeTail || []);
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

test('ページ: 「※演出です」常時・広告なし・noindex でない・sitemap にある・英語版なし・まじめな版の lib を同じ URL で読む', () => {
  const sm = read('sitemap.xml');
  for (const [f, url] of [['index.html', 'https://yorozu-craft.com/hade/'], ['roulette/index.html', 'https://yorozu-craft.com/hade/roulette/']]) {
    const html = read(f);
    assert.ok(html.includes('※演出です'), f);
    assert.doesNotMatch(html, /adsbygoogle|googlesyndication/, f);
    assert.doesNotMatch(html, /noindex/, f);
    assert.doesNotMatch(html, /hreflang/, f);
    assert.ok(sm.includes(`<loc>${url}</loc>`), f);
    assert.match(html, /まじめな/, f + ': まじめな版への道');
  }
  const page = read('roulette/index.html');
  assert.ok(page.includes('<script src="/web-roulette/pick.js"></script>'));
  assert.ok(page.indexOf('/web-roulette/pick.js') < page.indexOf('../engine.js'));
  assert.ok(SCRIPT.noticeTail && strip(read('engine.js')).includes("'※演出です' + (script.noticeTail || '')"), '演出の舞台にも常時');
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
  assert.match(read('engine.js'), /var skip = el\('button', 'hade-skip', '飛ばす ▶▶'\);/);
});
