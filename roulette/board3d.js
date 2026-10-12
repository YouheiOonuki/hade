// ===========================
// ルーレットの 3D の盤（5000兆円欲しい館。yorozu-plans ROADMAP 7.57.1 K180 第 2 版、D325）
// three.js（../vendor/three/、MIT）で盤を回し、止まる直前に照明を落として 1 点のスポット、止まったら紙吹雪を物理で降らせる。
// 「回す」を押してから app.js が import() で読む（初回の読み込みには入らない）。WebGL が無い・視差効果を減らす設定のときは読まれない（2D のまま）
// 当たりは先に pick.js が決めている。盤はその当たりの扇形で止まるように回すだけ（盤から当たりを決めない）
// 点滅しない（照明は 1 回落とすだけ）。紙吹雪は 300 枚まで。描画の解像度は devicePixelRatio を 2 までに丸める
// ===========================
import * as THREE from '../vendor/three/three.module.min.js';
import { COLORS } from '../wheel.js';   // 盤の色は 2D の盤と同じ 1 か所

export const CONFETTI_MAX = 300;
export const SPIN_MS = 5200;      // 回す時間（加速と減速）
export const DIM_AT = 0.82;       // 照明を落とす時点（回す時間の割合）
export const FALL_MS = 2600;      // 紙吹雪の時間

/**
 * n 個の扇形のうち index 番目が上（針の位置）に来る盤の角度（ラジアン）。turns 回まわってから止まる。
 * 円柱の上面の UV の向きのため、盤の角度 0 のとき扇形 i の真ん中は (i+0.5)*2π/n − π/2 にある（画面で測った: 2026-10-11）。
 * 針は +y（π/2）なので、盤を π − (i+0.5)*2π/n だけ回すと真ん中が針に来る
 */
export function targetAngle(index, n, turns) {
  const step = (Math.PI * 2) / n;
  return turns * Math.PI * 2 + Math.PI - (index + 0.5) * step;
}

/** 回す動き: 0〜1 の時間から 0〜1 の進み（はじめは速く、最後はゆっくり） */
export const easeOut = (t) => 1 - Math.pow(1 - t, 4);

