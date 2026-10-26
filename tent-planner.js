/* ================================================
   Éléonore & Hubert — 3D reception tent planner
   The layout (tables, dance floor, bars, trees) is computed from the tent
   size and guest count; every element can be switched in or out from the
   side panel. Units are metres: x runs across the tent's width, z along its
   length, y is up. The head table sits against the −x wall, the entrance is
   in the middle of the +x wall, the screens hang at both ends (±z).
   ================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;

// ── Plan state ──────────────────────────────────────

const STORE_KEY = 'eh-tent-plan-v1';
const DEFAULTS = {
  tentW: 20, tentL: 30, walls: 'open',
  guests: 450, perTable: 10, headSeats: 20, danceSize: 8, aisle: 0.7,
  time: 'night', moment: 'dinner', view: 'orbit',
  oliveCount: 8, photophores: 5, garlandStyle: 'canopy',
  show: {
    roof: true, cutaway: true, headTable: true, rounds: true, chairs: true, tableware: true,
    dance: true, bars: true, dj: true, cake: true, lounge: false, screens: true,
    ceilingDrapes: true, wallDrapes: true, garlands: true, chandeliers: true, photophores: true,
    olives: true, curtain: true, neon: true, disco: true, spotlight: true, bloom: true,
  },
};
// Changing one of these moves things around, so the scene is rebuilt.
const LAYOUT_KEYS = new Set(['tentW', 'tentL', 'walls', 'guests', 'perTable', 'headSeats', 'danceSize', 'aisle',
  'oliveCount', 'photophores', 'garlandStyle']);
const LAYOUT_SHOW = new Set(['bars', 'dj', 'cake', 'lounge']);
// Hidden in the floor-plan view so the tables can be seen from above.
const PLAN_HIDE = new Set(['roof', 'ceilingDrapes', 'garlands', 'chandeliers', 'disco']);

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s) return { ...structuredClone(DEFAULTS), ...s, show: { ...DEFAULTS.show, ...s.show }, view: 'orbit' };
  } catch { /* private window or blocked storage */ }
  return structuredClone(DEFAULTS);
}
let state = loadState();
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* not essential */ }
}

// ── Layout (pure: no Three.js) ─────────────────────

const TABLE_R = { 8: 0.76, 10: 0.9, 12: 1.05 };
const ROOF_PITCH = Math.tan(18 * Math.PI / 180);
const EAVE = 3;

function distRect(x, z, r) {
  return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
}

function computeLayout(st, { trees = true } = {}) {
  const W = st.tentW, L = st.tentL, sh = st.show;
  const ridge = EAVE + (W / 2) * ROOF_PITCH;
  const roofY = x => ridge - (ridge - EAVE) * Math.min(1, Math.abs(x) / (W / 2));
  const tableR = TABLE_R[st.perTable] || 0.9;
  const foot = tableR + 0.55;               // table plus chairs pulled out
  const spacing = 2 * foot + (st.aisle ?? 0.7);  // service aisle between chair backs

  const headSeats = Math.max(2, Math.min(st.headSeats, Math.floor((L - 6) / 0.65)));
  const headLen = headSeats * 0.65 + 0.6;
  const headX = -W / 2 + 1.6;
  const stageX0 = -W / 2 + 2.3;             // front edge of the head-table stage
  const D = Math.max(4, Math.min(st.danceSize, W - 8, L - 8));
  // The dance floor is not kept clear at dinner: the centre tables stand on
  // it and are carried out after dinner, before the waltz.
  const danceX = Math.min(Math.max(0, stageX0 + 2.9 + D / 2), W / 2 - D / 2 - 1);
  const dance = { x: danceX, z: 0, size: D };
  // A small spot in front of the head table for the speeches (1–9 people).
  const speech = { x: stageX0 + 0.9, z: 0 };
  const cake = { x: stageX0 + 1.5, z: 1.7 };

  // Areas tables keep clear of; `pad` is the extra clearance beyond the chairs.
  const zones = [];
  const add = (name, x0, x1, z0, z1, pad, solid = true) => zones.push({ name, x0, x1, z0, z1, pad, solid });
  add('head', -W / 2, stageX0 + 0.4, -headLen / 2 - 0.9, headLen / 2 + 0.9, 0.3);
  add('speech', stageX0, stageX0 + 2.4, -2.4, 2.4, 0.2, false);
  add('aisle', W / 2 - 3, W / 2, -1.1, 1.1, 0.2, false);
  const bars = [];
  if (sh.bars) {
    for (const s of [-1, 1]) {
      bars.push({ x: W / 2 - 3.1, z: s * (L / 2 - 1.9), face: -s, label: s < 0 ? 'Champagne' : 'Cocktails' });
      add('bar', W / 2 - 5.9, W / 2 - 0.2, s < 0 ? -L / 2 : L / 2 - 2.7, s < 0 ? -L / 2 + 2.7 : L / 2, 1.0);
    }
  }
  const dj = sh.dj ? { x: -W / 2 + 1.6, z: L / 2 - 1.6 } : null;
  if (dj) add('dj', -W / 2, -W / 2 + 3.1, L / 2 - 3.1, L / 2, 0.6);
  const lounge = sh.lounge ? { x: -W / 2 + 2.4, z: -L / 2 + 2.4 } : null;
  if (lounge) add('lounge', -W / 2, -W / 2 + 4.8, -L / 2, -L / 2 + 4.8, 0.4);
  add('screen', -2.8, 2.8, -L / 2, -L / 2 + 1.0, 0.2);
  add('screen', -2.8, 2.8, L / 2 - 1.0, L / 2, 0.2);

  const inside = (x, z, m) => Math.abs(x) <= W / 2 - m && Math.abs(z) <= L / 2 - m;
  const tableOk = (x, z) => inside(x, z, foot + 0.5) && zones.every(r => distRect(x, z, r) >= foot + r.pad);

  // Try staggered and square grids at several offsets, in both directions,
  // and keep whichever seats the most.
  let best = null;
  const phases = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  for (const hex of [true, false]) for (const turned of [false, true]) {
    const rowSp = hex ? spacing * Math.sqrt(3) / 2 : spacing;
    for (const rPhase of phases) for (const cPhase of phases) {
      const pts = [];
      for (let r = -40; r <= 40; r++) {
        const a = (r + rPhase) * rowSp;
        if (Math.abs(a) > (turned ? W : L) / 2) continue;
        const off = hex && (r & 1) ? 0.5 : 0;
        for (let c = -40; c <= 40; c++) {
          const b = (c + cPhase + off) * spacing;
          const x = turned ? a : b, z = turned ? b : a;
          if (Math.abs(x) <= W / 2 && Math.abs(z) <= L / 2 && tableOk(x, z)) pts.push({ x, z });
        }
      }
      const d = pts.reduce((s, p) => s + Math.hypot(p.x - danceX, p.z), 0) / Math.max(1, pts.length);
      if (!best || pts.length > best.pts.length || (pts.length === best.pts.length && d < best.d)) best = { pts, d };
    }
  }
  const needed = Math.ceil(Math.max(0, st.guests - headSeats) / st.perTable);
  const tables = best.pts
    .sort((a, b) => Math.hypot(a.x - danceX, a.z) - Math.hypot(b.x - danceX, b.z))
    .slice(0, needed)
    .sort((a, b) => a.z - b.z || a.x - b.x)
    .map((t, i) => ({ ...t, n: i + 1 }));
  const seated = Math.min(st.guests, headSeats + tables.length * st.perTable);
  const danceRect = { x0: danceX - D / 2, x1: danceX + D / 2, z0: -D / 2, z1: D / 2 };
  for (const t of tables) t.cleared = distRect(t.x, t.z, danceRect) < foot - 0.25;

  // Olive trees: framing positions first, then spread evenly through the gaps.
  const olives = [];
  const headRect = zones.find(z => z.name === 'head');
  const treeOk = (x, z) => inside(x, z, 0.7)
    && tables.every(t => Math.hypot(t.x - x, t.z - z) >= foot + 0.35)
    && zones.every(r => !r.solid || r.name === 'head' || distRect(x, z, r) >= 0.5)
    && (distRect(x, z, headRect) > 0 || Math.abs(z) > headLen / 2 + 0.5)
    && distRect(x, z, danceRect) >= 0.3
    && !(x > W / 2 - 3.5 && Math.abs(z) < 1.5)
    && Math.hypot(x - cake.x, z - cake.z) > 1.2 && Math.hypot(x - speech.x, z - speech.z) > 1.5
    && olives.every(o => Math.hypot(o.x - x, o.z - z) >= 1.6);
  const c = 0.75;
  const anchors = [
    [danceX - D / 2 - c, D / 2 + c], [danceX - D / 2 - c, -D / 2 - c],
    [danceX + D / 2 + c, D / 2 + c], [danceX + D / 2 + c, -D / 2 - c],
    [W / 2 - 1.0, 2.0], [W / 2 - 1.0, -2.0],
    [headX, headLen / 2 + 0.9], [headX, -headLen / 2 - 0.9],
  ];
  const want = trees ? st.oliveCount : 0;
  for (const [x, z] of anchors) if (olives.length < want && treeOk(x, z)) olives.push({ x, z });
  if (olives.length < want) {
    const cands = [];
    for (let x = -W / 2 + 1.5; x <= W / 2 - 1.5; x += 0.5) for (let z = -L / 2 + 1.5; z <= L / 2 - 1.5; z += 0.5) cands.push({ x, z });
    while (olives.length < want) {
      let pick = null, far = -1;
      for (const p of cands) {
        if (!treeOk(p.x, p.z)) continue;
        const d = olives.length ? Math.min(...olives.map(o => Math.hypot(o.x - p.x, o.z - p.z))) : Math.hypot(p.x - danceX, p.z);
        if (d > far) { far = d; pick = p; }
      }
      if (!pick) break;
      olives.push({ x: pick.x, z: pick.z });
    }
  }

  return {
    W, L, eave: EAVE, ridge, roofY, tableR, foot, spacing, headSeats, headLen, headX, stageX0,
    dance, speech, cake, bars, dj, lounge, zones, tables, needed, seated,
    capacity: headSeats + best.pts.length * st.perTable, olives,
  };
}

const SIZE_PRESETS = [[20, 30], [20, 35], [25, 30], [20, 40], [25, 35], [25, 40], [25, 45], [30, 40], [30, 45], [30, 50], [35, 50], [35, 60]];
function smallestFit(st) {
  for (const [w, l] of SIZE_PRESETS) {
    const lay = computeLayout({ ...st, tentW: w, tentL: l }, { trees: false });
    if (lay.tables.length >= lay.needed) return [w, l];
  }
  return null;
}

// ── Small helpers ──────────────────────────────────

function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function mat(x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}
function place(geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  return geo.applyMatrix4(mat(x, y, z, ry, 1, 1, 1, rx, rz));
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function instanced(geo, material, matrices, { cast = true, receive = true } = {}) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, matrices.length));
  matrices.forEach((mm, i) => m.setMatrixAt(i, mm));
  m.count = matrices.length;
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  return m;
}
function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// A grid surface from fn(u, v) → Vector3, with its faces turned towards `want`.
function surface(nu, nv, fn, want) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = fn(i / nu, j / nv);
    pos.push(p.x, p.y, p.z);
    uv.push(i / nu, j / nv);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (want) {
    const n = geo.attributes.normal;
    let s = 0;
    for (let i = 0; i < n.count; i++) s += n.getX(i) * want.x + n.getY(i) * want.y + n.getZ(i) * want.z;
    if (s < 0) {
      const ix = geo.index.array;
      for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
      geo.index.needsUpdate = true;
      geo.computeVertexNormals();
    }
  }
  return geo;
}
const quad = (a, b, c, d, want) => surface(1, 1, (u, v) => {
  const top = a.clone().lerp(b, u), bot = d.clone().lerp(c, u);
  return top.lerp(bot, v);
}, want);

// ── Procedural textures ────────────────────────────

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.userData.canvas = cv;
  return t;
}
const r0 = rng(7);
const TEX = {
  sisal: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#C9B38E'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
      const k = ((x / 4 + y / 4) & 1) ? 0.07 : -0.05;
      g.fillStyle = `rgba(${k > 0 ? '255,240,210' : '90,70,40'},${Math.abs(k) + r0() * 0.06})`;
      g.fillRect(x, y, 4, 4);
    }
  }, true),
  chevron: canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#B48A5E'; g.fillRect(0, 0, w, h);
    const cw = 64, ph = 22;
    for (let c = 0; c < w / cw; c++) {
      g.save();
      g.beginPath(); g.rect(c * cw, 0, cw, h); g.clip();
      g.translate(c * cw + cw / 2, 0);
      g.rotate(c % 2 ? 0.75 : -0.75);
      for (let y = -h; y < h * 2; y += ph) {
        const tone = 150 + r0() * 45;
        g.fillStyle = `rgb(${tone + 30},${tone - 5},${tone - 55})`;
        g.fillRect(-cw * 1.5, y, cw * 3, ph - 1.5);
        g.fillStyle = 'rgba(80,50,25,.35)';
        g.fillRect(-cw * 1.5, y + ph - 1.5, cw * 3, 1.5);
      }
      g.restore();
    }
  }, true),
  grass: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8E8C55'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      const t = r0();
      g.fillStyle = t < 0.5 ? 'rgba(160,150,90,.35)' : t < 0.8 ? 'rgba(100,110,60,.35)' : 'rgba(190,170,110,.4)';
      g.fillRect(r0() * w, r0() * h, 1 + r0() * 2, 1 + r0() * 3);
    }
  }, true),
  gravel: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#D8CBB0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      const s = 140 + r0() * 90;
      g.fillStyle = `rgba(${s},${s - 10},${s - 30},.6)`;
      g.beginPath(); g.arc(r0() * w, r0() * h, 0.6 + r0() * 1.6, 0, TAU); g.fill();
    }
  }, true),
  rug: canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#EFE6D6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#B4693E'; g.lineWidth = 6;
    g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 3;
    for (let x = 60; x < w - 40; x += 48) for (let y = 60; y < h - 40; y += 48) {
      g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 14, y); g.lineTo(x, y + 14); g.lineTo(x - 14, y); g.closePath(); g.stroke();
    }
  }),
  glow: canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }),
};

