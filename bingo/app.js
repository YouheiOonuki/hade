// ===========================
// ビンゴの発表（5000兆円欲しい館。yorozu-plans ROADMAP 7.69.3 K182、企画書 94、D339）
// /bingo/ の「みんなで」の部屋（K146）を見るだけでつなぎ、新しい番号が来るたびに 台本（../scripts/bingo.json）で大げさに出す。
// 部屋の口は /bingo/room.js、番号の文字（B 12 など）は /bingo/calc.js を同じ URL で読む（写しを持たない。D312）。新しい DO は作らない。
// 番号は引かない・部屋に送らない（conn.send を呼ばない）。部屋のコードは入力欄だけで、URL に入れない。音は「音を出す」を押してから
// ブラウザでは画面を動かし、Node（テスト）では newNumbers と label を module.exports
// ===========================
(function (root) {
  'use strict';

  /** 前に見た数（seen）より増えた分の番号。部屋がやり直されて減ったら、新しい番号は無し（帯だけ書き直す） */
  function newNumbers(seen, numbers) {
    var nums = Array.isArray(numbers) ? numbers : [];
    if (seen < 0 || nums.length <= seen) return [];
    return nums.slice(seen);
  }
  /** 番号の文字。1〜75 なら B・I・N・G・O の列を付ける（まじめな版の calc.js の letterOf と同じ） */
  function label(Calc, n, max) {
    var letter = Calc && Calc.letterOf ? Calc.letterOf(n, 1, max) : '';
    return letter ? letter + ' ' + n : String(n);
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { newNumbers: newNumbers, label: label }; return; }

  var doc = root.document, $ = function (id) { return doc.getElementById(id); };
  var H = root.Hade, R = root.Room, Calc = root.Calc;
  if (!H || !R) { $('room-form').hidden = true; $('lib-error').hidden = false; return; }

  var script = null, conn = null, max = 75, seen = -1, queue = [], busy = false;
  fetch('../scripts/bingo.json').then(function (r) { return r.json(); }).then(function (j) { script = j; });

  // 音: 押した人だけ。押したときに 1 回小さく鳴らして、端末の音の許可をここで取る（番号が来るのは押していない時なので）
  $('sound').addEventListener('click', function () {
    H.audio.on = !H.audio.on;
    this.setAttribute('aria-pressed', String(H.audio.on));
    this.textContent = H.audio.on ? '🔊 音あり' : '🔇 音を出す';
    if (H.audio.on) H.sfx.beep(880, 0.05, 'sine', 0.01);
  });

  $('room-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var code = R.normalizeCode($('code').value);
    if (!code) { $('msg').textContent = '部屋のコードは数字 4 けたと英字 1 つです。'; return; }
    $('msg').textContent = '';
    R.info(code).then(function (j) {
      if (!j.ok) { $('msg').textContent = j.status === 404 ? 'その部屋はありません。' : 'つながりませんでした。'; return; }
      max = j.max || 75;
      $('room-form').hidden = true;
      $('board').hidden = false;
      show(j);
      conn = R.connect({
        code: code,
        onState: show,
        onStatus: function (s) { $('conn').textContent = s === 'retry' ? 'つなぎ直しています…' : ''; },
        onGone: function () { $('conn').textContent = '部屋が閉じました。'; },
      });
    });
  });

  /** 部屋の状態が来たら: 帯を書き直し、増えた番号を順に発表する */
  function show(st) {
    var nums = st.numbers || [];
    var fresh = newNumbers(seen, nums);
    seen = nums.length;
    band(nums);
    fresh.forEach(function (n, i) { queue.push({ n: n, count: nums.length - fresh.length + i + 1 }); });
    next();
  }
  function band(nums) {
    var ol = $('drawn');
    ol.textContent = '';
    nums.slice().reverse().forEach(function (n) { var li = doc.createElement('li'); li.textContent = label(Calc, n, max); ol.appendChild(li); });
    $('last').textContent = nums.length ? label(Calc, nums[nums.length - 1], max) : '';
  }
  function next() {
    if (busy || !queue.length || !script) return;
    busy = true;
    var q = queue.shift();
    var keys = Object.keys(script.variants);
    var variant = keys[Math.floor(Math.random() * keys.length)];
    var vals = { label: label(Calc, q.n, max), count: String(q.count) };
    H.play($('stage'), script, variant, vals, function (layer, f) {
      finale(layer, f, vals);
      setTimeout(function () { busy = false; next(); }, 1500);   // 続けて来た番号は、決めを少し見せてから次へ
    });
  }

  /** 決めの画面: 番号の大写しと一言と紙吹雪 */
  function finale(layer, f, vals) {
    var box = doc.createElement('div');
    box.className = 'hade-finale';
    var add = function (cls, text) { var p = doc.createElement('p'); p.className = cls; p.textContent = text; box.appendChild(p); };
    add('hade-finale-win hade-bingo-num', H.fill(f.head, vals));
    add('hade-finale-line', H.fill(f.line, vals));
    // 出た番号の帯（新しい順。大画面のまま見られるように決めの画面にも出す）
    var ol = doc.createElement('ol'); ol.className = 'hade-bingo-band';
    Array.prototype.forEach.call($('drawn').children, function (li) { ol.appendChild(li.cloneNode(true)); });
    box.appendChild(ol);
    layer.appendChild(box);
    confetti(layer);
  }
  /** 紙吹雪（40 片が 1 回落ちるだけ。視差効果を減らす設定では CSS が出さない。ルーレットと同じ） */
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
})(this);