/** 盤の面の絵（扇形と名前）を canvas に描く */
function faceTexture(names) {
  const size = 1024, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const n = names.length, r = size / 2, step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    // canvas は y が下向きなので、three の角度（反時計回り）と合わせるため符号を反転して描く
    g.beginPath(); g.moveTo(r, r);
    g.arc(r, r, r, -i * step, -(i + 1) * step, true);
    g.closePath();
    g.fillStyle = COLORS[i % COLORS.length];
    g.fill();
    g.save();
    // 名前は扇形の中ほどに、円周に沿って横向きに書く（止まったとき針の下で横書きに読める）
    g.translate(r, r); g.rotate(-(i + 0.5) * step); g.translate(r * 0.66, 0); g.rotate(Math.PI / 2);
    const fs = Math.max(26, Math.min(72, (r * 0.66 * step) / Math.max(2, [...names[i]].length) * 0.95));
    g.fillStyle = '#1b1464'; g.font = `900 ${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = names[i].length > 8 ? names[i].slice(0, 7) + '…' : names[i];
    g.fillText(label, 0, 0);
    g.restore();
  }
  g.beginPath(); g.arc(r, r, 60, 0, Math.PI * 2); g.fillStyle = '#1b1464'; g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * 盤を回して、止まって紙吹雪が落ちきったら resolve する。sfx は engine の音（押した後だけ鳴る）
 * stage: 演出の舞台の要素（その中に canvas を置く）。names: 候補、index: 当たりの位置
 */
export function spin(stage, names, index, sfx) {
  return new Promise((resolve) => {
    const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = 'hade-3d';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0b1e');
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    // 盤（半径 3）が横に収まる距離。縦長のスマホでは遠くから見る
    const dist = Math.max(12, 3.7 / (Math.tan((42 / 2) * Math.PI / 180) * (w / h)));
    camera.position.set(0, -0.62 * dist, 0.78 * dist); camera.lookAt(0, 0.6, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-3, -4, 8); key.castShadow = true;
    const spot = new THREE.SpotLight(0xfff2a8, 0, 14, Math.PI / 10, 0.4); spot.position.set(0, 2.8, 6); spot.target.position.set(0, 2.6, 0);
    scene.add(ambient, key, spot, spot.target);

    // 盤（厚みのある円柱。上面に扇形と名前）
    const board = new THREE.Group();
    const face = new THREE.MeshStandardMaterial({ map: faceTexture(names), roughness: 0.45, metalness: 0.1 });
    const rim = new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.3, metalness: 0.8 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.35, 96), [rim, face, rim]);
    disc.rotation.x = Math.PI / 2; disc.castShadow = true; disc.receiveShadow = true;
    board.add(disc);
    scene.add(board);
    // 針（上）
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 24), new THREE.MeshStandardMaterial({ color: '#ff1744', roughness: 0.3, metalness: 0.4 }));
    pin.position.set(0, 3.25, 0.4); pin.rotation.z = Math.PI; scene.add(pin);
    // 台
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: '#1b1464', roughness: 0.9 }));
    floor.position.z = -0.3; floor.receiveShadow = true; scene.add(floor);

    const n = names.length, step = (Math.PI * 2) / n;
    const end = targetAngle(index, n, 7);
    let last = 0, dimmed = false, stopped = false, t0 = performance.now(), confetti = null, raf = 0;

    function makeConfetti() {
      const count = CONFETTI_MAX;
      const geo = new THREE.PlaneGeometry(0.12, 0.2);
      const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      const parts = [];
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        parts.push({ p: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 3 + 5, Math.random() * 4 + 3), v: new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.2, Math.random() * 2), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), s: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 3) });
        mesh.setColorAt(i, color.set(COLORS[i % COLORS.length]));
      }
      scene.add(mesh);
      return { mesh, parts, start: performance.now() };
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    function stepConfetti(dt) {
      for (let i = 0; i < confetti.parts.length; i++) {
        const c = confetti.parts[i];
        c.v.z -= 4.2 * dt;                         // 重力（盤の上から下へ）
        c.v.multiplyScalar(0.985);                  // 空気の抵抗
        c.p.addScaledVector(c.v, dt);
        c.r.x += c.s.x * dt; c.r.y += c.s.y * dt; c.r.z += c.s.z * dt;
        q.setFromEuler(c.r);
        confetti.mesh.setMatrixAt(i, m4.compose(c.p, q, one));
      }
      confetti.mesh.instanceMatrix.needsUpdate = true;
    }

    let prev = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      const t = Math.min(1, (now - t0) / SPIN_MS);
      const a = end * easeOut(t);
      board.rotation.z = a;
      // 扇形が針を過ぎるたびにカチッ
      const passed = Math.floor((a + step / 2) / step);
      if (passed !== last) { last = passed; if (sfx) sfx.beep(1200, 0.025, 'square', 0.03); }
      if (!dimmed && t >= DIM_AT) {
        dimmed = true;                              // 照明を 1 回だけ落として、針の先にスポット
        ambient.intensity = 0.08; key.intensity = 0.15; spot.intensity = 60;
        if (sfx) sfx.drum(1.0);
      }
      if (t >= 1 && !stopped) {
        stopped = true;
        ambient.intensity = 0.9; key.intensity = 1.6; spot.intensity = 30;
        confetti = makeConfetti();
        if (sfx) sfx.fanfare();
      }
      if (confetti) {
        stepConfetti(dt);
        if (now - confetti.start > FALL_MS) { cleanup(); resolve(); return; }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function cleanup() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
      renderer.dispose();
      renderer.domElement.remove();
    }
    // 飛ばす（×）が押されたら、すぐ片づけて決めへ
    stage.addEventListener('hade:skip', () => { if (!stopped || confetti) { cleanup(); resolve(); } }, { once: true });
    raf = requestAnimationFrame(frame);
  });
}