// Screen idle slide and neon signs need the script font, so they are drawn
// once it has loaded (and drawn right away with a fallback until then).
function drawIdle(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#2B301D'); gr.addColorStop(1, '#4B5136');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(247,241,230,.35)'; g.lineWidth = 2; g.strokeRect(28, 28, w - 56, h - 56);
  g.fillStyle = '#F7F1E6'; g.textAlign = 'center';
  g.font = `${h * 0.2}px "Parfumerie Script", cursive`;
  g.fillText('Éléonore & Hubert', w / 2, h * 0.5);
  g.font = `italic ${h * 0.065}px "Cormorant Garamond", Georgia, serif`;
  g.fillText('26 juin 2027 · Domaine des Pins · Crillon-le-Brave', w / 2, h * 0.68);
}
TEX.idle = canvasTex(1024, 576, drawIdle);
function neonTex(text) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${h * 0.62}px "Parfumerie Script", cursive`;
    g.shadowColor = '#FFB46A'; g.shadowBlur = 24;
    g.strokeStyle = '#FFE3B8'; g.lineWidth = 7;
    g.strokeText(text, w / 2, h * 0.55);
    g.shadowBlur = 0; g.strokeStyle = '#FFF6E6'; g.lineWidth = 3;
    g.strokeText(text, w / 2, h * 0.55);
  });
}
TEX.neon = { Champagne: neonTex('Champagne !'), Cocktails: neonTex('Cocktails') };
function lowerThirdTex(label) {
  return canvasTex(1024, 576, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    if (!label) return;
    g.fillStyle = 'rgba(35,38,15,.72)'; g.fillRect(40, h - 110, 520, 64);
    g.fillStyle = '#F7F1E6'; g.font = '500 26px Montserrat, sans-serif'; g.textBaseline = 'middle';
    g.fillText('● LIVE', 62, h - 78);
    g.font = 'italic 34px "Cormorant Garamond", Georgia, serif';
    g.fillText(label, 180, h - 78);
  });
}

// ── Materials ──────────────────────────────────────

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const MAT = {
  linen: std(0xF3EDE1, { roughness: 0.95 }),
  ivory: std(0xF6F0E4, { roughness: 0.9 }),
  roof: std(0xFBF8F2, { roughness: 0.9, side: THREE.BackSide, shadowSide: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: 0xdfeaf0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }),
  drape: std(0xF4EEE2, { roughness: 1, transparent: true, opacity: 0.93, side: THREE.FrontSide }),
  curtain: std(0xF1EADC, { roughness: 1, side: THREE.DoubleSide }),
  frame: std(0xC9C9C4, { roughness: 0.45, metalness: 0.6 }),
  sisal: std(0xffffff, { map: TEX.sisal, roughness: 1 }),
  parquet: std(0xffffff, { map: TEX.chevron, roughness: 0.45 }),
  grass: std(0xffffff, { map: TEX.grass, roughness: 1 }),
  gravel: std(0xffffff, { map: TEX.gravel, roughness: 1 }),
  wood: std(0xA77F55, { roughness: 0.6 }),
  darkWood: std(0x4A3424, { roughness: 0.5 }),
  cane: std(0xD9BF8C, { roughness: 0.9 }),
  brass: std(0xC9A158, { roughness: 0.3, metalness: 1 }),
  zinc: std(0xB2B3AE, { roughness: 0.35, metalness: 0.8 }),
  porcelain: std(0xFFFFFF, { roughness: 0.25 }),
  crystal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false }),
  votive: new THREE.MeshStandardMaterial({ color: 0xFFE2B0, roughness: 0.1, transparent: true, opacity: 0.4, depthWrite: false }),
  leaf: std(0x7D8A62, { roughness: 0.85, flatShading: true }),
  leafLit: std(0x9AA889, { roughness: 0.85, flatShading: true, emissive: 0xFFC27A, emissiveIntensity: 0 }),
  leafTop: std(0x7E8C68, { roughness: 0.85, flatShading: true, emissive: 0xFFC27A, emissiveIntensity: 0 }),
  trunk: std(0x6A5A48, { roughness: 0.95 }),
  terracotta: std(0xB4693E, { roughness: 0.7 }),
  glaze: std(0x6F6B38, { roughness: 0.35 }),
  rose: std(0xFBF7EF, { roughness: 0.7 }),
  pine: std(0x3E4A2B, { roughness: 0.9, flatShading: true }),
  cypress: std(0x2F3A22, { roughness: 0.9, flatShading: true }),
  lavender: std(0x7E6FA6, { roughness: 0.9 }),
  lavLeaf: std(0x7F8A6C, { roughness: 0.9 }),
  black: std(0x18181a, { roughness: 0.6 }),
  speaker: std(0x222222, { roughness: 0.5 }),
  suit: std(0x1E2433, { roughness: 0.7 }),
  dress: std(0xFFFDF8, { roughness: 0.8 }),
  skin: std(0xE8C4A6, { roughness: 0.7 }),
  rugM: std(0xffffff, { map: TEX.rug, roughness: 1 }),
  travertine: std(0xE4D8C4, { roughness: 0.6 }),
  terraCushion: std(0xB86E4B, { roughness: 1 }),
  oliveCushion: std(0x7A8058, { roughness: 1 }),
  cake: std(0xFFFBF2, { roughness: 0.6 }),
  bottleG: std(0x2F4A2C, { roughness: 0.15, metalness: 0.2 }),
  bottleA: std(0x8A5A22, { roughness: 0.15, metalness: 0.2 }),
  bottleC: std(0xE8E8E0, { roughness: 0.1, transparent: true, opacity: 0.6 }),
  mirror: std(0xB8B6AE, { roughness: 0.15, metalness: 1 }),
  mountain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
};
// HDR emissive materials: values above 1 are picked up by the glow pass.
const BULB = new THREE.MeshBasicMaterial({ color: 0xffffff });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffffff });
const SCREEN = new THREE.MeshBasicMaterial({ map: TEX.idle });
const NEON = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
const BULB_BASE = new THREE.Color(1.5, 0.95, 0.45);
const FLAME_BASE = new THREE.Color(3.2, 1.7, 0.55);

const GLOW_SHARED = { uTime: { value: 0 }, uScale: { value: 600 } };
function glowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...GLOW_SHARED, uIntensity: { value: 1 } },
    vertexShader: `
      attribute float aSize; attribute float aPhase; attribute float aFlicker; attribute vec3 aColor;
      uniform float uTime; uniform float uScale; uniform float uIntensity;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float f = 1.0 - aFlicker * (0.5 + 0.5 * sin(uTime * 7.0 + aPhase) * sin(uTime * 3.1 + aPhase * 1.7));
        vAlpha = f * uIntensity;
        vColor = aColor;
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d); a *= a;
        gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
