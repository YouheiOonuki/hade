// ===========================
// 年末調整（ド派手版）のページ（yorozu-plans ROADMAP 7.39.1 K170、企画書 86）
// 計算はまじめな版の /seido-keisan/lib/nenmatsu.js（window.Nenmatsu）と tax2026.js（window.TaxValues）を同じ URL で読む（写しを持たない。D300）。
// このファイルは入力を集めて calc に渡し、結果の種類で台本（../scripts/nenmatsu.json）を選んで演出に渡すだけ。入力はどこにも送らない・保存しない
// ブラウザでは画面を動かし、Node（テスト）では resultOf を module.exports
// ===========================
(function (root) {
  'use strict';

  /** まじめな版の calc を呼んで、演出に渡す値にする。数字は calc の diff そのまま（足し引きしない） */
  function resultOf(N, TAX, input) {
    var year = TAX.CURRENT;
    var r = N.calc(input, year);
    var src = (TAX.years[year].SOURCES || [])[0] || {};
    if (!r.ok) return { ok: false, message: r.message, source: src };
    var variant = r.diff > 0 ? 'refund' : r.diff < 0 ? 'owe' : 'even';
    var abs = Math.abs(r.diff);
    return { ok: true, variant: variant, diff: r.diff, abs: abs, label: r.label, nenzei: r.nenzei, withheld: r.withheld, source: src };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { resultOf: resultOf }; return; }

  var doc = root.document, $ = function (id) { return doc.getElementById(id); };
  var H = root.Hade;
  var SHARE_URL = 'https://yorozu-craft.com/hade/nenmatsu/?from=share-nenmatsu';

  // まじめな版の lib が読めなければ、まじめな版へのリンクだけを出す（演出だけで数字の無い画面にしない）
  if (!root.Nenmatsu || !root.TaxValues || !H) {
    $('form').hidden = true;
    $('lib-error').hidden = false;
    return;
  }

  var n = function (id) { return Number($(id).value) || 0; };
  function input() {
    return {
      income: n('income'), withheld: n('withheld'), shakai: n('shakai'), shokibo: n('shokibo'),
      seimei: { newIppan: n('s-newIppan'), oldIppan: n('s-oldIppan'), kaigo: n('s-kaigo'), newNenkin: n('s-newNenkin'), oldNenkin: n('s-oldNenkin') },
      jishin: { jishin: n('j-jishin'), oldLong: n('j-oldLong') },
      spouse: { has: $('sp-has').checked, incomeType: $('sp-type').value, amount: n('sp-amount'), over70: $('sp-over70').checked },
      jutaku: n('jutaku'),
    };
  }

  var script = null;
  fetch('../scripts/nenmatsu.json').then(function (r) { return r.json(); }).then(function (j) { script = j; $('go').disabled = false; });

  $('sp-has').addEventListener('change', function () { $('sp-box').hidden = !this.checked; });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!script) return;
    var res = resultOf(root.Nenmatsu, root.TaxValues, input());
    if (!res.ok) { $('msg').textContent = res.message; return; }
    $('msg').textContent = '';
    var vals = { amount: H.yen(res.abs), digits: res.abs.toLocaleString('ja-JP') };
    $('form').hidden = true;
    H.play($('stage'), script, res.variant, vals, function (layer, f) { finale(layer, f, res); });
  });

  /** 決めの画面: 見出し・数字・ツッコミ 1 行・出典・ボタン 3 つ（共有・まじめな版で確かめる・もう一回） */
  function finale(layer, f, res) {
    var box = doc.createElement('div');
    box.className = 'hade-finale';
    var add = function (tag, cls, text) { var e = doc.createElement(tag); e.className = cls; e.textContent = text; box.appendChild(e); return e; };
    add('p', 'hade-finale-head', f.head || '');
    add('p', 'hade-finale-num', res.variant === 'even' ? '0円' : H.yen(res.abs));
    add('p', 'hade-finale-tsukkomi', f.tsukkomi || '');
    add('p', 'hade-finale-site', 'yorozu-craft.com / 年末調整（' + res.label + '）');
    var src = add('p', 'hade-finale-src', '計算はまじめな版と同じ。出典: ');
    var a = doc.createElement('a'); a.href = res.source.url; a.textContent = res.source.label; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.appendChild(a);
    var btns = doc.createElement('div'); btns.className = 'hade-finale-btns'; box.appendChild(btns);
    var share = doc.createElement('button'); share.type = 'button'; share.className = 'hade-btn'; share.textContent = '共有する'; btns.appendChild(share);
    var serious = doc.createElement('a'); serious.className = 'hade-btn hade-btn-sub'; serious.href = '/seido-keisan/nenmatsu/'; serious.textContent = 'まじめな版で確かめる'; btns.appendChild(serious);
    var again = doc.createElement('button'); again.type = 'button'; again.className = 'hade-btn hade-btn-sub'; again.textContent = 'もう一回'; btns.appendChild(again);
    var real = doc.createElement('label'); real.className = 'hade-real';
    real.innerHTML = '<input type="checkbox" id="share-real"> 共有の画像に実際の金額を出す（ふだんは「3万円台」のようにぼかします）';
    box.appendChild(real);
    var note = add('p', 'hade-share-note', '');
    layer.appendChild(box);
    share.addEventListener('click', function () { shareImage(f, res, $('share-real').checked, note); });
    again.addEventListener('click', function () { $('stage').hidden = true; $('stage').textContent = ''; $('form').hidden = false; });
  }

  /** 共有の画像（端末の canvas で作る。URL に値を入れない）。スマホは Web Share、ほかは保存して X の投稿画面 */
  function shareImage(f, res, realAmount, note) {
    var c = doc.createElement('canvas'); c.width = 1080; c.height = 1350;
    var g = c.getContext('2d');
    g.fillStyle = res.variant === 'owe' ? '#1c1814' : '#8b4513'; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = '#ffd43d'; g.font = 'bold 120px sans-serif'; g.textAlign = 'center';
    g.fillText(f.head || '', 540, 380);
    g.fillStyle = '#fff'; g.font = 'bold 150px sans-serif';
    g.fillText(res.variant === 'even' ? '0円' : (realAmount ? H.yen(res.abs) : H.blurYen(res.abs)), 540, 640);
    g.font = '52px sans-serif'; g.fillText(f.tsukkomi || '', 540, 820);
    g.font = '40px sans-serif'; g.fillStyle = '#f3e6d8';
    g.fillText('年末調整（ド派手版）※演出です', 540, 1120);
    g.fillText('yorozu-craft.com/hade/', 540, 1190);
    var text = (f.head || '') + '（年末調整のド派手版）';
    c.toBlob(function (blob) {
      var file = new File([blob], 'hade-nenmatsu.png', { type: 'image/png' });
      if (root.navigator.canShare && root.navigator.canShare({ files: [file] })) {
        root.navigator.share({ files: [file], text: text + ' ' + SHARE_URL }).catch(function () {});
        return;
      }
      var a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hade-nenmatsu.png'; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      note.innerHTML = '';
      note.appendChild(doc.createTextNode('画像を保存しました。'));
      var x = doc.createElement('a'); x.href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SHARE_URL); x.target = '_blank'; x.rel = 'noopener noreferrer'; x.textContent = 'X の投稿画面を開く（画像は自分で添付）';
      note.appendChild(x);
    }, 'image/png');
  }
})(this);
