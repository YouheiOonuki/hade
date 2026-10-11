// ===========================
// 全然違うやつメーカー（あほらし館。yorozu-plans ROADMAP 7.46.2 K183、企画書 90、D315）
// 名前（好きな語）を入れると、真顔で仲間が 4 つ並び、5 つ目だけ全然違うものが出る。
// 結果は名前のハッシュで決める（同じ名前なら同じ結果。日付は混ぜない。「もう一回」は回数を混ぜて別の題）。
// 名前は送らない・保存しない（fetch は札のファイルを読む 1 か所だけ）。札は ../scripts/chigau.json
// ブラウザでは画面を動かし、Node（テスト）では make・hash・shareLines を module.exports
// ===========================
(function (root) {
  'use strict';

  /** 32 ビットの FNV-1a（名前の前後の空白を取り、NFC にそろえてから） */
  function hash(text) {
    var s = String(text).trim().normalize('NFC');
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }

  /** 札（cards）と名前と回数（0 から）から結果。題・組・違うやつ・一言を別々のハッシュで選ぶ */
  function make(cards, name, round) {
    var key = String(name).trim();
    if (!key) return { ok: false, message: '名前か、好きな言葉を入れてください。' };
    var k = key + '\u0000' + (round || 0);
    var theme = cards.themes[hash(k + '\u0001') % cards.themes.length];
    var group = theme.groups[hash(k + '\u0002') % theme.groups.length];
    var odd = cards.odd[hash(k + '\u0003') % cards.odd.length];
    var line = cards.lines[hash(k + '\u0004') % cards.lines.length];
    return { ok: true, title: theme.title, items: group.concat([odd]), odd: odd, line: line };
  }

  /** 共有の画像に書く行。名前は withName のときだけ（既定は入れない） */
  function shareLines(res, name, withName) {
    return { head: (withName ? String(name).trim() + ' の' : '') + '「' + res.title + '」', items: res.items, line: res.line };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { hash: hash, make: make, shareLines: shareLines }; return; }

  var doc = root.document, $ = function (id) { return doc.getElementById(id); };
  var SHARE_URL = 'https://yorozu-craft.com/hade/chigau/?from=share-chigau';
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards = null, round = 0, last = null, timers = [];

  fetch('../scripts/chigau.json').then(function (r) { return r.json(); }).then(function (j) { cards = j; $('go').disabled = false; });

  function show(res) {
    timers.forEach(clearTimeout); timers = [];
    last = res;
    $('result').hidden = false;
    $('r-title').textContent = '「' + res.title + '」の仲間';
    var ul = $('r-items'); ul.textContent = '';
    $('r-line').textContent = '';
    $('r-after').hidden = true;
    res.items.forEach(function (w, i) {
      var li = doc.createElement('li');
      li.textContent = w;
      if (i === res.items.length - 1) li.className = 'chigau-odd';
      if (reduced) { ul.appendChild(li); return; }
      timers.push(setTimeout(function () { ul.appendChild(li); }, 450 * i));
    });
    var done = function () { $('r-line').textContent = res.line; $('r-after').hidden = false; $('share-note').textContent = ''; };
    if (reduced) done(); else timers.push(setTimeout(done, 450 * res.items.length + 300));
  }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!cards) return;
    round = 0;
    var res = make(cards, $('name').value, round);
    if (!res.ok) { $('msg').textContent = res.message; return; }
    $('msg').textContent = '';
    show(res);
  });
  $('again').addEventListener('click', function () { round++; show(make(cards, $('name').value, round)); });
  $('share').addEventListener('click', function () { shareImage(shareLines(last, $('name').value, $('share-name').checked)); });

  /** 共有の画像（端末の canvas で作る。URL に値を入れない） */
  function shareImage(t) {
    var note = $('share-note');
    var c = doc.createElement('canvas'); c.width = 1080; c.height = 1350;
    var g = c.getContext('2d');
    g.fillStyle = '#5b2a86'; g.fillRect(0, 0, 1080, 1350);
    g.textAlign = 'center'; g.fillStyle = '#ffd43d'; g.font = 'bold 64px sans-serif';
    g.fillText(t.head.length > 16 ? t.head.slice(0, 15) + '…' : t.head, 540, 220);
    t.items.forEach(function (w, i) {
      g.fillStyle = i === t.items.length - 1 ? '#ffd43d' : '#fff';
      g.font = 'bold 84px sans-serif';
      g.fillText(w, 540, 380 + i * 130);
    });
    g.fillStyle = '#fff'; g.font = 'bold 56px sans-serif'; g.fillText(t.line, 540, 1080);
    g.font = '38px sans-serif'; g.fillStyle = '#eadcf5';
    g.fillText('全然違うやつメーカー（あほらし館）', 540, 1190);
    g.fillText('yorozu-craft.com/hade/chigau/', 540, 1250);
    var text = t.line + '（全然違うやつメーカー）';
    c.toBlob(function (blob) {
      var file = new File([blob], 'hade-chigau.png', { type: 'image/png' });
      if (root.navigator.canShare && root.navigator.canShare({ files: [file] })) {
        root.navigator.share({ files: [file], text: text + ' ' + SHARE_URL }).catch(function () {});
        return;
      }
      var a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hade-chigau.png'; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      note.textContent = '画像を保存しました。';
      var x = doc.createElement('a'); x.href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SHARE_URL); x.target = '_blank'; x.rel = 'noopener noreferrer'; x.textContent = 'X の投稿画面を開く（画像は自分で添付）';
      note.appendChild(x);
    }, 'image/png');
  }
})(this);
