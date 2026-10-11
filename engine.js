// ===========================
// 5000兆円欲しい館の演出エンジン（yorozu-plans ROADMAP 7.46、企画書 89・86、D303・D312・D313）
// 台本（scripts/<道具>.json）の場面を順に再生し、最後に「決め」の画面で結果を出す。抽選や計算はしない（まじめな版の lib が出した値を受け取るだけ）。
// 偽のエラー・再起動・確認の場面は持たない（D313。年末調整のド派手版とともに消した）。
// 守ること: 「※演出です」を常に出す。本物の窓・履歴・閉じる確認・止まらない繰り返しを使わない。音は押してから（既定は無音）。
//   点滅は 1 秒に 3 回まで（WCAG 2.3.1）。「視差効果を減らす」の設定なら黙って決めの画面だけ。「飛ばす」（小さな ×）を常に出す。
//   説明の文は出さない（D324）。線は文でなく動きで守る
// ブラウザでは window.Hade、Node（テスト）では module.exports（画面に触らない関数だけ）
// ===========================
(function (root) {
  'use strict';

  var TYPES = ['drumroll', 'slot', 'gougai', 'cm', 'finale'];
  var FLASH_MIN_MS = 340;          // 点滅 1 回の周期の下限（1 秒に 3 回まで → 333ms 以上。余裕を持って 340）
  var SCENE_MAX_MS = 6000;         // 1 場面の長さの上限（もったいぶっても待たせすぎない）
  var TOTAL_MAX_MS = 30000;        // 台本全体の上限
  var SCENES_MAX = 3;              // 決めの前の場面は 3 つまで（企画書 89 の台本の決まり）
  var TAME_MAX_MS = 3000;          // ため（drumroll）は 3 秒まで
  var LINE_MAX = 20;               // 決めの一言は 20 字まで

  /** 文の中の {name} を値で置き換える（値に無い名前はそのまま） */
  function fill(text, vals) {
    return String(text == null ? '' : text).replace(/\{(\w+)\}/g, function (m, k) { return vals && vals[k] != null ? String(vals[k]) : m; });
  }

  /**
   * 台本を確かめる。返りは { ok, errors }。場面の型・長さ・点滅の周期・誘導の語（「今すぐ」など）を見る
   * 台本の形: { id, title, variants: { <結果の種類>: { scenes: [...] } } }
   */
  function validate(script) {
    var errors = [];
    if (!script || !script.variants) return { ok: false, errors: ['variants が無い'] };
    Object.keys(script.variants).forEach(function (v) {
      var scenes = script.variants[v].scenes || [];
      var total = 0;
      if (!scenes.length || scenes[scenes.length - 1].type !== 'finale') errors.push(v + ': 最後は finale');
      if (scenes.length - 1 > SCENES_MAX) errors.push(v + ': 場面が多い ' + (scenes.length - 1));
      var fin = scenes[scenes.length - 1] || {};
      if (fin.type === 'finale' && !(fin.line && Array.from(fin.line).length <= LINE_MAX)) errors.push(v + ': 決めの一言は 1〜' + LINE_MAX + ' 字');
      scenes.forEach(function (s, i) {
        var at = v + '[' + i + ']';
        if (TYPES.indexOf(s.type) < 0) errors.push(at + ': 型 ' + s.type);
        var ms = s.ms || 0;
        if (ms > SCENE_MAX_MS) errors.push(at + ': 長すぎる ' + ms);
        if (s.type === 'drumroll' && ms > TAME_MAX_MS) errors.push(at + ': ためが長い ' + ms);
        total += ms;
        if (s.flashMs != null && s.flashMs < FLASH_MIN_MS) errors.push(at + ': 点滅が速い ' + s.flashMs);
        var text = JSON.stringify(s);
        if (/今すぐ|至急|ウイルス|感染|ハッキング|サポートに電話|クリックしてください/.test(text)) errors.push(at + ': 人を動かす偽の警告の語');
      });
      if (total > TOTAL_MAX_MS) errors.push(v + ': 全体が長すぎる ' + total);
    });
    return { ok: errors.length === 0, errors: errors };
  }

  /** 再生する場面の列。視差効果を減らす設定なら決めの画面だけ */
  function plan(script, variant, opt) {
    var scenes = (script.variants[variant] || {}).scenes || [];
    if (opt && opt.reduced) return scenes.filter(function (s) { return s.type === 'finale'; });
    return scenes.slice();
  }

  var api = { TYPES: TYPES, FLASH_MIN_MS: FLASH_MIN_MS, SCENE_MAX_MS: SCENE_MAX_MS, TOTAL_MAX_MS: TOTAL_MAX_MS, SCENES_MAX: SCENES_MAX, TAME_MAX_MS: TAME_MAX_MS, LINE_MAX: LINE_MAX, fill: fill, validate: validate, plan: plan };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---------------------------------------------------------------
  // 画面（ブラウザだけ）
  // ---------------------------------------------------------------
  var doc = root.document;
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // 音（Web Audio。既定は無音。「音を出す」を押した人だけ）
  var audio = { on: false, ctx: null };
  function ac() {
    if (!audio.on) return null;
    if (!audio.ctx) { var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null; audio.ctx = new AC(); }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return audio.ctx;
  }
  function beep(freq, sec, type, gain) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.06, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + sec);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + sec);
  }
  function fanfare() { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.25, 'triangle', 0.08); }, i * 140); }); }
  function drum(sec) {
    var c = ac(); if (!c) return;
    var n = Math.floor(sec * 12);
    for (var i = 0; i < n; i++) setTimeout(function () { beep(90 + Math.random() * 40, 0.06, 'square', 0.05); }, i * 83);
  }
  function vibrate(p) { if (audio.on && root.navigator.vibrate) root.navigator.vibrate(p); }

  /**
   * 再生する。stage は演出の舞台（.hade-stage）。vals は台本の {name} に入る値（amount など。表示用の文字列）。
   * onFinale(finaleScene) で決めの画面を出す（ページ側が数字・出典・ボタンを並べる）
   */
  function play(stage, script, variant, vals, onFinale) {
    var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scenes = plan(script, variant, { reduced: reduced });
    var i = -1, timer = null, done = false;
    stage.hidden = false;
    stage.textContent = '';
    var notice = el('p', 'hade-notice', '※演出です');
    var layer = el('div', 'hade-layer');
    var bar = el('div', 'hade-bar');
    var skip = el('button', 'hade-skip', '×');   // 飛ばす（D324: 文は出さず小さな × 1 つ。読み上げには「飛ばす」）
    skip.type = 'button'; skip.setAttribute('aria-label', '飛ばす');
    var sound = el('button', 'hade-sound', audio.on ? '🔊 音あり' : '🔇 音なし');
    sound.type = 'button';
    sound.setAttribute('aria-pressed', String(audio.on));
    bar.appendChild(sound); bar.appendChild(skip);
    stage.appendChild(notice); stage.appendChild(layer); stage.appendChild(bar);
    sound.addEventListener('click', function () { audio.on = !audio.on; sound.textContent = audio.on ? '🔊 音あり' : '🔇 音なし'; sound.setAttribute('aria-pressed', String(audio.on)); });
    skip.addEventListener('click', function () { finish(); });

    function finish() {
      if (done) return;
      done = true; clearTimeout(timer);
      bar.removeChild(skip);
      layer.textContent = '';
      var f = scenes.filter(function (s) { return s.type === 'finale'; })[0] || { type: 'finale' };
      stage.classList.remove('is-shake');
      onFinale(layer, f);
      fanfare();
    }
    function next() {
      if (done) return;
      i++;
      var s = scenes[i];
      if (!s || s.type === 'finale') { finish(); return; }
      layer.textContent = '';
      stage.classList.remove('is-shake');
      SCENES[s.type](layer, s, vals, function () { timer = setTimeout(next, 0); });
      if (s.ms) timer = setTimeout(next, Math.min(s.ms, SCENE_MAX_MS));
    }
    next();
    return { skip: finish };
  }

  // 場面の型。どれも ms で次へ
  var SCENES = {
    drumroll: function (layer, s, vals) {
      var box = el('div', 'hade-drum');
      box.appendChild(el('p', 'hade-drum-title', fill(s.title, vals)));
      var spot = el('div', 'hade-spot');
      if (s.flashMs) spot.style.animationDuration = Math.max(FLASH_MIN_MS, s.flashMs) + 'ms';
      box.appendChild(spot);
      // roll: 候補の名前を回して見せる（vals.names。当たりは決めの画面まで出さない）
      if (s.roll && vals.names && vals.names.length) {
        var name = el('p', 'hade-roll', '');
        box.appendChild(name);
        var k = 0, t = setInterval(function () { name.textContent = vals.names[k++ % vals.names.length]; }, 90);
        setTimeout(function () { clearInterval(t); }, Math.min(s.ms || 2500, TAME_MAX_MS));
      }
      layer.appendChild(box);
      layer.parentNode.classList.add('is-shake');
      drum((s.ms || 2500) / 1000); vibrate([40, 40, 40, 40, 40, 40]);
    },
    slot: function (layer, s, vals) {
      var box = el('div', 'hade-slot');
      box.appendChild(el('p', 'hade-slot-title', fill(s.title, vals)));
      var target = String(vals[s.value || 'digits'] || '0');
      var row = el('p', 'hade-slot-row');
      var cells = target.split('').map(function (ch) { var c = el('span', /\d/.test(ch) ? 'hade-digit' : 'hade-sep', /\d/.test(ch) ? '0' : ch); row.appendChild(c); return { c: c, ch: ch }; });
      row.appendChild(el('span', 'hade-unit', s.unit || '円'));
      box.appendChild(row);
      layer.appendChild(box);
      var digits = cells.filter(function (x) { return /\d/.test(x.ch); });
      var spin = setInterval(function () { digits.forEach(function (x) { if (!x.stop) x.c.textContent = String(Math.floor(Math.random() * 10)); }); }, 70);
      var per = Math.max(250, ((s.ms || 4000) - 500) / Math.max(1, digits.length));
      digits.forEach(function (x, j) { setTimeout(function () { x.stop = true; x.c.textContent = x.ch; x.c.classList.add('is-stop'); beep(600 + j * 60, 0.08); }, per * (j + 1)); });
      setTimeout(function () { clearInterval(spin); }, (s.ms || 4000));
    },
    gougai: function (layer, s, vals) {
      var paper = el('div', 'hade-gougai');
      paper.appendChild(el('p', 'hade-gougai-name', s.paper || '号外'));
      paper.appendChild(el('p', 'hade-gougai-head', fill(s.head, vals)));
      paper.appendChild(el('p', 'hade-gougai-sub', fill(s.sub, vals)));
      layer.appendChild(paper);
      beep(220, 0.4, 'sawtooth', 0.06);
    },
    cm: function (layer, s, vals) {
      var box = el('div', 'hade-cm');
      box.appendChild(el('p', 'hade-cm-label', 'CM'));
      box.appendChild(el('p', 'hade-cm-copy', fill(s.copy, vals)));
      var a = el('a', 'hade-cm-link', s.linkText || 'この道具を見る');
      a.href = s.href;
      box.appendChild(a);
      box.appendChild(el('p', 'hade-cm-after', '結果は CM のあとで'));
      layer.appendChild(box);
    },
  };

  api.play = play;
  api.audio = audio;
  root.Hade = api;
})(this);
