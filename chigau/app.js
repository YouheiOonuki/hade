// ===========================
// 全然違うやつメーカー（5000兆円欲しい館。yorozu-plans ROADMAP 7.55 D322・7.46.2 K183、企画書 90、D315）
// 名前（好きな語）を入れると、文字・絵・音・呼び名がぜんぶ食い違ったカード（矛盾塊の形）ができる。1 か所だけ合っている。
//   文字 … 「もの」の名前。カードの基準
//   絵文字・音・呼び名 … このうち 1 か所だけが文字と同じ「もの」。残りの 2 か所は、それぞれ別の「もの」
// 結果は名前のハッシュで決める（同じ名前なら同じカード。日付は混ぜない。「もう一枚」は回数を混ぜる）。
// 名前は送らない・保存しない（fetch は札のファイルを読む 1 か所だけ）。札は ../scripts/chigau.json
// ブラウザでは画面を動かし、Node（テスト）では make・hash・shareLines・answerOf・SLOTS を module.exports
// ===========================
(function (root) {
  'use strict';

  var SLOTS = ['emoji', 'sound', 'alias'];            // 文字と合うかもしれない 3 か所
  var LABEL = { emoji: '絵', sound: '音', alias: '呼び名' };

  /** 32 ビットの FNV-1a（名前の前後の空白を取り、NFC にそろえてから） */
  function hash(text) {
    var s = String(text).trim().normalize('NFC');
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }

  /** base と違う「もの」を、ハッシュから順に 2 つ（重なりなし） */
  function others(n, base, key) {
    var out = [];
    for (var j = 0; out.length < 2; j++) {
      var i = hash(key + '\u0003' + j) % n;
      if (i !== base && out.indexOf(i) < 0) out.push(i);
    }
    return out;
  }

  /** 札（cards）と名前と回数（0 から）からカード。返りは { ok, name, emoji, sound, alias, match, ids } */
  function make(cards, name, round) {
    var key = String(name).trim();
    if (!key) return { ok: false, message: '名前か、好きな言葉を入れてください。' };
    var k = key + '\u0000' + (round || 0);
    var T = cards.things, n = T.length;
    var base = hash(k + '\u0001') % n;
    var match = SLOTS[hash(k + '\u0002') % SLOTS.length];
    var o = others(n, base, k);
    var ids = { name: base };
    var rest = SLOTS.filter(function (s) { return s !== match; });
    ids[match] = base; ids[rest[0]] = o[0]; ids[rest[1]] = o[1];
    return { ok: true, name: T[ids.name].name, emoji: T[ids.emoji].emoji, sound: T[ids.sound].sound, alias: T[ids.alias].alias, match: match, ids: ids };
  }

  /** 答えの文（「音が合っています（猫の音は「ニャーン」）」） */
  function answerOf(card) {
    return LABEL[card.match] + 'が合っています（' + card.name + 'の' + LABEL[card.match] + 'は「' + card[card.match] + '」）';
  }

  /** 共有の画像に書く行。名前は withName のときだけ（既定は入れない）。答えは書かない */
  function shareLines(card, name, withName) {
    return { head: (withName ? String(name).trim() + ' の' : '') + '矛盾カード', name: card.name, emoji: card.emoji, sound: card.sound, alias: card.alias, line: 'どこが合っているでしょう' };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { hash: hash, make: make, shareLines: shareLines, answerOf: answerOf, SLOTS: SLOTS }; return; }

  var doc = root.document, $ = function (id) { return doc.getElementById(id); };
  var SHARE_URL = 'https://yorozu-craft.com/hade/chigau/?from=share-chigau';
  var cards = null, round = 0, last = null, sampleAt = 0;

  /** カードを描く（見本も同じ形）。答えは「答えを見る」を押すまで隠す */
  function show(prefix, card) {
    $(prefix + '-emoji').textContent = card.emoji;
    $(prefix + '-name').textContent = card.name;
    $(prefix + '-sound').textContent = '「' + card.sound + '」';
    $(prefix + '-alias').textContent = card.alias;
    var ans = $(prefix + '-answer');
    ans.textContent = ''; ans.hidden = true;
  }

  fetch('../scripts/chigau.json').then(function (r) { return r.json(); }).then(function (j) {
    cards = j; $('go').disabled = false; $('sample-next').disabled = false; $('s-reveal').disabled = false;
    show('s', j.samples[0]);
  });

  $('sample-next').addEventListener('click', function () { sampleAt = (sampleAt + 1) % cards.samples.length; show('s', cards.samples[sampleAt]); });
  $('s-reveal').addEventListener('click', function () { var a = $('s-answer'); a.textContent = answerOf(cards.samples[sampleAt]); a.hidden = false; });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!cards) return;
    round = 0;
    var c = make(cards, $('name').value, round);
    if (!c.ok) { $('msg').textContent = c.message; return; }
    $('msg').textContent = '';
    last = c; show('r', c); $('result').hidden = false; $('share-note').textContent = '';
  });
  $('again').addEventListener('click', function () { round++; last = make(cards, $('name').value, round); show('r', last); $('share-note').textContent = ''; });
  $('r-reveal').addEventListener('click', function () { var a = $('r-answer'); a.textContent = answerOf(last); a.hidden = false; });
  $('share').addEventListener('click', function () { shareImage(shareLines(last, $('name').value, $('share-name').checked)); });

  /** 共有の画像（端末の canvas で作る。URL に値を入れない。答えは書かない） */
  function shareImage(t) {
    var note = $('share-note');
    var c = doc.createElement('canvas'); c.width = 1080; c.height = 1350;
    var g = c.getContext('2d');
    g.fillStyle = '#5b2a86'; g.fillRect(0, 0, 1080, 1350);
    root.Wordart.draw(g, t.head.length > 16 ? t.head.slice(0, 15) + '…' : t.head, 540, 170, 72);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    // 絵は白い丸の上に（濃い背景の上だと、端末によって絵文字が沈んで見える）
    g.fillStyle = '#fff'; g.beginPath(); g.arc(540, 495, 190, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#000'; g.font = '280px sans-serif'; g.fillText(t.emoji, 540, 590);
    g.fillStyle = '#fff'; g.font = 'bold 96px sans-serif'; g.fillText(t.name, 540, 790);
    g.fillStyle = '#ffd43d'; g.font = 'bold 72px sans-serif'; g.fillText('♪「' + t.sound + '」', 540, 920);
    g.fillStyle = '#fff'; g.font = '56px sans-serif'; g.fillText('またの名を ' + t.alias, 540, 1030);
    g.font = 'bold 52px sans-serif'; g.fillText(t.line, 540, 1150);
    g.font = '36px sans-serif'; g.fillStyle = '#eadcf5';
    g.fillText('全然違うやつメーカー（5000兆円欲しい館）', 540, 1240);
    g.fillText('yorozu-craft.com/hade/chigau/', 540, 1295);
    var text = '1 か所だけ合っている矛盾カード。どこが合っているでしょう（全然違うやつメーカー）';
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
