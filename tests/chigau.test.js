// 全然違うやつメーカー（yorozu-plans ROADMAP 7.46.2 K183、企画書 90、ACCEPTANCE「K183」）のテスト: node --test tests/chigau.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../chigau/app.js');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CARDS = JSON.parse(read('scripts/chigau.json'));
const NG_WORDS = Object.values(JSON.parse(read('ng-words.json')).categories).flat();
const strip = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const len = (s) => Array.from(s).length;

test('札の数と形: 題 50（各 5 組 × 4 語）・違うやつ 150・一言は 20 字以内。重なりなし', () => {
  assert.equal(CARDS.themes.length, 50);
  for (const t of CARDS.themes) {
    assert.ok(len(t.title) >= 1 && len(t.title) <= 8, t.title);
    assert.equal(t.groups.length, 5, t.title);
    const words = t.groups.flat();
    for (const g of t.groups) assert.equal(g.length, 4, t.title);
    assert.equal(new Set(words).size, words.length, t.title + ': 同じ題の中で重なり');
    for (const w of words) assert.ok(len(w) >= 1 && len(w) <= 8, w);
  }
  assert.equal(CARDS.odd.length, 150);
  assert.equal(new Set(CARDS.odd).size, 150, '違うやつに重なり');
  for (const w of CARDS.odd) assert.ok(len(w) >= 1 && len(w) <= 8, w);
  const members = new Set(CARDS.themes.flatMap((t) => t.groups.flat()));
  for (const w of CARDS.odd) assert.ok(!members.has(w), `違うやつ「${w}」が仲間の側にもある`);
  assert.ok(CARDS.lines.length >= 5);
  for (const l of CARDS.lines) assert.ok(len(l) >= 1 && len(l) <= 20, l);
});

test('札に禁止語が無い（ng-words.json と突き合わせ）', () => {
  const all = [...CARDS.themes.flatMap((t) => [t.title, ...t.groups.flat()]), ...CARDS.odd, ...CARDS.lines];
  for (const t of all) for (const w of NG_WORDS) assert.ok(!t.includes(w), `「${t}」に「${w}」`);
});

test('同じ名前なら同じ結果（前後の空白と NFC はそろえる）。もう一回は別の結果。5 つ目が違うやつ', () => {
  const a = C.make(CARDS, 'たろう', 0);
  assert.deepEqual(C.make(CARDS, ' たろう ', 0), a);
  assert.deepEqual(C.make(CARDS, 'が', 0), C.make(CARDS, 'が', 0), 'NFC');
  assert.equal(a.items.length, 5);
  assert.equal(a.items[4], a.odd);
  assert.ok(CARDS.odd.includes(a.odd));
  const titles = new Set([0, 1, 2, 3, 4].map((r) => JSON.stringify(C.make(CARDS, 'たろう', r))));
  assert.ok(titles.size >= 4, 'もう一回で変わる');
  assert.equal(C.make(CARDS, '   ', 0).ok, false);
  // 札が偏りなく選ばれる（名前 2000 個で、題の 9 割以上が 1 回は出る）
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(C.make(CARDS, '名前' + i, 0).title);
  assert.ok(seen.size >= 45, String(seen.size));
});

test('名前を送る・保存するコードが無い（fetch は札のファイル 1 か所だけ）', () => {
  const js = strip(read('chigau/app.js'));
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon|XMLHttpRequest|WebSocket|EventSource/);
  assert.equal((js.match(/fetch\(/g) || []).length, 1);
  assert.match(js, /fetch\('\.\.\/scripts\/chigau\.json'\)/);
  assert.doesNotMatch(js, /location\.(search|hash|href\s*=)|history\./, 'URL に名前を入れない');
  const intent = js.split('\n').find((l) => l.includes('intent/post'));
  assert.doesNotMatch(intent, /name/);
});

test('共有の画像に名前は既定で入らない（選んだときだけ）', () => {
  const res = C.make(CARDS, 'たろう', 0);
  assert.doesNotMatch(JSON.stringify(C.shareLines(res, 'たろう', false)), /たろう/);
  assert.match(C.shareLines(res, 'たろう', true).head, /^たろう の/);
  assert.match(read('chigau/app.js'), /shareLines\(last, \$\('name'\)\.value, \$\('share-name'\)\.checked\)/);
  assert.match(read('chigau/index.html'), /<input type="checkbox" id="share-name">/, '既定はチェックなし');
});

test('ページ: 「※演出です」・広告なし・noindex でない・英語版なし・sitemap にある・あほらし館の一覧にある・まじめな道具への道', () => {
  const html = read('chigau/index.html');
  assert.ok(html.includes('※演出です'));
  assert.doesNotMatch(html, /adsbygoogle|googlesyndication|noindex|hreflang/);
  assert.match(html, /まじめな道具はこちら/);
  assert.ok(read('sitemap.xml').includes('<loc>https://yorozu-craft.com/hade/chigau/</loc>'));
  assert.ok(read('index.html').includes('href="./chigau/"'));
  const shown = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[^>]*cloudflareinsights[^>]*><\/script>/g, '');
  assert.doesNotMatch(shown, /type="(password|email|tel)"|パスワード|ログイン|Cloudflare|Google|銀行|税務署/, 'D311');
  assert.doesNotMatch(html, /あなたの性格|運勢|診断結果/, '診断の形にしない（D117）');
});
