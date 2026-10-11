// ===========================
// ワードアート（5000兆円欲しい館の見出し・決めの画面・共有の画像。yorozu-plans ROADMAP 7.53 D321）
// 昔のワープロのワードアートのような、ちょうダサい文字。画面は CSS の .wordart、共有の画像はこの関数で canvas に描く。
// 濃い紺の帯の上に黄色の太字（帯との明るさの比は 4.5:1 を大きく超える）、虹色の段の影、斜めの傾き。点滅はしない
// ブラウザでは window.Wordart、Node（テスト）では module.exports
// ===========================
(function (root) {
  'use strict';
  var BAND = '#1b1464', FILL = '#ffe600', STROKE = '#c2185b';
  var LAYERS = ['#2979ff', '#00c853', '#ff9100', '#ff1744'];   // 奥から手前へ（虹の段）

  /** canvas に 1 行のワードアートを描く（中央揃え）。size は文字の大きさ（px） */
  function draw(g, text, x, y, size) {
    g.save();
    g.font = 'italic 900 ' + size + 'px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var w = g.measureText(text).width;
    g.translate(x, y); g.rotate(-0.05); g.transform(1, 0, -0.18, 1, 0, 0);
    g.fillStyle = BAND;
    g.fillRect(-w / 2 - size * 0.4, -size * 0.75, w + size * 0.8, size * 1.5);
    var step = Math.max(2, Math.round(size / 26));
    LAYERS.forEach(function (c, i) { g.fillStyle = c; g.fillText(text, (LAYERS.length - i) * step, (LAYERS.length - i) * step); });
    g.lineWidth = Math.max(2, size / 22); g.strokeStyle = STROKE; g.lineJoin = 'round';
    g.strokeText(text, 0, 0);
    g.fillStyle = FILL; g.fillText(text, 0, 0);
    g.restore();
  }

  var api = { BAND: BAND, FILL: FILL, STROKE: STROKE, LAYERS: LAYERS, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Wordart = api;
})(this);
