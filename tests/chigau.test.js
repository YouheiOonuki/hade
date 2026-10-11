// 全然違うやつメーカー（矛盾塊の形。yorozu-plans ROADMAP 7.55 D322、企画書 90、ACCEPTANCE「K183」）のテスト: node --test tests/chigau.test.js
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
const FIELDS = ['name', 'emoji', 'sound', 'alias'];

test('「もの」の札: 50。4 つの欄がそろい、どの欄も札どうしで重ならない（重なると偶然合ってしまう）', () => {
  assert.equal(CARDS.things.length, 50);
  for (const f of FIELDS) {
    const vals = CARDS.things.map((t) => t[f]);
    assert.ok(vals.every((v) => typeof v === 'string' && v.length > 0), f);
    assert.equal(new Set(vals).size, vals.length, f + ' に重なり');
  }
  // 欄をまたいでも、ある札の音がほかの札の名前・呼び名と同じになっていない
  const all = CARDS.things.flatMap((t, i) => ['name', 'sound', 'alias'].map((f) => [t[f], i]));
  const by = new Map();
  for (const [v, i] of all) { if (by.has(v) && by.get(v) !== i) assert.fail(`「${v}」が 2 つの札にある`); by.set(v, i); }
});

test('「もの」の札と見本に禁止語が無い（ng-words.json）', () => {
  const texts = [...CARDS.things, ...CARDS.samples].flatMap((t) => [t.name, t.sound, t.alias]);
  for (const t of texts) for (const w of NG_WORDS) assert.ok(!t.includes(w), `「${t}」に「${w}」`);
});

test('4 か所（文字・絵・音・呼び名）のうち、文字と合うのはちょうど 1 か所。残りの 2 か所は別々の「もの」（全組み合わせ）', () => {
  const n = CARDS.things.length;
  let checked = 0;
  for (let i = 0; i < 3000; i++) {
    const c = C.make(CARDS, '名前' + i, i % 4);
    const base = c.ids.name;
    const same = C.SLOTS.filter((s) => c.ids[s] === base);
    assert.equal(same.length, 1, JSON.stringify(c.ids));
    assert.equal(same[0], c.match);
    const rest = C.SLOTS.filter((s) => s !== c.match).map((s) => c.ids[s]);
    assert.equal(new Set([base, ...rest]).size, 3, '3 つの別の「もの」');
    assert.ok(rest.every((x) => x >= 0 && x < n));
    // 表示された文字どおりにも合うのは 1 か所だけ（札の欄が重ならないので）
    const t = CARDS.things[base];
    assert.equal(C.SLOTS.filter((s) => c[s] === t[s]).length, 1);
    checked++;
  }
  // 合う場所は 3 か所とも出る
  const where = new Set(Array.from({ length: 300 }, (_, i) => C.make(CARDS, 'x' + i, 0).match));
  assert.deepEqual([...where].sort(), ['alias', 'emoji', 'sound']);
  assert.ok(checked === 3000);
});

test('見本のカードも決まりどおり（合うのはちょうど 1 か所、match がその場所）', () => {
  assert.ok(CARDS.samples.length >= 2);
  const byName = new Map(CARDS.things.map((t) => [t.name, t]));
  // 1 枚目はオーナーの例（電子レンジ・チーン・掃除機）。電子レンジは札に無いので、合う場所は match のとおり音とする
  assert.deepEqual([CARDS.samples[0].name, CARDS.samples[0].sound, CARDS.samples[0].alias, CARDS.samples[0].match], ['電子レンジ', 'チーン', '掃除機', 'sound']);
  for (const s of CARDS.samples.slice(1)) {
    const t = byName.get(s.name);
    assert.ok(t, s.name);
    assert.deepEqual(C.SLOTS.filter((k) => s[k] === t[k]), [s.match], s.name);
  }
  assert.match(C.answerOf({ name: '猫', sound: 'ニャーン', match: 'sound' }), /^音が合っています（猫の音は「ニャーン」）$/);
});

test('同じ名前で同じカード（前後の空白と NFC はそろえる）。もう一枚は別のカード', () => {
  const a = C.make(CARDS, 'たろう', 0);
  assert.deepEqual(C.make(CARDS, ' たろう ', 0), a);
  assert.deepEqual(C.make(CARDS, 'が', 0), C.make(CARDS, 'が', 0), 'NFC');
  const rounds = new Set([0, 1, 2, 3, 4].map((r) => JSON.stringify(C.make(CARDS, 'たろう', r).ids)));
  assert.ok(rounds.size >= 4);
  assert.equal(C.make(CARDS, '   ', 0).ok, false);
  // 「もの」が偏りなく出る（名前 2,000 個で 45 以上）
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(C.make(CARDS, '名前' + i, 0).name);
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

test('共有の画像に名前は既定で入らない（選んだときだけ）。答えは書かない', () => {
  const c = C.make(CARDS, 'たろう', 0);
  const off = C.shareLines(c, 'たろう', false);
  assert.doesNotMatch(JSON.stringify(off), /たろう/);
  assert.match(C.shareLines(c, 'たろう', true).head, /^たろう の/);
  assert.doesNotMatch(JSON.stringify(off), /合っています/, '答えは出さない');
  assert.equal(off.line, 'どこが合っているでしょう');
  assert.match(read('chigau/app.js'), /shareLines\(last, \$\('name'\)\.value, \$\('share-name'\)\.checked\)/);
  assert.match(read('chigau/index.html'), /<input type="checkbox" id="share-name">/, '既定はチェックなし');
});

test('ページ: 1 行の説明・入力の前に見本のカード・「※演出です」・広告なし・noindex でない・英語版なし・sitemap・館の一覧・まじめな道具への道', () => {
  const html = read('chigau/index.html');
  assert.match(html, /<p class="subtitle">名前を入れると、文字・絵・音・呼び名がぜんぶ食い違ったカードができます。1 か所だけ合っています。<\/p>/);
  assert.ok(html.indexOf('id="s-emoji"') > 0 && html.indexOf('id="s-emoji"') < html.indexOf('<form id="form"'), '見本は入力の前');
  assert.ok(html.includes('※演出です'));
  assert.doesNotMatch(html, /adsbygoogle|googlesyndication|noindex|hreflang/);
  assert.match(html, /まじめな道具はこちら/);
  assert.ok(read('sitemap.xml').includes('<loc>https://yorozu-craft.com/hade/chigau/</loc>'));
  assert.ok(read('index.html').includes('href="./chigau/"'));
  const shown = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[^>]*cloudflareinsights[^>]*><\/script>/g, '');
  assert.doesNotMatch(shown, /type="(password|email|tel)"|パスワード|ログイン|Cloudflare|Google|銀行|税務署/, 'D311');
  assert.doesNotMatch(html, /あなたの性格|運勢|診断結果/, '診断の形にしない（D117）');
});
