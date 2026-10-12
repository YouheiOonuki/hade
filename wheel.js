// ===========================
// 館のルーレットの盤（2D、SVG）。入口と、ルーレットの「回す」の前の画面に出す（yorozu-plans ROADMAP 7.60 段 2 の 7）
// 盤の色はここが 1 か所（3D の盤 roulette/board3d.js もここから読む）。飾りなので aria-hidden、当たりは決めない
// data-hade-wheel の要素に描く。data-hade-wheel="items" なら #items の候補を名前にして、書き換えるたびに描き直す
// ゆっくり回るのは CSS（.hade-wheel-spin）。視差効果を減らす設定では止まる
// ===========================
export const COLORS = ['#ffe600', '#ff1744', '#2979ff', '#00c853', '#ff9100', '#d500f9', '#ffffff', '#00e5ff'];
const BLANK = 8;          // 名前の無い盤（入口）の扇形の数
const LABEL_MAX = 16;     // これより多いと名前を書かない（字が潰れる）

/** 扇形 i の道（上から時計回り）。半径 r */
export function sectorPath(i, n, r) {
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
  const p = (a) => (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2);
  return 'M0 0L' + p(a0) + 'A' + r + ' ' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + p(a1) + 'Z';
}

/** svg を作って el の中身と置き換える。names が空なら名前の無い盤 */
export function drawWheel(el, names) {
  const NS = 'http://www.w3.org/2000/svg', doc = el.ownerDocument;
  const mk = (tag, attrs) => { const e = doc.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const n = names.length >= 2 ? names.length : BLANK;
  const svg = mk('svg', { viewBox: '-112 -118 224 230', class: 'hade-wheel-svg', focusable: 'false' });
  const spin = mk('g', { class: 'hade-wheel-spin' });
  for (let i = 0; i < n; i++) spin.appendChild(mk('path', { d: sectorPath(i, n, 100), fill: COLORS[i % COLORS.length], stroke: '#1b1464', 'stroke-width': 1.5 }));
  if (names.length >= 2 && n <= LABEL_MAX) {
    const fs = Math.max(9, Math.min(17, 150 / n));
    names.forEach((name, i) => {
      const deg = ((i + 0.5) / n) * 360 - 90;
      // 名前は扇形の真ん中に、中心から外へ向けて書く。左半分は逆さにならないよう 180° 返す（textContent なので入れた字はそのまま字として出る）
      const flip = deg > 90 && deg < 270 ? ' rotate(180)' : '';
      const t = mk('text', { transform: 'rotate(' + deg.toFixed(2) + ') translate(60 0)' + flip, 'font-size': fs, class: 'hade-wheel-label' });
      t.textContent = [...name].length > 6 ? [...name].slice(0, 5).join('') + '…' : name;
      spin.appendChild(t);
    });
  }
  svg.appendChild(spin);
  svg.appendChild(mk('circle', { r: 101, fill: 'none', stroke: '#c9a227', 'stroke-width': 7 }));
  svg.appendChild(mk('circle', { r: 13, fill: '#c9a227', stroke: '#1b1464', 'stroke-width': 3 }));
  svg.appendChild(mk('path', { d: 'M0 -86L-11 -116L11 -116Z', fill: '#ff1744', stroke: '#1b1464', 'stroke-width': 2 }));   // 針（回らない）
  el.textContent = '';
  el.appendChild(svg);
}

/** 候補の欄の字から名前。まじめな版と同じ区切り（pick.js の parseText、改行） */
function namesOf(text) {
  const Pick = globalThis.RoulettePick;
  return Pick ? Pick.parseText(text, 'newline') : text.split('\n').map((s) => s.trim()).filter(Boolean);
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-hade-wheel]').forEach((el) => {
    const box = el.getAttribute('data-hade-wheel') === 'items' ? document.getElementById('items') : null;
    const draw = () => drawWheel(el, box ? namesOf(box.value) : []);
    draw();
    if (box) box.addEventListener('input', draw);
  });
}