// pts: [{p: Vector3, size, flicker, color?}]
function glowPoints(pts, defColor = [1.0, 0.62, 0.3]) {
  const pos = [], size = [], phase = [], flick = [], col = [];
  const rnd = rng(pts.length + 3);
  for (const g of pts) {
    pos.push(g.p.x, g.p.y, g.p.z);
    size.push(g.size); phase.push(rnd() * 100); flick.push(g.flicker ?? 0.1);
    col.push(...(g.color || defColor));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geo.setAttribute('aFlicker', new THREE.Float32BufferAttribute(flick, 1));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  const p = new THREE.Points(geo, glowMaterial());
  p.frustumCulled = false;
  p.renderOrder = 5;
  return p;
}

// Soft additive light-pool decal, for the uplights under the olive trees.
const POOL = new THREE.MeshBasicMaterial({ map: TEX.glow, color: new THREE.Color(1.0, 0.55, 0.22), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
const BEAM = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(1, 0.85, 0.6) }, uOpacity: { value: 0 } },
  vertexShader: `
    varying float vY; varying vec3 vN; varying vec3 vV;
    void main() {
      vY = -position.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uColor; uniform float uOpacity;
    varying float vY; varying vec3 vN; varying vec3 vV;
    void main() {
      float edge = pow(abs(dot(vN, vV)), 1.6);
      float a = uOpacity * edge * (1.0 - 0.65 * vY);
      gl_FragColor = vec4(uColor * a, 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
});

// ── Shared geometry ────────────────────────────────

const GEO = {};
function chairGeos() {
  const legs = [];
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
    legs.push(place(new THREE.BoxGeometry(0.035, 0.45, 0.035), x, 0.225, z));
  }
  const frame = mergeGeometries([
    ...legs,
    place(new THREE.BoxGeometry(0.44, 0.04, 0.42), 0, 0.45, 0),
    place(new THREE.BoxGeometry(0.035, 0.52, 0.035), -0.19, 0.71, -0.19, 0, -0.08),
    place(new THREE.BoxGeometry(0.035, 0.52, 0.035), 0.19, 0.71, -0.19, 0, -0.08),
    place(new THREE.BoxGeometry(0.42, 0.05, 0.035), 0, 0.96, -0.21, 0, -0.08),
  ]);
  const cane = mergeGeometries([
    place(new THREE.BoxGeometry(0.33, 0.3, 0.012), 0, 0.74, -0.2, 0, -0.08),
  ]);
  const cushion = place(new THREE.BoxGeometry(0.42, 0.05, 0.4), 0, 0.495, 0.005);
  return { frame, cane, cushion };
}
function initGeo() {
  Object.assign(GEO, chairGeos());
  GEO.plate = new THREE.CylinderGeometry(0.135, 0.12, 0.014, 28);
  GEO.charger = new THREE.CylinderGeometry(0.165, 0.165, 0.008, 32);
  GEO.napkin = new THREE.BoxGeometry(0.11, 0.02, 0.2);
  GEO.glass = new THREE.LatheGeometry([
    [0, 0], [0.035, 0], [0.035, 0.004], [0.005, 0.012], [0.004, 0.09], [0.03, 0.11], [0.038, 0.15], [0.034, 0.2],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  GEO.coupe = new THREE.LatheGeometry([
    [0, 0], [0.03, 0], [0.03, 0.004], [0.004, 0.01], [0.004, 0.06], [0.05, 0.075], [0.058, 0.095],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  GEO.votive = new THREE.CylinderGeometry(0.036, 0.032, 0.09, 14, 1, true);
  GEO.flame = new THREE.SphereGeometry(0.012, 8, 6).scale(1, 2.2, 1);
  GEO.bulb = new THREE.SphereGeometry(0.032, 8, 6);
  GEO.clump = new THREE.IcosahedronGeometry(0.3, 1);
  GEO.rose = new THREE.SphereGeometry(0.045, 10, 8);
  GEO.candle = new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10);
  GEO.bottle = mergeGeometries([
    place(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 10), 0, 0.1, 0),
    place(new THREE.CylinderGeometry(0.014, 0.035, 0.1, 10), 0, 0.25, 0),
  ]);
  GEO.pot = new THREE.LatheGeometry([
    [0, 0], [0.2, 0], [0.22, 0.04], [0.24, 0.12], [0.33, 0.35], [0.38, 0.55], [0.4, 0.7], [0.44, 0.74], [0.44, 0.8], [0.38, 0.8],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  GEO.potBand = new THREE.TorusGeometry(0.385, 0.03, 8, 28).rotateX(Math.PI / 2);
  GEO.cone = new THREE.ConeGeometry(1, 1, 32, 1, true).translate(0, -0.5, 0);
}
initGeo();

// ── Renderer, scene, camera ────────────────────────

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0e1428, 90, 1300);
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 2500);
camera.rotation.order = 'YXZ';

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
for (const m of [MAT.brass, MAT.zinc, MAT.mirror, MAT.frame]) m.envMap = envTex;
const MIRROR_BALL = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12, envMap: envTex, flatShading: true });

const rtTarget = new THREE.WebGLRenderTarget(1024, 576, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.45, 0.35, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 2;
controls.maxDistance = 140;

// Sky dome
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunSize: { value: 1 },
  },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize;
    varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, ground, min(1.0, -h * 5.0));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      col += sunColor * (smoothstep(0.9994 - 0.0004 * sunSize, 0.9997, s) * 6.0 + pow(s, 12.0) * 0.35);
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMat);
sky.renderOrder = -10;
scene.add(sky);

const stars = (() => {
  const pos = [], r = rng(99);
  for (let i = 0; i < 2200; i++) {
    const a = r() * TAU, y = 0.05 + r() * 0.95, rr = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * rr * 1800, y * 1800, Math.sin(a) * rr * 1800);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
})();
scene.add(stars);

// Global lights
const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x8a7a5a, 1);
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 260 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
const ambient = new THREE.AmbientLight(0xffe2c0, 0.1);
scene.add(hemi, sun, sun.target, ambient);

// Follow spot (speeches, waltz, cake) and its visible beam
const spot = new THREE.SpotLight(0xfff2dc, 0, 45, 0.12, 0.45, 1.3);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0002;
scene.add(spot, spot.target);
const spotBeam = new THREE.Mesh(GEO.cone, BEAM.clone());
spotBeam.frustumCulled = false;
scene.add(spotBeam);

// Party lights (four warm moving spots over the dance floor)
const partyLights = [0xFFB45A, 0xFF9B7A, 0xFFE0A8, 0xFFC27A].map(c => {
  const l = new THREE.SpotLight(c, 0, 25, 0.22, 0.6, 1.2);
  const beam = new THREE.Mesh(GEO.cone, BEAM.clone());
  beam.material.uniforms.uColor.value = new THREE.Color(c);
  beam.frustumCulled = false;
  scene.add(l, l.target, beam);
  return { l, beam };
});

function aimBeam(beam, from, to, angle, opacity) {
  const dir = to.clone().sub(from);
  const len = dir.length();
  beam.position.copy(from);
  beam.quaternion.setFromUnitVectors(v3(0, -1, 0), dir.normalize());
  const r = Math.tan(angle) * len;
  beam.scale.set(r, len, r);
  beam.material.uniforms.uOpacity.value = opacity;
  beam.visible = opacity > 0.002;
}

// ── Times of day ───────────────────────────────────

const C = h => new THREE.Color(h);
const TIMES = {
  day: { top: C('#4F86C2'), hor: C('#E8DCC2'), gnd: C('#8E8457'), sun: C('#FFF1DC'), sunI: 3.4, sunEl: 58, sunAz: 205,
    hemiSky: C('#E4ECF5'), hemiGnd: C('#B09A70'), hemiI: 1.7, amb: 0.25, night: 0, bloom: 0.12, exp: 0.95, stars: 0, fog: C('#DCD3BF'), roofGlow: 0.45, sunSize: 1 },
  golden: { top: C('#5C6E9C'), hor: C('#F2AE72'), gnd: C('#5E4B33'), sun: C('#FFAC62'), sunI: 2.2, sunEl: 6, sunAz: 292,
    hemiSky: C('#F2C9A0'), hemiGnd: C('#5E4A30'), hemiI: 0.75, amb: 0.12, night: 0.5, bloom: 0.3, exp: 1.0, stars: 0, fog: C('#C99A78'), roofGlow: 0.18, sunSize: 3 },
  night: { top: C('#02040B'), hor: C('#111831'), gnd: C('#08080A'), sun: C('#8FA6D6'), sunI: 0.16, sunEl: 38, sunAz: 120,
    hemiSky: C('#26304F'), hemiGnd: C('#161009'), hemiI: 0.1, amb: 0.03, night: 1, bloom: 0.45, exp: 1.0, stars: 1, fog: C('#0B1024'), roofGlow: 0, sunSize: 0.6 },
};
const env = {};
for (const [k, v] of Object.entries(TIMES[state.time])) env[k] = v instanceof THREE.Color ? v.clone() : v;
function stepEnv(k) {
  const t = TIMES[state.time];
  for (const key in t) {
    if (t[key] instanceof THREE.Color) env[key].lerp(t[key], k);
    else env[key] += (t[key] - env[key]) * k;
  }
}

const MOMENTS = {
  dinner: { dim: 1, spot: 0, party: 0, live: null },
  speech: { dim: 0.35, spot: 1, party: 0, live: 'speech', label: 'Speeches · Les discours', angle: 0.075 },
  waltz: { dim: 0.28, spot: 1, party: 0, live: 'waltz', label: 'The first waltz', angle: 0.11, dancing: true },
  cake: { dim: 0.45, spot: 1, party: 0, live: 'cake', label: 'Cutting the cake', angle: 0.085 },
  party: { dim: 0.32, spot: 0, party: 1, live: null, dancing: true },
};
const mo = { dim: 1, spot: 0, party: 0, angle: 0.1 };

// ── World build ────────────────────────────────────

let world = null, lay = null;
const reg = {};              // show-key → objects it controls
const anim = {};             // objects animated each frame
const interiorLights = [];   // { light, base }
const glowSets = [];         // { points, day, night, key }
const obstacles = { circles: [], rects: [] };

function own(o) { o.userData.dispose = true; return o; }
function addTo(key, obj, parent = world) {
  (reg[key] ||= []).push(obj);
  parent.add(obj);
  return obj;
}
function addGlow(key, pts, day, night, parent, color) {
  if (!pts.length) return;
  const p = glowPoints(pts, color);
  glowSets.push({ points: p, day, night });
  addTo(key, p, parent);
}

function buildWorld() {
  if (world) {
    world.traverse(o => {
      if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose();
      if (o.material && o.material.isShaderMaterial && o.material !== BEAM) o.material.dispose();
    });
    scene.remove(world);
    for (const { light } of interiorLights) light.dispose?.();
  }
  for (const k in reg) delete reg[k];
  for (const k in anim) delete anim[k];
  interiorLights.length = 0;
  glowSets.length = 0;
  obstacles.circles.length = 0;
  obstacles.rects.length = 0;

  lay = computeLayout(state);
  world = new THREE.Group();
  scene.add(world);

  buildOutside();
  buildTent();
  buildDrapes();
  buildGarlands();
  buildChandeliers();
  buildHeadTable();
  buildRounds();
  buildDanceFloor();
  buildOlives();
  buildBars();
  buildDJ();
  buildCake();
  buildLounge();
  buildScreens();
  buildFigures();
  buildDisco();

  // follow spot hangs from the roof frame on the entrance side
  const sx = lay.W / 2 - 1.2;
  spot.position.set(sx, lay.roofY(sx) - 0.35, 0);
  lay.spotFrom = spot.position.clone();
  partyLights.forEach((p, i) => {
    const x = lay.dance.x + (i % 2 ? 1 : -1) * lay.dance.size / 2;
    const z = (i < 2 ? -1 : 1) * lay.dance.size / 2;
    p.l.position.set(x, lay.roofY(x) - 0.5, z);
  });

  applyVisibility();
  updatePanelInfo();
  sun.shadow.camera.left = -Math.max(lay.W, lay.L) * 0.75 - 8;
  sun.shadow.camera.right = -sun.shadow.camera.left;
  sun.shadow.camera.top = -sun.shadow.camera.left;
  sun.shadow.camera.bottom = sun.shadow.camera.left;
  sun.shadow.camera.updateProjectionMatrix();
}

function buildOutside() {
  const { W, L } = lay;
  const g = new THREE.Group();
  world.add(g);
  const ground = mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), MAT.grass, { cast: false });
  MAT.grass.map.repeat.set(600, 600);
  ground.position.y = -0.02;
  g.add(ground);
  const terrace = mesh(new THREE.PlaneGeometry(W + 10, L + 10).rotateX(-Math.PI / 2), MAT.gravel, { cast: false });
  MAT.gravel.map.repeat.set((W + 10) / 3, (L + 10) / 3);
  terrace.position.y = -0.01;
  g.add(terrace);
  const path = mesh(new THREE.PlaneGeometry(40, 3.2).rotateX(-Math.PI / 2), MAT.gravel, { cast: false });
  path.position.set(W / 2 + 5 + 20, -0.005, 0);
  g.add(path);

  const r = rng(11);
  // lanterns along the entrance path
  const lanterns = [];
  const lanternM = [];
  for (let x = W / 2 + 6; x < W / 2 + 44; x += 3) for (const s of [-1, 1]) {
    lanternM.push(mat(x, 0.15, s * 1.9, 0, 1.6, 2.2, 1.6));
    lanterns.push({ p: v3(x, 0.14, s * 1.9), size: 0.45, flicker: 0.3 });
  }
  g.add(instanced(GEO.votive, MAT.votive, lanternM, { cast: false }));
  addGlow('photophores', lanterns, 0.05, 1.1, g);

  // cypresses flanking the path, umbrella pines around the domaine
  const cyp = [];
  for (let x = W / 2 + 8; x < W / 2 + 44; x += 6) for (const s of [-1, 1]) cyp.push(mat(x, 0, s * 3.6, r() * TAU, 1, 0.9 + r() * 0.3));
  const cypGeo = new THREE.LatheGeometry([[0, 0], [0.45, 0.4], [0.7, 2.5], [0.6, 5], [0.3, 7], [0, 8]].map(([a, b]) => new THREE.Vector2(a, b)), 8);
  g.add(instanced(cypGeo, MAT.cypress, cyp));
  const trunks = [], crowns = [];
  for (let i = 0; i < 18; i++) {
    const a = r() * TAU, d = Math.max(W, L) / 2 + 14 + r() * 40;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (x > W / 2 && Math.abs(z) < 8) continue;
    const h = 7 + r() * 4, lean = (r() - 0.5) * 0.25;
    trunks.push(mat(x, h / 2, z, 0, 1, h, 1, lean, 0));
    for (let k = 0; k < 5; k++) {
      crowns.push(mat(x + (r() - 0.5) * 3.2, h + (r() - 0.3) * 0.9, z + (r() - 0.5) * 3.2, r() * TAU, 2.4 + r(), 0.7, 2.4 + r()));
    }
  }
  g.add(instanced(new THREE.CylinderGeometry(0.16, 0.24, 1, 8), MAT.trunk, trunks));
  g.add(instanced(new THREE.IcosahedronGeometry(1, 1), MAT.pine, crowns));

  // lavender rows on the entrance side
  const lavB = [], lavF = [];
  for (let row = 0; row < 12; row++) for (let z = -34; z <= 34; z += 0.9) {
    if (Math.abs(z) < 6) continue;
    const x = W / 2 + 9 + row * 1.6;
    lavB.push(mat(x, 0.18, z, r() * TAU, 0.42, 0.3, 0.42));
    lavF.push(mat(x, 0.36, z, r() * TAU, 0.4, 0.22, 0.4));
  }
  const half = new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI / 2);
  g.add(instanced(half, MAT.lavLeaf, lavB));
  g.add(instanced(half, MAT.lavender, lavF));

  // Mont Ventoux on the horizon, its bare limestone summit pale
  const mg = new THREE.ConeGeometry(520, 230, 40, 6);
  const col = [], p = mg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = (p.getY(i) + 115) / 230;
    const c = y > 0.72 ? new THREE.Color('#E9E4DA') : new THREE.Color('#5E6B55').lerp(new THREE.Color('#8C8E78'), y);
    col.push(c.r, c.g, c.b);
    p.setX(i, p.getX(i) * (1 + (y < 0.95 ? 0.55 : 0)));
  }
  mg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const ventoux = mesh(mg, MAT.mountain, { cast: false, receive: false });
  ventoux.position.set(-260, 100, -900);
  g.add(ventoux);
  const hills = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + r() * 0.2, d = 700 + r() * 300;
    hills.push(mat(Math.cos(a) * d, -20, Math.sin(a) * d, r() * TAU, 160 + r() * 140, 40 + r() * 50, 160 + r() * 120));
  }
  g.add(instanced(new THREE.IcosahedronGeometry(1, 1), MAT.pine, hills, { cast: false, receive: false }));
}

function buildTent() {
  const { W, L, eave, ridge, roofY } = lay;
  const g = new THREE.Group();
  world.add(g);

  const floor = mesh(new THREE.BoxGeometry(W + 0.3, 0.12, L + 0.3), MAT.sisal, { cast: false });
  MAT.sisal.map.repeat.set(W / 1.5, L / 1.5);
  floor.position.y = -0.06;
  g.add(floor);

  // aluminium frame: legs, rafters, ridge and eave purlins
  const nb = Math.max(2, Math.round(L / 5)), bay = L / nb;
  lay.frames = [...Array(nb + 1)].map((_, i) => -L / 2 + i * bay);
  lay.bay = bay;
  const legs = [], rafters = [];
  const rl = Math.hypot(W / 2, ridge - eave), ra = Math.atan2(ridge - eave, W / 2);
  for (const z of lay.frames) {
    for (const s of [-1, 1]) {
      legs.push(mat(s * W / 2, eave / 2, z, 0, 1, 1, 1));
      rafters.push(mat(s * W / 4, (eave + ridge) / 2, z, 0, 1, 1, 1, 0, -s * ra));
    }
  }
  const endPosts = [];
  for (let x = -W / 2 + 5; x < W / 2 - 0.5; x += 5) for (const z of [-L / 2, L / 2]) {
    const h = roofY(x);
    endPosts.push(mat(x, h / 2, z, 0, 1, h, 1));
  }
  const frameGroup = new THREE.Group();
  frameGroup.add(instanced(new THREE.BoxGeometry(0.12, eave, 0.2), MAT.frame, legs));
  frameGroup.add(instanced(new THREE.BoxGeometry(rl, 0.2, 0.1), MAT.frame, rafters));
  frameGroup.add(instanced(new THREE.BoxGeometry(0.1, 1, 0.1), MAT.frame, endPosts));
  for (const [x, y] of [[0, ridge], [-W / 2, eave], [W / 2, eave]]) {
    const b = mesh(new THREE.BoxGeometry(0.1, 0.16, L), MAT.frame);
    b.position.set(x, y, 0);
    frameGroup.add(b);
  }
  g.add(frameGroup);

  // roof and gables (seen from inside only when the cutaway is on)
  const roof = new THREE.Group();
  const o = 0.25;
  roof.add(mesh(quad(v3(-W / 2 - o, eave - o * ROOF_PITCH, -L / 2 - o), v3(-W / 2 - o, eave - o * ROOF_PITCH, L / 2 + o), v3(0, ridge, L / 2 + o), v3(0, ridge, -L / 2 - o), v3(-1, 2, 0)), MAT.roof));
  roof.add(mesh(quad(v3(W / 2 + o, eave - o * ROOF_PITCH, -L / 2 - o), v3(W / 2 + o, eave - o * ROOF_PITCH, L / 2 + o), v3(0, ridge, L / 2 + o), v3(0, ridge, -L / 2 - o), v3(1, 2, 0)), MAT.roof));
  for (const s of [-1, 1]) {
    const tri = new THREE.BufferGeometry().setFromPoints([v3(-W / 2, eave, s * L / 2), v3(W / 2, eave, s * L / 2), v3(0, ridge, s * L / 2)]);
    tri.computeVertexNormals();
    if (tri.attributes.normal.getZ(0) * s < 0) tri.setIndex([0, 2, 1]);
    tri.computeVertexNormals();
    roof.add(mesh(tri, MAT.roof));
  }
  addTo('roof', roof, g);

  // side walls
  const walls = new THREE.Group();
  const door = 1.6;
  if (state.walls === 'open') {
    const rolls = [];
    for (let i = 0; i < nb; i++) for (const s of [-1, 1]) rolls.push(mat(s * (W / 2 + 0.08), eave - 0.18, -L / 2 + (i + 0.5) * bay, 0, 1, bay - 0.3, 1, Math.PI / 2));
    walls.add(instanced(new THREE.CylinderGeometry(0.11, 0.11, 1, 10), MAT.ivory, rolls));
  } else {
    const wm = state.walls === 'glass' ? MAT.glass : MAT.roof;
    const panel = (a, b, c, d, want) => walls.add(mesh(quad(a, b, c, d, want), wm, { cast: state.walls !== 'glass' }));
    panel(v3(-W / 2, eave, -L / 2), v3(-W / 2, eave, L / 2), v3(-W / 2, 0, L / 2), v3(-W / 2, 0, -L / 2), v3(-1, 0, 0));
    panel(v3(W / 2, eave, -L / 2), v3(W / 2, eave, -door), v3(W / 2, 0, -door), v3(W / 2, 0, -L / 2), v3(1, 0, 0));
    panel(v3(W / 2, eave, door), v3(W / 2, eave, L / 2), v3(W / 2, 0, L / 2), v3(W / 2, 0, door), v3(1, 0, 0));
    panel(v3(W / 2, eave, -door), v3(W / 2, eave, door), v3(W / 2, 2.5, door), v3(W / 2, 2.5, -door), v3(1, 0, 0));
    for (const s of [-1, 1]) panel(v3(-W / 2, eave, s * L / 2), v3(W / 2, eave, s * L / 2), v3(W / 2, 0, s * L / 2), v3(-W / 2, 0, s * L / 2), v3(0, 0, s));
    if (state.walls === 'glass') {
      const mull = [];
      for (let z = -L / 2; z <= L / 2; z += 1.25) for (const s of [-1, 1]) {
        if (s > 0 && Math.abs(z) < door) continue;
        mull.push(mat(s * W / 2, eave / 2, z, 0, 1, 1, 1));
      }
      for (let x = -W / 2; x <= W / 2; x += 1.25) for (const s of [-1, 1]) mull.push(mat(x, eave / 2, s * L / 2, 0, 1, 1, 1));
      walls.add(instanced(new THREE.BoxGeometry(0.05, eave, 0.05), MAT.frame, mull));
    }
    // walls block walking, except the doorway
    const t = 0.15;
    obstacles.rects.push({ x0: -W / 2 - t, x1: -W / 2 + t, z0: -L / 2, z1: L / 2 });
    obstacles.rects.push({ x0: W / 2 - t, x1: W / 2 + t, z0: -L / 2, z1: -door });
    obstacles.rects.push({ x0: W / 2 - t, x1: W / 2 + t, z0: door, z1: L / 2 });
    for (const s of [-1, 1]) obstacles.rects.push({ x0: -W / 2, x1: W / 2, z0: s * L / 2 - t, z1: s * L / 2 + t });
  }
  g.add(walls);
  for (const m of legs) {
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    obstacles.circles.push({ x: p.x, z: p.z, r: 0.2 });
  }
}

function buildDrapes() {
  const { W, L, eave, roofY, frames, bay } = lay;
  const ceil = new THREE.Group();
  const nu = Math.ceil(bay / 0.05);
  for (let i = 0; i < frames.length - 1; i++) for (const s of [-1, 1]) {
    const z0 = frames[i];
    const geo = surface(nu, 22, (u, v) => {
      const x = s * (0.12 + v * (W / 2 - 0.3));
      const sag = 0.42 * Math.sin(Math.PI * u) * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.1)), 0.8);
      const pleat = 0.03 * (1 + Math.sin(u * bay * TAU / 0.32)) * Math.sin(Math.PI * v);
      return v3(x, roofY(x) - 0.14 - sag - pleat, z0 + u * bay);
    }, v3(0, -1, 0));
    ceil.add(mesh(geo, MAT.drape, { cast: false }));
  }
  // gathered rosettes where the drapes meet the ridge
  const ros = frames.map(z => mat(0, roofY(0) - 0.2, z, 0, 0.35, 0.18, 0.35));
  ceil.add(instanced(new THREE.SphereGeometry(1, 14, 10), MAT.drape, ros, { cast: false }));
  addTo('ceilingDrapes', ceil);

  // tied-back curtains at each pole, and swags along the eaves between them
  const wall = new THREE.Group();
  const poles = [];
  for (const z of frames) for (const s of [-1, 1]) poles.push({ x: s * W / 2, z, n: v3(-s, 0, 0), t: v3(0, 0, 1) });
  for (let x = -W / 2 + 5; x < W / 2 - 0.5; x += 5) for (const s of [-1, 1]) poles.push({ x, z: s * L / 2, n: v3(0, 0, -s), t: v3(1, 0, 0) });
  const tie = 1.15, top = eave - 0.08;
  const curtGeos = [];
  for (const p of poles) {
    const h = Math.abs(p.z) >= L / 2 - 0.01 ? Math.min(roofY(p.x), top + 1) - 0.1 : top;
    curtGeos.push(surface(36, 30, (u, v) => {
      const y = 0.02 + v * (h - 0.02);
      let hw;
      if (y > tie) hw = 0.13 + 0.55 * Math.pow((y - tie) / (h - tie), 0.7);
      else hw = 0.13 + 0.24 * Math.sqrt((tie - y) / tie);
      const a = (u * 2 - 1) * hw;
      const d = 0.07 + 0.035 * Math.sin((u * 2 - 1) * 15) + 0.09 * Math.exp(-((y - tie) ** 2) / 0.25);
      return v3(p.x + p.t.x * a + p.n.x * d, y, p.z + p.t.z * a + p.n.z * d);
    }));
  }
  wall.add(mesh(mergeGeometries(curtGeos), MAT.curtain, { cast: false }));
  const ties = poles.map(p => mat(p.x + p.n.x * 0.16, tie, p.z + p.n.z * 0.16, 0, 1));
  wall.add(instanced(new THREE.TorusGeometry(0.13, 0.025, 6, 16).rotateX(Math.PI / 2), MAT.brass, ties, { cast: false }));
  // eave swags between consecutive long-side poles
  const swags = [];
  for (const s of [-1, 1]) for (let i = 0; i < frames.length - 1; i++) {
    const za = frames[i], zb = frames[i + 1];
    swags.push(surface(40, 6, (u, v) => {
      const z = za + (zb - za) * u;
      const drop = (0.12 + 0.38 * Math.sin(Math.PI * u)) * v;
      return v3(s * (W / 2 - 0.1 - 0.06 * Math.sin(Math.PI * u) * v), top - drop, z);
    }));
  }
  wall.add(mesh(mergeGeometries(swags), MAT.curtain, { cast: false }));
  addTo('wallDrapes', wall);
}

function buildGarlands() {
  const { W, L, eave, roofY, dance } = lay;
  const g = new THREE.Group();
  const lines = [];
  if (state.garlandStyle === 'canopy') {
    const c = v3(dance.x, roofY(dance.x) - 0.45, 0);
    const per = [];
    const inset = 0.3, y = eave - 0.12;
    for (let z = -L / 2 + inset; z <= L / 2 - inset + 0.01; z += 2.5) per.push(v3(-W / 2 + inset, y, z), v3(W / 2 - inset, y, z));
    for (let x = -W / 2 + inset + 2.5; x < W / 2 - inset - 0.5; x += 2.5) per.push(v3(x, roofY(x) - 0.3, -L / 2 + inset), v3(x, roofY(x) - 0.3, L / 2 - inset));
    for (const e of per) {
      const len = c.distanceTo(e);
      lines.push(t => c.clone().lerp(e, t).add(v3(0, -0.05 * len * Math.sin(Math.PI * t), 0)));
    }
  } else {
    for (let z = -L / 2 + 1.25; z < L / 2; z += 2.5) {
      lines.push(t => {
        const x = -W / 2 + 0.3 + t * (W - 0.6);
        return v3(x, roofY(x) - 0.55 - 0.3 * Math.abs(Math.sin(Math.PI * x / 2.5)), z);
      });
    }
  }
  const wire = [], bulbs = [], glows = [];
  let metres = 0;
  for (const f of lines) {
    let prev = f(0), len = 0;
    for (let i = 1; i <= 60; i++) { const p = f(i / 60); len += p.distanceTo(prev); wire.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p; }
    metres += len;
    const n = Math.max(2, Math.round(len / 0.6));
    for (let i = 1; i < n; i++) {
      const p = f(i / n);
      bulbs.push(mat(p.x, p.y - 0.06, p.z));
      glows.push({ p: v3(p.x, p.y - 0.06, p.z), size: 0.2, flicker: 0.04 });
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x2a2620 })));
  g.add(instanced(GEO.bulb, BULB, bulbs, { cast: false, receive: false }));
  addGlow('garlands', glows, 0.06, 0.45, g);
  lay.garland = { metres: Math.round(metres), bulbs: bulbs.length };
  addTo('garlands', g);
}

function buildChandeliers() {
  const { roofY, frames, bay, dance } = lay;
  const g = new THREE.Group();
  const spots = [];
  for (let i = 0; i < frames.length - 1; i++) {
    const z = frames[i] + bay / 2;
    // the mirror ball takes the place over the dance floor
    if (Math.abs(z) < 0.6 && Math.abs(dance.x) < 3) continue;
    spots.push(z);
  }
  const y = roofY(0) - 1.9;
  const rings = [], small = [], chains = [], candles = [], flames = [], leaves = [], glows = [];
  const r = rng(5);
  for (const z of spots) {
    rings.push(mat(0, y, z));
    small.push(mat(0, y - 0.18, z, 0, 0.55));
    chains.push(mat(0, (y + roofY(0)) / 2, z, 0, 1, roofY(0) - y, 1));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU, x = Math.cos(a) * 0.55, zz = z + Math.sin(a) * 0.55;
      candles.push(mat(x, y + 0.08, zz));
      flames.push(mat(x, y + 0.16, zz));
      glows.push({ p: v3(x, y + 0.17, zz), size: 0.22, flicker: 0.25 });
    }
    for (let k = 0; k < 22; k++) {
      const a = r() * TAU;
      leaves.push(mat(Math.cos(a) * 0.55, y + (r() - 0.5) * 0.08, z + Math.sin(a) * 0.55, r() * TAU, 0.22, 0.13, 0.22));
    }
    const pl = new THREE.PointLight(0xFFB774, 0, 18, 1.6);
    pl.position.set(0, y - 0.3, z);
    interiorLights.push({ light: pl, base: 9 });
    g.add(pl);
  }
  const ring = new THREE.TorusGeometry(0.55, 0.018, 6, 40).rotateX(Math.PI / 2);
  g.add(instanced(ring, MAT.black, rings, { cast: false }));
  g.add(instanced(ring, MAT.black, small, { cast: false }));
  g.add(instanced(new THREE.CylinderGeometry(0.01, 0.01, 1, 4), MAT.black, chains, { cast: false }));
  g.add(instanced(GEO.candle, MAT.ivory, candles, { cast: false }));
  g.add(instanced(GEO.flame, FLAME, flames, { cast: false, receive: false }));
  g.add(instanced(GEO.clump, MAT.leaf, leaves, { cast: false }));
  addGlow('chandeliers', glows, 0.15, 1.0, g);
  lay.chandeliers = spots.length;
  addTo('chandeliers', g);

  // two soft fill lights along the length so the far tables are not in the dark
  for (const z of [-lay.L / 3, lay.L / 3]) {
    const pl = new THREE.PointLight(0xFFC08A, 0, 20, 1.6);
    pl.position.set(lay.W / 4, lay.eave - 0.4, z);
    interiorLights.push({ light: pl, base: 6 });
    world.add(pl);
  }
}

function tableware(g, cx, cz, tableR, top, seats, startA = 0) {
  const out = { plates: [], chargers: [], glasses: [], napkins: [] };
  for (let i = 0; i < seats; i++) {
    const a = startA + (i / seats) * TAU;
    const rp = tableR - 0.22;
    out.chargers.push(mat(cx + Math.cos(a) * rp, top + 0.004, cz + Math.sin(a) * rp));
    out.plates.push(mat(cx + Math.cos(a) * rp, top + 0.016, cz + Math.sin(a) * rp));
    const ga = a + 0.22, rg = tableR - 0.42;
    out.glasses.push(mat(cx + Math.cos(ga) * rg, top, cz + Math.sin(ga) * rg));
    out.napkins.push(mat(cx + Math.cos(a) * rp, top + 0.03, cz + Math.sin(a) * rp, -a, 1));
  }
  return out;
}

function buildHeadTable() {
  const { W, headX, headLen, headSeats } = lay;
  const g = new THREE.Group();
  const stageH = 0.25, top = stageH + 0.76;
  const stage = mesh(new THREE.BoxGeometry(2.0, stageH, headLen + 1.6), MAT.darkWood);
  stage.position.set(-W / 2 + 1.3, stageH / 2, 0);
  g.add(stage);
  const stageRug = mesh(new THREE.BoxGeometry(1.95, 0.01, headLen + 1.5), MAT.sisal, { cast: false });
  stageRug.position.set(-W / 2 + 1.3, stageH + 0.005, 0);
  g.add(stageRug);
  const cloth = mesh(new THREE.BoxGeometry(0.92, 0.76, headLen), MAT.linen);
  cloth.position.set(headX, stageH + 0.38, 0);
  g.add(cloth);
  obstacles.rects.push({ x0: -W / 2, x1: headX + 0.5, z0: -headLen / 2 - 0.2, z1: headLen / 2 + 0.2 });

  // chairs all on the wall side, facing the room
  const chairs = [], cush = [];
  for (let i = 0; i < headSeats; i++) {
    const z = -headLen / 2 + 0.3 + 0.325 + i * 0.65;
    chairs.push(mat(headX - 0.62, stageH, z, Math.PI / 2));
    cush.push(chairs[chairs.length - 1]);
  }
  const ch = new THREE.Group();
  ch.add(instanced(GEO.frame, MAT.wood, chairs), instanced(GEO.cane, MAT.cane, chairs), instanced(GEO.cushion, MAT.ivory, cush));
  addTo('chairs', ch, g);

  // place settings, an olive-branch runner, brass candlesticks and photophores
  const tw = new THREE.Group();
  const plates = [], chargers = [], glasses = [], runner = [], roses = [], sticks = [], candles = [], flames = [], votives = [], vflames = [], glows = [];
  const r = rng(21);
  for (let i = 0; i < headSeats; i++) {
    const z = -headLen / 2 + 0.3 + 0.325 + i * 0.65;
    chargers.push(mat(headX - 0.2, top + 0.004, z));
    plates.push(mat(headX - 0.2, top + 0.016, z));
    glasses.push(mat(headX + 0.02, top, z + 0.16));
  }
  for (let z = -headLen / 2 + 0.2; z < headLen / 2 - 0.1; z += 0.12) {
    runner.push(mat(headX + 0.2 + (r() - 0.5) * 0.08, top + 0.04, z, r() * TAU, 0.16, 0.08, 0.2));
    if (r() < 0.35) roses.push(mat(headX + 0.2 + (r() - 0.5) * 0.1, top + 0.07, z));
  }
  for (let z = -headLen / 2 + 0.6; z < headLen / 2 - 0.3; z += 1.3) {
    sticks.push(mat(headX + 0.2, top + 0.15, z, 0, 1, 1, 1));
    candles.push(mat(headX + 0.2, top + 0.36, z, 0, 1, 1.6, 1));
    flames.push(mat(headX + 0.2, top + 0.48, z));
    glows.push({ p: v3(headX + 0.2, top + 0.49, z), size: 0.38, flicker: 0.3 });
  }
  for (let z = -headLen / 2 + 0.95; z < headLen / 2 - 0.3; z += 0.65) {
    votives.push(mat(headX + 0.32, top + 0.045, z));
    vflames.push(mat(headX + 0.32, top + 0.04, z));
    glows.push({ p: v3(headX + 0.32, top + 0.06, z), size: 0.42, flicker: 0.4 });
  }
  tw.add(instanced(GEO.charger, MAT.brass, chargers, { cast: false }), instanced(GEO.plate, MAT.porcelain, plates, { cast: false }),
    instanced(GEO.glass, MAT.crystal, glasses, { cast: false }), instanced(GEO.clump, MAT.leaf, runner), instanced(GEO.rose, MAT.rose, roses),
    instanced(new THREE.CylinderGeometry(0.025, 0.04, 0.3, 10), MAT.brass, sticks));
  addTo('tableware', tw, g);
  const ph = new THREE.Group();
  ph.add(instanced(GEO.candle, MAT.ivory, candles, { cast: false }), instanced(GEO.flame, FLAME, flames, { cast: false, receive: false }),
    instanced(GEO.votive, MAT.votive, votives, { cast: false }), instanced(GEO.flame, FLAME, vflames, { cast: false, receive: false }));
  addTo('photophores', ph, g);
  addGlow('photophores', glows, 0.25, 1.0, ph);
  lay.headPhotophores = votives.length + candles.length;

  // backdrop drape and a curtain of fairy lights
  const cur = new THREE.Group();
  const span = headLen + 2.2, bx = -W / 2 + 0.3;
  cur.add(mesh(surface(Math.ceil(span / 0.04), 6, (u, v) => v3(bx + 0.05 * (1 + Math.sin(u * span * TAU / 0.25)), stageH + v * (lay.eave - 0.15 - stageH), -span / 2 + u * span), v3(1, 0, 0)), MAT.curtain, { cast: false }));
  const fb = [], fg = [];
  for (let z = -span / 2 + 0.1; z < span / 2; z += 0.22) for (let y = stageH + 0.3; y < lay.eave - 0.2; y += 0.2) {
    fb.push(mat(bx + 0.2, y + (r() - 0.5) * 0.06, z, 0, 0.35));
    fg.push({ p: v3(bx + 0.2, y, z), size: 0.09, flicker: 0.7, color: [1.0, 0.72, 0.42] });
  }
  cur.add(instanced(GEO.bulb, BULB, fb, { cast: false, receive: false }));
  addGlow('curtain', fg, 0.2, 1.0, cur);
  addTo('curtain', cur, g);

  const mic = new THREE.Group();
  mic.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 6).translate(0, 0.72, 0), MAT.black));
  mic.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), MAT.black));
  mic.add(mesh(new THREE.SphereGeometry(0.03, 8, 6).translate(0, 1.47, 0), MAT.zinc));
  mic.position.set(lay.speech.x + 0.35, 0, lay.speech.z);
  anim.mic = mic;
  g.add(mic);
  addTo('headTable', g);
}

function buildRounds() {
  const cleared = new THREE.Group();
  world.add(cleared);
  anim.cleared = cleared;
  buildRoundSet(lay.tables.filter(t => !t.cleared), world);
  buildRoundSet(lay.tables.filter(t => t.cleared), cleared);
}
function buildRoundSet(tables, parent) {
  const { tableR } = lay;
  const per = state.perTable;
  const top = 0.76;
  const g = new THREE.Group();
  const tm = tables.map(t => mat(t.x, 0, t.z));
  g.add(instanced(new THREE.CylinderGeometry(tableR + 0.03, tableR + 0.16, top, 44, 1).translate(0, top / 2, 0), MAT.linen, tm));
  g.add(instanced(new THREE.CylinderGeometry(tableR + 0.03, tableR + 0.03, 0.015, 44).translate(0, top, 0), MAT.linen, tm));
  for (const t of tables) obstacles.circles.push({ x: t.x, z: t.z, r: tableR + 0.42, cleared: t.cleared });
  addTo('rounds', g, parent);

  const chairs = [];
  for (const t of tables) for (let i = 0; i < per; i++) {
    const a = (i / per) * TAU;
    const rc = tableR + 0.33;
    chairs.push(mat(t.x + Math.cos(a) * rc, 0, t.z + Math.sin(a) * rc, Math.atan2(-Math.cos(a), -Math.sin(a))));
  }
  const ch = new THREE.Group();
  ch.add(instanced(GEO.frame, MAT.wood, chairs), instanced(GEO.cane, MAT.cane, chairs), instanced(GEO.cushion, MAT.ivory, chairs));
  addTo('chairs', ch, parent);

  const tw = new THREE.Group();
  const all = { plates: [], chargers: [], glasses: [], napkins: [] };
  const leaves = [], roses = [];
  const r = rng(3);
  for (const t of tables) {
    const s = tableware(tw, t.x, t.z, tableR, top + 0.008, per);
    for (const k in all) all[k].push(...s[k]);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + r() * 0.3, rr = 0.12 + r() * 0.08;
      leaves.push(mat(t.x + Math.cos(a) * rr, top + 0.07, t.z + Math.sin(a) * rr, r() * TAU, 0.22, 0.12, 0.26));
    }
    for (let k = 0; k < 7; k++) {
      const a = r() * TAU, rr = r() * 0.14;
      roses.push(mat(t.x + Math.cos(a) * rr, top + 0.12 + r() * 0.04, t.z + Math.sin(a) * rr, 0, 0.9 + r() * 0.4));
    }
  }
  tw.add(instanced(GEO.charger, MAT.brass, all.chargers, { cast: false }), instanced(GEO.plate, MAT.porcelain, all.plates, { cast: false }),
    instanced(GEO.glass, MAT.crystal, all.glasses, { cast: false }), instanced(GEO.napkin, MAT.oliveCushion, all.napkins, { cast: false }),
    instanced(GEO.clump, MAT.leaf, leaves), instanced(GEO.rose, MAT.rose, roses));
  addTo('tableware', tw, parent);

  // photophores in a ring around each centrepiece
  const ph = new THREE.Group();
  const vot = [], fl = [], glows = [];
  const n = state.photophores;
  for (const t of tables) for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + 0.3, rr = 0.36;
    const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
    vot.push(mat(x, top + 0.055, z));
    fl.push(mat(x, top + 0.05, z));
    glows.push({ p: v3(x, top + 0.07, z), size: 0.3, flicker: 0.4 });
  }
  ph.add(instanced(GEO.votive, MAT.votive, vot, { cast: false }), instanced(GEO.flame, FLAME, fl, { cast: false, receive: false }));
  addGlow('photophores', glows, 0.25, 1.0, ph);
  addTo('photophores', ph, parent);
}

function buildDanceFloor() {
  const { dance } = lay;
  const D = dance.size;
  const g = new THREE.Group();
  const f = mesh(new THREE.BoxGeometry(D, 0.04, D), MAT.parquet, { cast: false });
  MAT.parquet.map.repeat.set(D / 2.4, D / 2.4);
  f.position.set(dance.x, 0.02, 0);
  g.add(f);
  for (const [w, d, x, z] of [[D + 0.06, 0.03, 0, D / 2], [D + 0.06, 0.03, 0, -D / 2], [0.03, D, D / 2, 0], [0.03, D, -D / 2, 0]]) {
    const b = mesh(new THREE.BoxGeometry(w, 0.045, d), MAT.brass, { cast: false });
    b.position.set(dance.x + x, 0.022, z);
    g.add(b);
  }
  addTo('dance', g);
}

function buildOlives() {
  const g = new THREE.Group();
  const pots = [], bands = [], trunks = [], low = [], high = [], pools = [], bulbs = [], glows = [];
  const r = rng(42);
  const trunkGeos = [];
  const T = 1.25;   // a little larger than life so they read from across the tent
  for (const o of lay.olives) {
    pots.push(mat(o.x, 0, o.z, r() * TAU, T));
    bands.push(mat(o.x, 0.52 * T, o.z, 0, T));
    obstacles.circles.push({ x: o.x, z: o.z, r: 0.6 });
    // a gnarled trunk splitting into three limbs
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + r();
      const pts = [v3(0, 0.72, 0), v3(0.05 * Math.cos(a + 1), 1.1, 0.05 * Math.sin(a + 1)), v3(0.25 * Math.cos(a), 1.6, 0.25 * Math.sin(a)), v3(0.45 * Math.cos(a), 2.0 + r() * 0.2, 0.45 * Math.sin(a))];
      trunkGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => p.multiplyScalar(T))), 10, (0.065 - k * 0.01) * T, 6).translate(o.x, 0, o.z));
    }
    for (let k = 0; k < 90; k++) {
      const a = r() * TAU, rr = Math.sqrt(r()) * 1.05 * T, y = (2.1 + (r() - 0.45) * 0.8) * T;
      const sc = (0.4 + r() * 0.3) * T;
      const m = mat(o.x + Math.cos(a) * rr, y, o.z + Math.sin(a) * rr, r() * TAU, sc, sc * 0.6, sc, (r() - 0.5) * 0.6);
      (y < 2.3 * T ? low : high).push(m);
    }
    for (let k = 0; k < 36; k++) {
      const a = r() * TAU, rr = (0.3 + r() * 0.7) * T, y = (1.7 + r() * 0.8) * T;
      const p = v3(o.x + Math.cos(a) * rr, y, o.z + Math.sin(a) * rr);
      bulbs.push(mat(p.x, p.y, p.z, 0, 0.3));
      glows.push({ p, size: 0.11, flicker: 0.6, color: [1.0, 0.7, 0.38] });
    }
    pools.push(mat(o.x, 0.012, o.z, 0, 4, 1, 4));
  }
  if (!lay.olives.length) { lay.oliveGroup = null; addTo('olives', g); return; }
  g.add(instanced(GEO.pot, MAT.terracotta, pots), instanced(GEO.potBand, MAT.glaze, bands));
  g.add(mesh(mergeGeometries(trunkGeos), MAT.trunk));
  g.add(instanced(GEO.clump, MAT.leafLit, low), instanced(GEO.clump, MAT.leafTop, high));
  g.add(instanced(GEO.bulb, BULB, bulbs, { cast: false, receive: false }));
  g.add(instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), POOL, pools, { cast: false, receive: false }));
  // faint uplight beams from each pot into the canopy
  const beam = BEAM.clone();
  beam.uniforms.uColor.value = new THREE.Color(1.0, 0.62, 0.3);
  const cones = lay.olives.map(o => {
    const m = new THREE.Matrix4().compose(v3(o.x, 0.95, o.z), new THREE.Quaternion().setFromUnitVectors(v3(0, -1, 0), v3(0, 1, 0)), v3(1.15, 1.9, 1.15));
    return m;
  });
  const coneMesh = instanced(GEO.cone, beam, cones, { cast: false, receive: false });
  g.add(coneMesh);
  anim.oliveBeam = beam;
  addGlow('olives', glows, 0.12, 1.0, g);
  addTo('olives', g);
}

function buildBars() {
  const g = new THREE.Group();
  const r = rng(8);
  for (const b of lay.bars) {
    const bar = new THREE.Group();
    bar.position.set(b.x, 0, b.z);
    bar.rotation.y = b.face > 0 ? 0 : Math.PI;
    const front = mesh(new THREE.BoxGeometry(4, 1.06, 0.6), MAT.ivory);
    front.position.y = 0.53;
    const top = mesh(new THREE.BoxGeometry(4.2, 0.05, 0.75), MAT.zinc);
    top.position.y = 1.085;
    const rail = mesh(new THREE.CylinderGeometry(0.02, 0.02, 4, 8).rotateZ(Math.PI / 2), MAT.brass);
    rail.position.set(0, 0.16, 0.42);
    const panels = [];
    for (let x = -1.6; x <= 1.61; x += 0.8) panels.push(mat(x, 0.55, 0.305));
    bar.add(front, top, rail, instanced(new THREE.BoxGeometry(0.62, 0.7, 0.02), MAT.linen, panels));
    const back = mesh(new THREE.BoxGeometry(3.6, 0.9, 0.45), MAT.darkWood);
    back.position.set(0, 0.45, -1.3);
    const mirror = mesh(new THREE.BoxGeometry(3.6, 1.3, 0.03), MAT.mirror);
    mirror.position.set(0, 1.65, -1.5);
    const shelves = [], bottles = { g: [], a: [], c: [] };
    for (const y of [1.25, 1.65, 2.05]) {
      shelves.push(mat(0, y, -1.35));
      for (let x = -1.6; x <= 1.6; x += 0.18) {
        const k = r();
        (k < 0.4 ? bottles.g : k < 0.7 ? bottles.a : bottles.c).push(mat(x, y + 0.015, -1.35, 0, 1, 0.9 + r() * 0.3, 1));
      }
    }
    bar.add(back, mirror, instanced(new THREE.BoxGeometry(3.6, 0.03, 0.3), MAT.darkWood, shelves));
    bar.add(instanced(GEO.bottle, MAT.bottleG, bottles.g), instanced(GEO.bottle, MAT.bottleA, bottles.a), instanced(GEO.bottle, MAT.bottleC, bottles.c));
    // pendant bulbs over the counter
    const pend = [], pg = [];
    for (const x of [-1.3, 0, 1.3]) {
      pend.push(mat(x, 2.2, 0, 0, 2));
      pg.push({ p: v3(x, 2.2, 0), size: 0.6, flicker: 0.03 });
    }
    bar.add(instanced(GEO.bulb, BULB, pend, { cast: false, receive: false }));
    const pl = new THREE.PointLight(0xFFBE80, 0, 8, 1.6);
    pl.position.set(0, 2.1, 0.2);
    interiorLights.push({ light: pl, base: 3 });
    bar.add(pl);
    if (b.label === 'Champagne') {
      const coupes = [];
      for (let lvl = 0; lvl < 5; lvl++) {
        const n = 5 - lvl, sp = 0.115;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) coupes.push(mat(-1.2 + (i - (n - 1) / 2) * sp, 1.11 + lvl * 0.1, (j - (n - 1) / 2) * sp));
      }
      bar.add(instanced(GEO.coupe, MAT.crystal, coupes, { cast: false }));
      lay.coupes = coupes.length;
    }
    bar.updateMatrixWorld(true);
    // neon sign above the mirror
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), NEON.clone());
    sign.material.map = TEX.neon[b.label];
    sign.material.color = new THREE.Color(2.2, 1.9, 1.6);
    sign.position.set(0, 2.62, -1.47);
    bar.add(sign);
    addTo('neon', sign, bar);
    addGlow('bars', pg, 0.2, 1.0, bar);
    g.add(bar);
    const ox = 2.2, oz0 = b.face > 0 ? -1.6 : -0.45, oz1 = b.face > 0 ? 0.45 : 1.6;
    obstacles.rects.push({ x0: b.x - ox, x1: b.x + ox, z0: b.z + oz0, z1: b.z + oz1 });
  }
  addTo('bars', g);
}

function buildDJ() {
  const g = new THREE.Group();
  if (lay.dj) {
    const { dj, dance } = lay;
    const booth = new THREE.Group();
    booth.position.set(dj.x, 0, dj.z);
    booth.rotation.y = Math.atan2(dance.x - dj.x, dance.z - dj.z);
    const desk = mesh(new THREE.BoxGeometry(2, 1.05, 0.7), MAT.darkWood);
    desk.position.y = 0.525;
    const topM = mesh(new THREE.BoxGeometry(2.05, 0.04, 0.75), MAT.brass);
    topM.position.y = 1.07;
    booth.add(desk, topM);
    for (const x of [-0.55, 0.55]) {
      const d = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24), MAT.black);
      d.position.set(x, 1.11, 0);
      booth.add(d);
    }
    const mixer = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.35), MAT.black);
    mixer.position.set(0, 1.12, 0);
    booth.add(mixer);
    for (const x of [-1.5, 1.5]) {
      const st = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), MAT.black);
      st.position.set(x, 0.65, 0);
      const sp = mesh(new THREE.BoxGeometry(0.5, 0.8, 0.42), MAT.speaker);
      sp.position.set(x, 1.7, 0);
      booth.add(st, sp);
    }
    const led = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.01), BULB);
    led.position.set(0, 0.95, 0.36);
    booth.add(led);
    g.add(booth);
    obstacles.rects.push({ x0: dj.x - 1.4, x1: dj.x + 1.4, z0: dj.z - 1.2, z1: dj.z + 1.2 });
  }
  addTo('dj', g);
}

function buildCake() {
  const g = new THREE.Group();
  if (state.show.cake) {
    const { cake } = lay;
    g.position.set(cake.x, 0, cake.z);
    g.add(mesh(new THREE.CylinderGeometry(0.47, 0.55, 0.76, 32).translate(0, 0.38, 0), MAT.linen));
    const stand = mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.1, 24).translate(0, 0.81, 0), MAT.brass);
    g.add(stand);
    let y = 0.86;
    for (const [rr, h] of [[0.2, 0.16], [0.16, 0.15], [0.12, 0.14], [0.085, 0.13]]) {
      g.add(mesh(new THREE.CylinderGeometry(rr, rr, h, 32).translate(0, y + h / 2, 0), MAT.cake));
      y += h;
    }
    const r = rng(77);
    const sprigs = [], roses = [];
    for (let k = 0; k < 14; k++) {
      const a = r() * TAU, yy = 0.9 + r() * 0.5, rr = 0.2 - (yy - 0.86) * 0.2;
      sprigs.push(mat(Math.cos(a) * rr, yy, Math.sin(a) * rr, r() * TAU, 0.12, 0.06, 0.15));
      if (k % 2) roses.push(mat(Math.cos(a) * rr, yy, Math.sin(a) * rr, 0, 0.8));
    }
    g.add(instanced(GEO.clump, MAT.leaf, sprigs), instanced(GEO.rose, MAT.rose, roses));
    obstacles.circles.push({ x: cake.x, z: cake.z, r: 0.6 });
  }
  addTo('cake', g);
}

function buildLounge() {
  const g = new THREE.Group();
  if (lay.lounge) {
    const { lounge } = lay;
    g.position.set(lounge.x, 0, lounge.z);
    g.add(mesh(new THREE.BoxGeometry(4, 0.012, 3).translate(0, 0.006, 0), MAT.rugM, { cast: false }));
    for (const s of [-1, 1]) {
      const sofa = new THREE.Group();
      sofa.position.z = s * 1.05;
      sofa.rotation.y = s > 0 ? Math.PI : 0;
      sofa.add(mesh(new THREE.BoxGeometry(2.1, 0.42, 0.85).translate(0, 0.21, 0), MAT.ivory));
      sofa.add(mesh(new THREE.BoxGeometry(2.1, 0.45, 0.2).translate(0, 0.62, -0.33), MAT.ivory));
      for (const x of [-1.0, 1.0]) sofa.add(mesh(new THREE.BoxGeometry(0.16, 0.62, 0.85).translate(x, 0.31, 0), MAT.ivory));
      sofa.add(mesh(new THREE.BoxGeometry(0.42, 0.38, 0.12).translate(-0.55, 0.62, -0.2), MAT.terraCushion));
      sofa.add(mesh(new THREE.BoxGeometry(0.42, 0.38, 0.12).translate(0.55, 0.62, -0.2), MAT.oliveCushion));
      g.add(sofa);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.4, 32).translate(0, 0.2, 0), MAT.travertine));
    const lamp = mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.3, 16, 1, true).translate(1.6, 1.5, 0), MAT.curtain);
    g.add(lamp, mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6).translate(1.6, 0.7, 0), MAT.brass));
    addGlow('lounge', [{ p: v3(1.6, 1.45, 0), size: 0.9, flicker: 0.02 }], 0.1, 1.0, g);
    const pl = new THREE.PointLight(0xFFB774, 0, 6, 1.6);
    pl.position.set(1.6, 1.4, 0);
    interiorLights.push({ light: pl, base: 2 });
    g.add(pl);
    obstacles.rects.push({ x0: lounge.x - 1.1, x1: lounge.x + 1.1, z0: lounge.z - 1.5, z1: lounge.z + 1.5 });
  }
  addTo('lounge', g);
}

function buildScreens() {
  const { L, ridge } = lay;
  const g = new THREE.Group();
  const cy = Math.min(3.75, ridge - 1.75);
  anim.lowerThird = new THREE.MeshBasicMaterial({ map: lowerThirdTex(''), transparent: true, depthWrite: false });
  for (const s of [-1, 1]) {
    const scr = new THREE.Group();
    scr.position.set(0, 0, s * (L / 2 - 0.55));
    scr.rotation.y = s > 0 ? Math.PI : 0;
    for (const x of [-2.75, 2.75]) {
      const leg = mesh(new THREE.BoxGeometry(0.29, cy + 1.55, 0.29), MAT.black);
      leg.position.set(x, (cy + 1.55) / 2, 0);
      scr.add(leg);
      obstacles.circles.push({ x, z: s * (L / 2 - 0.55), r: 0.3 });
    }
    const beam = mesh(new THREE.BoxGeometry(5.8, 0.29, 0.29), MAT.black);
    beam.position.set(0, cy + 1.55, 0);
    const bezel = mesh(new THREE.BoxGeometry(5.0, 2.9, 0.1), MAT.black);
    bezel.position.set(0, cy, 0);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.7), SCREEN);
    panel.position.set(0, cy, 0.06);
    const lt = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.7), anim.lowerThird);
    lt.position.set(0, cy, 0.065);
    scr.add(beam, bezel, panel, lt);
    g.add(scr);
  }
  addTo('screens', g);
}

function figure(dress) {
  const f = new THREE.Group();
  if (dress) {
    f.add(mesh(new THREE.ConeGeometry(0.42, 1.0, 24).translate(0, 0.5, 0), MAT.dress));
    f.add(mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.42, 12).translate(0, 1.2, 0), MAT.dress));
    f.add(mesh(new THREE.SphereGeometry(0.1, 12, 10).translate(0, 1.52, 0), MAT.skin));
    f.add(mesh(new THREE.ConeGeometry(0.28, 1.2, 16, 1, true).translate(0, 1.0, -0.06), MAT.crystal));
  } else {
    f.add(mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.9, 12).translate(0, 0.45, 0), MAT.suit));
    f.add(mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.62, 12).translate(0, 1.2, 0), MAT.suit));
    f.add(mesh(new THREE.SphereGeometry(0.11, 12, 10).translate(0, 1.64, 0), MAT.skin));
  }
  return f;
}
function buildFigures() {
  const couple = new THREE.Group();
  const bride = figure(true), groom = figure(false);
  bride.position.x = -0.2; groom.position.x = 0.2;
  bride.rotation.y = Math.PI / 2; groom.rotation.y = -Math.PI / 2;
  couple.add(bride, groom);
  world.add(couple);
  anim.couple = couple;
  const speaker = figure(false);
  speaker.position.set(lay.speech.x, 0, lay.speech.z);
  speaker.rotation.y = Math.PI / 2;
  world.add(speaker);
  anim.speaker = speaker;
}

function buildDisco() {
  const { dance, roofY } = lay;
  const g = new THREE.Group();
  const y = roofY(dance.x) - 1.3;
  const ball = mesh(new THREE.IcosahedronGeometry(0.36, 3), MIRROR_BALL, { cast: false });
  ball.position.set(dance.x, y, 0);
  g.add(ball, mesh(new THREE.CylinderGeometry(0.008, 0.008, roofY(dance.x) - y, 4).translate(dance.x, (roofY(dance.x) + y) / 2, 0), MAT.black));
  anim.ball = ball;
  // reflections that sweep the floor and walls while the ball turns
  const spin = new THREE.Group();
  spin.position.set(dance.x, 0, 0);
  const pts = [], r = rng(13);
  const R = Math.min(lay.W, lay.L) / 2 - 0.4;
  for (let i = 0; i < 380; i++) {
    const a = r() * TAU;
    if (i % 2) {
      const d = 1 + r() * (R - 1);
      pts.push({ p: v3(Math.cos(a) * d, 0.06, Math.sin(a) * d), size: 0.09, flicker: 0.5, color: [1, 0.9, 0.75] });
    } else {
      pts.push({ p: v3(Math.cos(a) * R, 0.4 + r() * 2.4, Math.sin(a) * R), size: 0.1, flicker: 0.5, color: [1, 0.9, 0.75] });
    }
  }
  const sp = glowPoints(pts);
  spin.add(sp);
  g.add(spin);
  anim.sparkles = sp;
  anim.spin = spin;
  addTo('disco', g);
}

// ── Visibility and materials that follow the panel ──

function applyVisibility() {
  const plan = state.view === 'plan';
  for (const [key, objs] of Object.entries(reg)) {
    const on = (state.show[key] ?? true) && !(plan && PLAN_HIDE.has(key));
    for (const o of objs) o.visible = on;
  }
  const cut = state.show.cutaway;
  MAT.roof.side = cut ? THREE.BackSide : THREE.DoubleSide;
  MAT.glass.side = cut ? THREE.BackSide : THREE.DoubleSide;
  MAT.drape.side = cut ? THREE.FrontSide : THREE.DoubleSide;
  MAT.roof.needsUpdate = MAT.glass.needsUpdate = MAT.drape.needsUpdate = true;
  bloom.enabled = state.show.bloom;
}

// ── Walking ────────────────────────────────────────

const walk = { yaw: Math.PI / 2, pitch: 0, keys: new Set(), pad: new Set(), drag: null };
const EYE = 1.65;

function enterWalk(fromEntrance) {
  controls.enabled = false;
  if (fromEntrance || !walk.placed) {
    camera.position.set(lay.W / 2 + 6, EYE, 0);
    walk.yaw = Math.PI / 2;
    walk.pitch = -0.02;
    walk.placed = true;
  }
  camera.near = 0.05;
  camera.updateProjectionMatrix();
}
function collide(p) {
  const pr = 0.28;
  const dancing = MOMENTS[state.moment].dancing;
  for (const c of obstacles.circles) {
    if (c.cleared && dancing) continue;
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + pr;
    if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
  }
  for (const r of obstacles.rects) {
    const cx = Math.max(r.x0, Math.min(p.x, r.x1)), cz = Math.max(r.z0, Math.min(p.z, r.z1));
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d < pr) {
      if (d > 1e-6) { p.x = cx + dx / d * pr; p.z = cz + dz / d * pr; }
      else {
        // inside the rectangle: push out the nearest side
        const opts = [[r.x0 - pr - p.x, 0], [r.x1 + pr - p.x, 0], [0, r.z0 - pr - p.z], [0, r.z1 + pr - p.z]];
        opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        p.x += opts[0][0]; p.z += opts[0][1];
      }
    }
  }
  p.x = Math.max(-70, Math.min(70, p.x));
  p.z = Math.max(-70, Math.min(70, p.z));
}
function stepWalk(dt) {
  const k = walk.keys, pd = walk.pad;
  const f = (k.has('KeyW') || k.has('ArrowUp') || pd.has('f') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') || pd.has('b') ? 1 : 0);
  const s = (k.has('KeyD') || pd.has('r') ? 1 : 0) - (k.has('KeyA') || pd.has('l') ? 1 : 0);
  const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
  walk.yaw += turn * dt * 1.6;
  const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 4.2 : 1.9) * dt;
  const fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw);
  const p = camera.position;
  for (let i = 0; i < 2; i++) {          // two half-steps keep collisions solid
    p.x += (fx * f + Math.cos(walk.yaw) * s) * speed / 2;
    p.z += (fz * f - Math.sin(walk.yaw) * s) * speed / 2;
    collide(p);
  }
  p.y = EYE;
  camera.rotation.set(walk.pitch, walk.yaw, 0);
}

// ── Views ──────────────────────────────────────────

function setView(v, fromEntrance) {
  state.view = v;
  const { W, L } = lay;
  document.getElementById('help').textContent = v === 'walk'
    ? 'Drag to look · W A S D / Z Q S D or arrows to move · Shift to hurry · click the map to jump'
    : v === 'plan' ? 'Floor plan · drag to pan around, scroll to zoom' : 'Drag to turn · right-drag to pan · scroll to zoom';
  document.getElementById('pad').classList.toggle('show', v === 'walk');
  if (v === 'walk') enterWalk(fromEntrance);
  else {
    controls.enabled = true;
    if (v === 'plan') {
      controls.target.set(0, 0, 0);
      // head table at the top, like the mini-map; high enough to fit the whole tent
      const fit = Math.max(W + 4, (L + 4) / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      camera.position.set(0.01, fit, 0);
    } else {
      controls.target.set(0, 1.2, 0);
      camera.position.set(W * 1.05, Math.max(W, L) * 0.55, L * 0.62);
    }
    controls.update();
  }
  applyVisibility();
  syncPanel();
}

// ── Panel ──────────────────────────────────────────

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function syncPanel() {
  for (const seg of $$('.seg[data-key]')) {
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', String(state[seg.dataset.key]) === b.dataset.val);
  }
  for (const i of $$('input[data-key]')) i.value = state[i.dataset.key];
  for (const o of $$('output[data-for]')) o.textContent = state[o.dataset.for];
  for (const i of $$('input[data-show]')) i.checked = !!state.show[i.dataset.show];
}

function inventory() {
  const { W, L, tables, seated, headLen, headSeats, dance } = lay;
  const roundChairs = tables.length * state.perTable;
  const ph = state.show.photophores ? tables.length * state.photophores + (lay.headPhotophores || 0) : 0;
  const sh = state.show;
  const rows = [
    ['Tent', `${W} × ${L} m · ${W * L} m²`],
    ['Side walls', { open: 'rolled up', glass: 'glass', closed: 'white' }[state.walls]],
    ['Seated guests', `${seated} of ${state.guests}`],
    [`Round tables Ø${(lay.tableR * 2).toFixed(1)} m`, `${tables.length} × ${state.perTable}`],
    ['Head table', `${headLen.toFixed(1)} m · ${headSeats} seats`],
    ['Cane chairs', roundChairs + headSeats],
    ['Dance floor (chevron oak)', `${dance.size} × ${dance.size} m`],
    ['Tables cleared after dinner', tables.filter(t => t.cleared).length],
  ];
  if (sh.bars) rows.push(['Bars', `2 · champagne tower of ${lay.coupes || 55}`]);
  if (sh.dj) rows.push(['DJ booth', '1 + 2 speakers']);
  if (sh.screens) rows.push(['Screens', '2 × 4.8 × 2.7 m']);
  if (sh.cake) rows.push(['Cake table', '1']);
  if (sh.lounge) rows.push(['Lounge corner', '2 sofas + rug']);
  if (sh.ceilingDrapes) rows.push(['Ceiling drapes', `≈ ${Math.round(W * L * 1.25)} m² voile`]);
  if (sh.wallDrapes) rows.push(['Wall drapes', `${(lay.frames.length * 2) + Math.max(0, Math.ceil((W - 0.5) / 5) - 1) * 2} tied panels + swags`]);
  if (sh.garlands) rows.push(['Guirlandes', `≈ ${lay.garland.metres} m · ${lay.garland.bulbs} bulbs`]);
  if (sh.chandeliers) rows.push(['Olive-wreath chandeliers', lay.chandeliers]);
  if (sh.photophores) rows.push(['Photophores', ph]);
  if (sh.olives) rows.push(['Olive trees in Anduze pots', `${lay.olives.length}${lay.olives.length < state.oliveCount ? ` (room for ${lay.olives.length} of ${state.oliveCount})` : ''}`]);
  if (sh.curtain) rows.push(['Fairy-light curtain', `${(headLen + 2.2).toFixed(1)} m wide`]);
  if (sh.spotlight) rows.push(['Follow spot', '1']);
  if (sh.disco) rows.push(['Mirror ball', '1 + 4 warm moving lights']);
  return rows;
}

function updatePanelInfo() {
  const { tables, needed, seated, W, L } = lay;
  const short = state.guests - seated;
  const cap = $('#capacity');
  const area = W * L;
  const cleared = tables.filter(t => t.cleared).length;
  let html = `<b>${seated}</b> of ${state.guests} guests seated · ${tables.length} round tables + head table<br>`;
  html += `${area} m² · ${(area / state.guests).toFixed(2)} m² per guest (1.5 m² rule: ${Math.round(state.guests * 1.5)} m²)<br>`;
  html += `After dinner ${cleared} table${cleared === 1 ? '' : 's'} (${cleared * state.perTable} seats) are carried out for the dance floor.`;
  if (short > 0) {
    const fit = smallestFit(state);
    html += `<br><span class="warn">This tent is too small: ${short} guests have no seat (${needed - tables.length} more tables needed).</span>`;
    if (fit) html += `<br><span class="ok">Smallest standard size that fits everyone: <b>${fit[0]} × ${fit[1]} m</b></span> <button class="btn solid" id="btn-fit" style="margin-top:6px">Try ${fit[0]} × ${fit[1]}</button>`;
  } else {
    html += `<br><span class="ok">Everyone has a seat${lay.capacity > seated + state.perTable ? `, with room for ${lay.capacity - seated} more` : ''}.</span>`;
  }
  cap.innerHTML = html;
  const fitBtn = $('#btn-fit');
  if (fitBtn) fitBtn.onclick = () => {
    const fit = smallestFit(state);
    state.tentW = fit[0]; state.tentL = fit[1];
    commit('tentW');
  };
  const chip = $('#chip');
  chip.textContent = short > 0 ? `${W} × ${L} m tent · ${seated} / ${state.guests} seated · too small` : `${W} × ${L} m tent · all ${state.guests} guests seated`;
  chip.classList.toggle('warn', short > 0);
  $('#inventory').innerHTML = inventory().map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join('');
}

function commit(key) {
  saveState();
  if (LAYOUT_KEYS.has(key) || LAYOUT_SHOW.has(key)) buildWorld();
  else applyVisibility();
  if (key === 'view') setView(state.view);
  if (key === 'tentW' || key === 'tentL') setView(state.view === 'walk' ? 'orbit' : state.view);
  if (key === 'moment' || key === 'screens') applyMoment();
  syncPanel();
}

for (const seg of $$('.seg[data-key]')) {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = seg.dataset.key;
    const val = isNaN(+b.dataset.val) ? b.dataset.val : +b.dataset.val;
    if (state[key] === val) return;
    state[key] = val;
    commit(key);
  });
}
for (const i of $$('input[data-key]')) {
  const key = i.dataset.key;
  i.addEventListener('input', () => {
    const o = document.querySelector(`output[data-for="${key}"]`);
    if (o) o.textContent = i.value;
  });
  i.addEventListener('change', () => {
    let v = +i.value;
    if (!Number.isFinite(v)) return syncPanel();
    v = Math.max(+i.min || -Infinity, Math.min(+i.max || Infinity, v));
    state[key] = v;
    commit(key);
  });
}
for (const i of $$('input[data-show]')) {
  i.addEventListener('change', () => {
    state.show[i.dataset.show] = i.checked;
    commit(i.dataset.show);
  });
}
$('#preset').addEventListener('change', e => {
  if (!e.target.value) return;
  const [w, l] = e.target.value.split('×').map(Number);
  state.tentW = w; state.tentL = l;
  e.target.value = '';
  commit('tentW');
});
$('#panel-toggle').addEventListener('click', () => {
  const p = $('#panel');
  p.classList.toggle('closed');
  $('#panel-toggle').textContent = p.classList.contains('closed') ? 'Show panel' : 'Hide panel';
  setTimeout(resize, 320);
});
$('#btn-entrance').addEventListener('click', () => setView('walk', true));
$('#btn-reset').addEventListener('click', () => {
  state = structuredClone(DEFAULTS);
  saveState();
  buildWorld();
  setView('orbit');
  applyMoment();
});
$('#btn-list').addEventListener('click', () => {
  const text = 'Éléonore & Hubert — reception tent, Domaine des Pins, 26 June 2027\n\n'
    + inventory().map(([a, b]) => `${a}: ${b}`).join('\n') + '\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = 'tent-plan-inventory.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
let wantShot = false;
$('#btn-shot').addEventListener('click', () => { wantShot = true; });

// keyboard and pointer for walking
const typing = e => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
addEventListener('keydown', e => {
  if (typing(e) || state.view !== 'walk') return;
  walk.keys.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => walk.keys.delete(e.code));
addEventListener('blur', () => walk.keys.clear());
canvas.addEventListener('pointerdown', e => {
  if (state.view !== 'walk') return;
  walk.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!walk.drag || walk.drag.id !== e.pointerId) return;
  walk.yaw += (e.clientX - walk.drag.x) * 0.0042;
  walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch + (e.clientY - walk.drag.y) * 0.0035));
  walk.drag.x = e.clientX; walk.drag.y = e.clientY;
});
canvas.addEventListener('pointerup', () => { walk.drag = null; });
canvas.addEventListener('pointercancel', () => { walk.drag = null; });
for (const b of $$('#pad button[data-move]')) {
  const m = b.dataset.move;
  b.addEventListener('pointerdown', e => { e.preventDefault(); walk.pad.add(m); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => walk.pad.delete(m));
}

// ── Mini-map ───────────────────────────────────────

const mini = $('#minimap');
const mg = mini.getContext('2d');
function miniScale() {
  const { W, L } = lay;
  const maxPx = 190;
  const s = maxPx / Math.max(W, L);
  return { s, w: W * s, h: L * s };
}
function drawMini() {
  const { W, L, dance, tables, tableR, olives } = lay;
  const { s, w, h } = miniScale();
  const pw = Math.round(h + 10), ph = Math.round(w + 10); // drawn landscape: length runs left→right
  if (mini.width !== pw * 2 || mini.height !== ph * 2) {
    mini.width = pw * 2; mini.height = ph * 2;
    mini.style.width = pw + 'px'; mini.style.height = ph + 'px';
  }
  mg.setTransform(2, 0, 0, 2, 0, 0);
  mg.clearRect(0, 0, pw, ph);
  // world (x, z) → map: z to the right, −x down (head table along the top edge)
  const P = (x, z) => [5 + (z + L / 2) * s, 5 + (x + W / 2) * s];
  mg.fillStyle = '#EFE6D6'; mg.strokeStyle = '#8B8494'; mg.lineWidth = 1;
  mg.fillRect(5, 5, h, w); mg.strokeRect(5, 5, h, w);
  const rect = (x0, x1, z0, z1, c) => { const [a, b] = P(x0, z0), [c2, d] = P(x1, z1); mg.fillStyle = c; mg.fillRect(a, b, c2 - a, d - b); };
  const dancing = MOMENTS[state.moment].dancing;
  rect(dance.x - dance.size / 2, dance.x + dance.size / 2, -dance.size / 2, dance.size / 2, dancing ? '#C9A27A' : '#E3D2BA');
  rect(-W / 2 + 0.3, -W / 2 + 2.3, -lay.headLen / 2 - 0.8, lay.headLen / 2 + 0.8, '#7A6A55');
  for (const b of lay.bars) rect(b.x - 2, b.x + 2, b.z - 0.5, b.z + 0.5, '#4F6480');
  if (lay.dj) rect(lay.dj.x - 0.5, lay.dj.x + 0.5, lay.dj.z - 1, lay.dj.z + 1, '#363B26');
  if (lay.lounge) rect(lay.lounge.x - 1.5, lay.lounge.x + 1.5, lay.lounge.z - 2, lay.lounge.z + 2, '#B86E4B');
  mg.fillStyle = '#23260F';
  for (const sz of [-1, 1]) rect(-2.4, 2.4, sz * L / 2 - (sz > 0 ? 0.25 : 0), sz * L / 2 + (sz < 0 ? 0.25 : 0), '#23260F');
  mg.fillStyle = '#FAF6EE'; mg.strokeStyle = '#657252';
  for (const t of tables) {
    if (t.cleared && dancing) continue;
    const [a, b] = P(t.x, t.z);
    mg.setLineDash(t.cleared ? [2, 2] : []);
    mg.beginPath(); mg.arc(a, b, Math.max(2, tableR * s), 0, TAU); mg.fill(); mg.stroke();
    mg.setLineDash([]);
    if (s > 4) { mg.fillStyle = '#4B5136'; mg.font = '7px Montserrat'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText(t.n, a, b + 0.5); mg.fillStyle = '#FAF6EE'; }
  }
  if (state.show.olives) {
    mg.fillStyle = '#657252';
    for (const o of olives) { const [a, b] = P(o.x, o.z); mg.beginPath(); mg.arc(a, b, 2.4, 0, TAU); mg.fill(); }
  }
  // entrance marker and the viewer
  const [ea, eb] = P(W / 2, 0);
  mg.fillStyle = '#92AAC4'; mg.fillRect(ea - 6, eb - 1, 12, 3);
  const cp = camera.position;
  const [ca, cb] = P(Math.max(-W / 2 - 2, Math.min(W / 2 + 2, cp.x)), Math.max(-L / 2 - 2, Math.min(L / 2 + 2, cp.z)));
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const ang = Math.atan2(dir.z, -dir.x); // map: +z → right, +x → down
  mg.save(); mg.translate(ca, cb); mg.rotate(ang);
  mg.fillStyle = '#9A4A2E';
  mg.beginPath(); mg.moveTo(0, -7); mg.lineTo(4.5, 4); mg.lineTo(-4.5, 4); mg.closePath(); mg.fill();
  mg.restore();
}
mini.addEventListener('click', e => {
  if (state.view !== 'walk') setView('walk');
  const r = mini.getBoundingClientRect();
  const { s } = miniScale();
  const z = (e.clientX - r.left - 5) / s - lay.L / 2;
  const x = (e.clientY - r.top - 5) / s - lay.W / 2;
  camera.position.set(x, EYE, z);
  collide(camera.position);
  walk.placed = true;
});

// ── Moments ────────────────────────────────────────

function applyMoment() {
  const m = MOMENTS[state.moment];
  anim.lowerThird.map?.dispose();
  anim.lowerThird.map = lowerThirdTex(m.live ? m.label : '');
  anim.lowerThird.needsUpdate = true;
  SCREEN.map = m.live && state.show.screens ? rtTarget.texture : TEX.idle;
  SCREEN.needsUpdate = true;
}

// ── Resize and frame loop ──────────────────────────

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  GLOW_SHARED.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
addEventListener('resize', resize);

const screenCam = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);
const screenLook = new THREE.Vector3();
const spotAim = new THREE.Vector3();
const clock = new THREE.Clock();
let frameN = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  frameN++;
  GLOW_SHARED.uTime.value = t;

  // ease towards the chosen time of day and moment
  const k = 1 - Math.exp(-dt * 2.2);
  stepEnv(k);
  const m = MOMENTS[state.moment];
  mo.dim += (m.dim - mo.dim) * k;
  mo.spot += ((state.show.spotlight ? m.spot : 0) - mo.spot) * k;
  mo.party += (m.party - mo.party) * k;
  mo.angle += ((m.angle || mo.angle) - mo.angle) * k;

  const nf = env.night;
  skyMat.uniforms.top.value.copy(env.top);
  skyMat.uniforms.horizon.value.copy(env.hor);
  skyMat.uniforms.ground.value.copy(env.gnd);
  skyMat.uniforms.sunColor.value.copy(env.sun);
  skyMat.uniforms.sunSize.value = env.sunSize;
  const el = THREE.MathUtils.degToRad(env.sunEl), az = THREE.MathUtils.degToRad(env.sunAz);
  const sd = v3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  skyMat.uniforms.sunDir.value.copy(sd);
  sun.position.copy(sd).multiplyScalar(120);
  sun.color.copy(env.sun);
  sun.intensity = env.sunI;
  hemi.color.copy(env.hemiSky);
  hemi.groundColor.copy(env.hemiGnd);
  hemi.intensity = env.hemiI * (0.55 + 0.45 * mo.dim);
  ambient.intensity = env.amb;
  scene.fog.color.copy(env.fog);
  stars.material.opacity = env.stars;
  renderer.toneMappingExposure = env.exp;
  bloom.strength = env.bloom;
  MAT.roof.emissive.setRGB(1, 0.97, 0.9).multiplyScalar(env.roofGlow);

  // warm lights come up as the evening goes on, and dip for the spotlight moments
  const warm = 0.12 + 0.88 * nf;
  for (const { light, base } of interiorLights) light.intensity = base * warm * mo.dim * 2.2;
  BULB.color.copy(BULB_BASE).multiplyScalar(0.7 + 0.6 * nf);
  FLAME.color.copy(FLAME_BASE).multiplyScalar(0.6 + 0.9 * nf);
  for (const gs of glowSets) gs.points.material.uniforms.uIntensity.value = gs.day + (gs.night - gs.day) * nf;
  MAT.leafLit.emissiveIntensity = 0.16 * nf;
  MAT.leafTop.emissiveIntensity = 0.03 * nf;
  POOL.opacity = 0.75 * nf;
  if (anim.oliveBeam) anim.oliveBeam.uniforms.uOpacity.value = 0.14 * nf;
  for (const mtl of [MAT.brass, MAT.zinc, MAT.mirror, MAT.frame]) mtl.envMapIntensity = 1 - 0.85 * nf;
  MIRROR_BALL.envMapIntensity = 0.3 + 0.9 * mo.party;

  anim.cleared.visible = !m.dancing;

  // figures for each moment
  const { dance, cake, speech } = lay;
  const couple = anim.couple;
  couple.visible = state.moment === 'waltz' || state.moment === 'cake';
  anim.speaker.visible = state.moment === 'speech';
  anim.mic.visible = state.moment === 'speech';
  if (state.moment === 'waltz') {
    const a = t * 0.32;
    couple.position.set(dance.x + Math.cos(a) * dance.size * 0.22, 0.04, Math.sin(a) * dance.size * 0.22);
    couple.rotation.y = -t * 1.6;
  } else if (state.moment === 'cake') {
    couple.position.set(cake.x + 0.75, 0, cake.z - 0.2);
    couple.rotation.y = 0;
  }

  // follow spot
  let target;
  if (state.moment === 'speech') target = v3(speech.x, 1.0, speech.z);
  else if (state.moment === 'waltz') target = v3(couple.position.x, 0.5, couple.position.z);
  else if (state.moment === 'cake') target = v3(cake.x + 0.35, 0.8, cake.z - 0.1);
  else target = v3(dance.x, 0, 0);
  spotAim.lerp(target, 1 - Math.exp(-dt * 6));
  spot.target.position.copy(spotAim);
  spot.angle = mo.angle;
  spot.intensity = 160 * mo.spot;
  const beamEnd = spotAim.clone().sub(spot.position).normalize().multiplyScalar(spot.position.distanceTo(spotAim) + 0.3).add(spot.position);
  aimBeam(spotBeam, spot.position, beamEnd, mo.angle * 0.9, 0.05 * mo.spot * (0.25 + 0.75 * nf));

  // party: moving warm spots, turning mirror ball and its sparkles
  const disco = state.show.disco;
  partyLights.forEach((p, i) => {
    const a = t * (0.55 + i * 0.12) + i * 1.7;
    p.l.target.position.set(dance.x + Math.cos(a) * dance.size * 0.35, 0, Math.sin(a * 1.3) * dance.size * 0.35);
    p.l.intensity = 45 * mo.party * (state.show.disco ? 1 : 0);
    aimBeam(p.beam, p.l.position, p.l.target.position, 0.2, 0.05 * mo.party * (disco ? 1 : 0) * (0.3 + 0.7 * nf));
  });
  if (anim.ball) anim.ball.rotation.y = t * 0.4;
  if (anim.spin) {
    anim.spin.rotation.y = t * 0.4;
    anim.sparkles.material.uniforms.uIntensity.value = mo.party * (0.2 + 0.8 * nf) * 0.7;
    anim.sparkles.visible = mo.party > 0.02;
  }

  if (state.view === 'walk') stepWalk(dt);
  else controls.update();

  // live feed on the screens for speeches, waltz and cake
  if (m.live && state.show.screens && frameN % 2 === 0) {
    let pos, look;
    if (m.live === 'speech') { pos = v3(speech.x + 4.5, 1.8, 1.4); look = v3(speech.x, 1.45, speech.z); }
    else if (m.live === 'waltz') { pos = v3(dance.x + 5.2, 2.6, 3.6); look = v3(couple.position.x, 1.0, couple.position.z); }
    else { pos = v3(cake.x + 3.4, 1.7, cake.z - 1.4); look = v3(cake.x + 0.4, 1.05, cake.z - 0.1); }
    screenCam.position.lerp(pos, 0.2);
    screenLook.lerp(look, 0.2);
    screenCam.lookAt(screenLook);
    const sc = reg.screens;
    for (const o of sc) o.visible = false;
    renderer.setRenderTarget(rtTarget);
    renderer.render(scene, screenCam);
    renderer.setRenderTarget(null);
    for (const o of sc) o.visible = state.show.screens;
  }

  composer.render();
  if (wantShot) {
    wantShot = false;
    const a = document.createElement('a');
    a.href = renderer.domElement.toDataURL('image/png');
    a.download = `tent-plan-${state.time}-${state.moment}.png`;
    a.click();
  }
  if (frameN % 3 === 0) drawMini();
  requestAnimationFrame(tick);
}

// ── Start ──────────────────────────────────────────

resize();
buildWorld();
applyMoment();
syncPanel();
setView('orbit');
spotAim.set(lay.dance.x, 0, 0);
screenCam.position.set(lay.dance.x + 5, 2.5, 3);
requestAnimationFrame(() => {
  tick();
  setTimeout(() => $('#loading').classList.add('gone'), 250);
});

// Redraw the canvas textures once the script font has arrived.
document.fonts.load('80px "Parfumerie Script"').then(() => {
  const g = TEX.idle.userData.canvas.getContext('2d');
  drawIdle(g, 1024, 576);
  TEX.idle.needsUpdate = true;
  for (const [label, tex] of Object.entries(TEX.neon)) {
    const fresh = neonTex(label === 'Champagne' ? 'Champagne !' : label);
    tex.image = fresh.image;
    tex.needsUpdate = true;
  }
}).catch(() => {});

// handy when debugging from the console
window.tentPlan = {
  get state() { return state; }, get layout() { return lay; }, computeLayout, smallestFit, camera, walk,
  snap() {  // jump straight to the target lighting instead of easing
    const t = TIMES[state.time];
    for (const k in t) env[k] = t[k] instanceof THREE.Color ? t[k].clone() : t[k];
    const m = MOMENTS[state.moment];
    Object.assign(mo, { dim: m.dim, spot: state.show.spotlight ? m.spot : 0, party: m.party, angle: m.angle || mo.angle });
  },
};
