// ===========================
// ルーレット（5000兆円欲しい館）のページ（yorozu-plans ROADMAP 7.46.1 K180、企画書 89、D312）
// 当たりはまじめなルーレットの /web-roulette/pick.js（window.RoulettePick）を同じ URL で読んで決める（写しを持たない）。
// このファイルは入力を集めて pickMultiple に渡し、台本（../scripts/roulette.json）を 1 本選んで演出に渡すだけ。入力はどこにも送らない・保存しない
// ブラウザでは画面を動かし、Node（テスト）では draw と shareLines を module.exports
// ===========================
(function (root) {
  'use strict';

  var COUNT_MAX = 5;

  /** 貼った候補から count 個の当たり。まじめな版と同じ関数（区切りは改行、重みなし） */
  function draw(Pick, text, count, rand) {
    var names = Pick.parseText(text, 'newline');
    if (names.length < 2) return { ok: false, message: '候補を 2 つ以上、1 行に 1 つずつ入れてください。' };
    var n = Math.max(1, Math.min(COUNT_MAX, Math.floor(count) || 1, names.length));
    var picked = Pick.pickMultiple(names.map(function (name) { return { name: name, weight: 1 }; }), n, false, rand);
    return { ok: true, names: names, winners: picked.map(function (r) { return r.candidate.name; }) };
  }

  /** 共有の画像に書く行。当たりの名前は利用者が入れたものなので、withNames のときだけ入れる（既定は入れない） */
  function shareLines(f, res, withNames) {
    return {
      head: f.head || '',
      win: withNames ? res.winners.join('、') : '（当たりは伏せています）',
      line: f.line || '',
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { draw: draw, shareLines: shareLines, COUNT_MAX: COUNT_MAX }; return; }

  var doc = root.document, $ = function (id) { return doc.getElementById(id); };
  var H = root.Hade, Pick = root.RoulettePick;
  var SHARE_URL = 'https://yorozu-craft.com/hade/roulette/?from=share-roulette';

  // まじめな版の lib が読めなければ、まじめな版へのリンクだけを出す
  if (!Pick || !H) {
    $('form').hidden = true;
    $('lib-error').hidden = false;
    return;
  }

  var script = null;
  fetch('../scripts/roulette.json').then(function (r) { return r.json(); }).then(function (j) { script = j; $('go').disabled = false; });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!script) return;
    var res = draw(Pick, $('items').value, Number($('count').value), Math.random);
    if (!res.ok) { $('msg').textContent = res.message; return; }
    $('msg').textContent = '';
    var keys = Object.keys(script.variants);
    var variant = keys[Math.floor(Math.random() * keys.length)];
    var vals = { winner: res.winners.join('、'), count: String(res.winners.length), names: res.names };
    $('form').hidden = true;
    H.play($('stage'), script, variant, vals, function (layer, f) { finale(layer, f, res); });
  });

  /** 決めの画面: 大写しの当たり・一言・サイト名・ボタン（もう一回・共有・まじめな版）と紙吹雪 */
  function finale(layer, f, res) {
    var box = doc.createElement('div');
    box.className = 'hade-finale';
    var add = function (tag, cls, text) { var e = doc.createElement(tag); e.className = cls; e.textContent = text; box.appendChild(e); return e; };
    add('p', 'hade-finale-head wordart', f.head || '');
    add('p', 'hade-finale-win', res.winners.join('、'));
    add('p', 'hade-finale-line', f.line || '');
    add('p', 'hade-finale-site', 'yorozu-craft.com / 5000兆円欲しい館');
    var btns = doc.createElement('div'); btns.className = 'hade-finale-btns'; box.appendChild(btns);
    var again = doc.createElement('button'); again.type = 'button'; again.className = 'hade-btn'; again.textContent = 'もう一回'; btns.appendChild(again);
    var share = doc.createElement('button'); share.type = 'button'; share.className = 'hade-btn hade-btn-sub'; share.textContent = '共有する'; btns.appendChild(share);
    var pick = doc.createElement('label'); pick.className = 'hade-share-pick';
    var cb = doc.createElement('input'); cb.type = 'checkbox'; cb.id = 'share-names';
    pick.appendChild(cb); pick.appendChild(doc.createTextNode(' 名前も画像に'));
    box.appendChild(pick);
    var note = add('p', 'hade-share-note', '');
    layer.appendChild(box);
    confetti(layer);
    share.addEventListener('click', function () { shareImage(shareLines(f, res, cb.checked), note); });
    again.addEventListener('click', function () { $('stage').hidden = true; $('stage').textContent = ''; $('form').hidden = false; $('go').focus(); });
  }

  /** 紙吹雪（40 片が 1 回落ちるだけ。視差効果を減らす設定では CSS が出さない） */
  function confetti(layer) {
    var c = doc.createElement('div'); c.className = 'hade-confetti'; c.setAttribute('aria-hidden', 'true');
    var colors = ['#ffd43d', '#ff6b6b', '#4dabf7', '#69db7c', '#f783ac'];
    for (var i = 0; i < 40; i++) {
      var p = doc.createElement('i');
      p.style.left = Math.floor(Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.8).toFixed(2) + 's';
      c.appendChild(p);
    }
    layer.parentNode.appendChild(c);
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 3500);
  }

  /** 共有の画像（端末の canvas で作る。URL に値を入れない）。スマホは Web Share、ほかは保存して X の投稿画面 */
  function shareImage(t, note) {
    var c = doc.createElement('canvas'); c.width = 1080; c.height = 1350;
    var g = c.getContext('2d');
    g.fillStyle = '#5b2a86'; g.fillRect(0, 0, 1080, 1350);
    g.textAlign = 'center';
    root.Wordart.draw(g, t.head, 540, 340, 130);
    g.fillStyle = '#fff'; g.font = 'bold 84px sans-serif'; g.fillText(t.win.length > 14 ? t.win.slice(0, 13) + '…' : t.win, 540, 620);
    g.font = 'bold 60px sans-serif'; g.fillText(t.line, 540, 820);
    g.font = '40px sans-serif'; g.fillStyle = '#eadcf5';
    g.fillText('5000兆円欲しい館のルーレット ※演出です', 540, 1120);
    g.fillText('yorozu-craft.com/hade/roulette/', 540, 1190);
    var text = t.line + '（5000兆円欲しい館のルーレット）';
    c.toBlob(function (blob) {
      var file = new File([blob], 'hade-roulette.png', { type: 'image/png' });
      if (root.navigator.canShare && root.navigator.canShare({ files: [file] })) {
        root.navigator.share({ files: [file], text: text + ' ' + SHARE_URL }).catch(function () {});
        return;
      }
      var a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hade-roulette.png'; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      note.textContent = '画像を保存しました。';
      var x = doc.createElement('a'); x.href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SHARE_URL); x.target = '_blank'; x.rel = 'noopener noreferrer'; x.textContent = 'X の投稿画面を開く（画像は自分で添付）';
      note.appendChild(x);
    }, 'image/png');
  }
})(this);
