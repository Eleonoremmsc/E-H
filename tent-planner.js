/* ================================================
   Éléonore & Hubert — 3D reception tent planner
   The tent is laid out automatically from its size and the guest count;
   everything can then be dragged, rotated, added or removed by hand, and
   every element has a few styles (A, B, C) to choose from. Units are
   metres: x runs across the tent's width, z along its length, y is up.
   The head table sits against the −x wall, the entrance is in the middle
   of the +x wall, the screens stand at both ends (±z).
   ================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;

// ── Style catalogue ─────────────────────────────────
// Each element offers a few looks. Add an option here and teach the
// matching builder below to draw it.

const CATALOG = {
  headTable: { label: 'Head table', opts: { A: 'Guests on one side, facing the room', B: 'Guests on both sides' } },
  chairs: { label: 'Chairs', opts: { A: 'Cane bistro, natural wood', B: 'Chiavari, fruitwood with ivory cushion', C: 'Louis ghost, clear' } },
  linen: { label: 'Table linen', opts: { A: 'Ivory linen', B: 'Natural flax', C: 'Sage green' } },
  tableware: { label: 'Tableware', opts: { A: 'Brass charger, white porcelain', B: 'Rattan charger', C: 'Green-glazed Provençal plates' } },
  centrepiece: { label: 'Table flowers', opts: { A: 'Low olive branches and white roses', B: 'Tall candelabra with cascading roses', C: 'Bud vases of lavender and wildflowers' } },
  headFlowers: { label: 'Head table flowers', opts: { A: 'Olive and white rose runner', B: 'Abundant blush and peach meadow', C: 'Greenery and brass candlesticks' } },
  urns: { label: 'Flower urns', opts: { A: 'White hydrangeas and roses in stone urns', B: 'Wild meadow in soft pastels', C: 'Olive branches and white delphiniums' } },
  photophores: { label: 'Photophores', opts: { A: 'Clear glass votives', B: 'Amber glass', C: 'Tall hurricanes' } },
  garlands: { label: 'Guirlandes', opts: { A: 'Starburst from the centre', B: 'Festoons across the tent', C: 'Long swags lengthwise' } },
  chandeliers: { label: 'Chandeliers', opts: { A: 'Olive wreath with candles', B: 'Crystal', C: 'Woven rattan pendants' } },
  drapes: { label: 'Ceiling drapes', opts: { A: 'Swagged voile', B: 'Flat pleated lining' } },
  danceFloor: { label: 'Dance floor', opts: { A: 'Chevron oak', B: 'White lacquer', C: 'Black and white chequer' } },
  pots: { label: 'Olive tree pots', opts: { A: 'Anduze terracotta', B: 'White stone planter', C: 'Woven basket' } },
  bars: { label: 'Bars', opts: { A: 'Ivory panels and zinc top', B: 'Old oak and marble' } },
};
const STATIC_STYLES = new Set(['drapes', 'chandeliers']);

// ── Plan state ──────────────────────────────────────

const STORE_KEY = 'eh-tent-plan-v2';
const DEFAULTS = {
  tentW: 20, tentL: 30, walls: 'open',
  guests: 450, perTable: 10, headSeats: 20, danceSize: 8, aisle: 0.7,
  oliveCount: 8, photophores: 5,
  time: 'night', moment: 'dinner', view: 'orbit', quality: 'high',
  style: { ...Object.fromEntries(Object.keys(CATALOG).map(k => [k, 'A'])), headTable: 'B' },
  show: {
    roof: true, cutaway: true, headTable: true, rounds: true, chairs: true, tableware: true, flowers: true,
    dance: true, bars: true, dj: true, cake: true, lounge: false, screens: true,
    ceilingDrapes: true, wallDrapes: true, garlands: true, chandeliers: true, photophores: true,
    olives: true, urns: true, curtain: true, neon: true, disco: true, spotlight: true,
  },
  items: null,    // null: laid out automatically; otherwise the hand-arranged items
};

// Changing one of these re-runs the automatic layout.
const LAYOUT_KEYS = new Set(['tentW', 'tentL', 'guests', 'perTable', 'headSeats', 'danceSize', 'aisle', 'oliveCount']);
const STATIC_KEYS = new Set(['tentW', 'tentL', 'walls']);
const ITEM_KEYS = new Set(['photophores']);
const LAYOUT_SHOW = new Set(['bars', 'dj', 'cake', 'lounge']);
// Hidden in the floor-plan view so the tables can be seen from above.
const PLAN_HIDE = new Set(['roof', 'ceilingDrapes', 'garlands', 'chandeliers', 'disco']);

function loadState() {
  const base = structuredClone(DEFAULTS);
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s) return { ...base, ...s, show: { ...base.show, ...s.show }, style: { ...base.style, ...s.style }, view: 'orbit' };
  } catch { /* private window or blocked storage */ }
  return base;
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
// Item rotation follows Three.js: local (lx, lz) → world.
function toWorld(it, lx, lz) {
  const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
  return { x: it.x + lx * c + lz * s, z: it.z - lx * s + lz * c };
}
function toLocal(it, wx, wz) {
  const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0), dx = wx - it.x, dz = wz - it.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

// Head table in its own frame: the table runs along z, guests face +x.
function headInfo(st) {
  const both = st.style.headTable === 'B';
  const maxPer = Math.floor((st.tentL - 6) / 0.65);
  const per = Math.max(1, Math.min(both ? Math.ceil(st.headSeats / 2) : st.headSeats, maxPer));
  return {
    both, per, seats: both ? Math.min(st.headSeats, per * 2) : per, len: per * 0.65 + 0.6,
    depth: both ? 1.05 : 0.9,
    back: both ? -1.3 : -1.35, front: both ? 1.3 : 0.75,
    chairs: both ? [[-0.68, Math.PI / 2], [0.68, -Math.PI / 2]] : [[-0.62, Math.PI / 2]],
  };
}

// Footprint of an item in its own frame, for picking, clearance and walking.
function footprint(it, st = state) {
  const tr = TABLE_R[st.perTable] || 0.9;
  switch (it.type) {
    case 'round': return { r: tr + 0.5 };
    case 'olive': return { r: 0.6 };
    case 'urn': return { r: 0.45 };
    case 'cake': return { r: 0.55 };
    case 'head': { const h = headInfo(st); return { x0: h.back - 0.1, x1: h.front, z0: -h.len / 2 - 0.8, z1: h.len / 2 + 0.8 }; }
    case 'bar': return { x0: -2.2, x1: 2.2, z0: -1.65, z1: 0.5 };
    case 'dj': return { x0: -1.8, x1: 1.8, z0: -0.5, z1: 0.5 };
    case 'lounge': return { x0: -2.1, x1: 2.1, z0: -1.6, z1: 1.6 };
    case 'screen': return { x0: -2.95, x1: 2.95, z0: -0.3, z1: 0.3 };
    case 'dance': { const d = st.danceSize / 2; return { x0: -d, x1: d, z0: -d, z1: d }; }
  }
  return { r: 0.5 };
}
function itemDist(it, wx, wz, st = state) {
  const f = footprint(it, st), p = toLocal(it, wx, wz);
  return f.r !== undefined ? Math.max(0, Math.hypot(p.x, p.z) - f.r) : distRect(p.x, p.z, f);
}

let nextId = 1;
const mkItem = (type, x, z, rot = 0, v) => ({ id: `${type}-${nextId++}`, type, x, z, rot, ...(v ? { v } : {}) });

function autoLayout(st, { trees = true } = {}) {
  const W = st.tentW, L = st.tentL, sh = st.show;
  const tableR = TABLE_R[st.perTable] || 0.9;
  const foot = tableR + 0.55;                         // table plus chairs pulled out
  const spacing = 2 * foot + (st.aisle ?? 0.7);      // service aisle between chair backs
  const hi = headInfo(st);
  const head = mkItem('head', -W / 2 + 0.35 - hi.back, 0);
  const stageX0 = head.x + hi.front;                 // front edge of the head-table stage
  const D = Math.max(4, Math.min(st.danceSize, W - 8, L - 8));
  // The centre tables stand on the dance floor at dinner and are carried
  // out after dinner, before the waltz.
  const danceX = Math.min(Math.max(0, stageX0 + 2.9 + D / 2), W / 2 - D / 2 - 1);
  const items = [head, mkItem('dance', danceX, 0)];

  // Areas tables keep clear of; `pad` is the extra clearance beyond the chairs.
  const zones = [];
  const add = (x0, x1, z0, z1, pad) => zones.push({ x0, x1, z0, z1, pad });
  add(-W / 2, stageX0 + 0.4, -hi.len / 2 - 0.9, hi.len / 2 + 0.9, 0.3);
  add(stageX0, stageX0 + 2.4, -2.4, 2.4, 0.2);       // speech spot and cake
  add(W / 2 - 3, W / 2, -1.1, 1.1, 0.2);             // entrance
  if (sh.bars) for (const s of [-1, 1]) {
    items.push(mkItem('bar', W / 2 - 3.1, s * (L / 2 - 1.9), s < 0 ? 0 : Math.PI, s < 0 ? 'Champagne' : 'Cocktails'));
    add(W / 2 - 5.9, W / 2 - 0.2, s < 0 ? -L / 2 : L / 2 - 2.7, s < 0 ? -L / 2 + 2.7 : L / 2, 1.0);
  }
  if (sh.dj) {
    const x = -W / 2 + 1.6, z = L / 2 - 1.6;
    items.push(mkItem('dj', x, z, Math.atan2(danceX - x, -z)));
    add(-W / 2, -W / 2 + 3.1, L / 2 - 3.1, L / 2, 0.6);
  }
  if (sh.lounge) {
    items.push(mkItem('lounge', -W / 2 + 2.4, -L / 2 + 2.4));
    add(-W / 2, -W / 2 + 4.8, -L / 2, -L / 2 + 4.8, 0.4);
  }
  items.push(mkItem('cake', stageX0 + 1.5, 1.7));
  for (const s of [-1, 1]) {
    items.push(mkItem('screen', 0, s * (L / 2 - 0.55), s < 0 ? 0 : Math.PI));
    add(-2.8, 2.8, s < 0 ? -L / 2 : L / 2 - 1.0, s < 0 ? -L / 2 + 1.0 : L / 2, 0.2);
  }
  // flower urns flank the entrance
  for (const s of [-1, 1]) items.push(mkItem('urn', W / 2 - 0.8, s * 1.7));

  const inside = (x, z, m) => Math.abs(x) <= W / 2 - m && Math.abs(z) <= L / 2 - m;
  const tableOk = (x, z) => inside(x, z, foot + 0.5) && zones.every(r => distRect(x, z, r) >= foot + r.pad);

  // Try staggered and square grids at several offsets, in both directions,
  // keep whichever seats the most, then squeeze extra tables into the gaps.
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
  const pts = best.pts;
  const gaps = [];
  for (let x = -W / 2; x <= W / 2; x += 0.25) for (let z = -L / 2; z <= L / 2; z += 0.25) if (tableOk(x, z)) gaps.push({ x, z });
  gaps.sort((a, b) => Math.hypot(a.x - danceX, a.z) - Math.hypot(b.x - danceX, b.z));
  for (const g of gaps) if (pts.every(p => Math.hypot(p.x - g.x, p.z - g.z) >= spacing - 1e-6)) pts.push(g);

  const needed = Math.ceil(Math.max(0, st.guests - hi.seats) / st.perTable);
  const tables = pts
    .sort((a, b) => Math.hypot(a.x - danceX, a.z) - Math.hypot(b.x - danceX, b.z))
    .slice(0, needed);
  for (const t of tables) items.push(mkItem('round', t.x, t.z));

  // Olive trees: framing positions first, then spread evenly through the gaps.
  const olives = [];
  if (trees) {
    const solid = items.filter(i => ['bar', 'dj', 'lounge', 'screen', 'urn'].includes(i.type));
    const speech = { x: stageX0 + 0.9, z: 0 };
    const treeOk = (x, z) => inside(x, z, 0.7)
      && tables.every(t => Math.hypot(t.x - x, t.z - z) >= foot + 0.35)
      && solid.every(i => itemDist(i, x, z, st) >= 0.5)
      && (distRect(x, z, zones[0]) > 0 || Math.abs(z) > hi.len / 2 + 0.5)
      && distRect(x, z, { x0: danceX - D / 2, x1: danceX + D / 2, z0: -D / 2, z1: D / 2 }) >= 0.3
      && !(x > W / 2 - 3.5 && Math.abs(z) < 2.4)
      && Math.hypot(x - (stageX0 + 1.5), z - 1.7) > 1.2 && Math.hypot(x - speech.x, z - speech.z) > 1.5
      && olives.every(o => Math.hypot(o.x - x, o.z - z) >= 1.6);
    const c = 0.75;
    const anchors = [
      [danceX - D / 2 - c, D / 2 + c], [danceX - D / 2 - c, -D / 2 - c],
      [danceX + D / 2 + c, D / 2 + c], [danceX + D / 2 + c, -D / 2 - c],
      [W / 2 - 1.0, 3.0], [W / 2 - 1.0, -3.0],
      [head.x, hi.len / 2 + 0.9], [head.x, -hi.len / 2 - 0.9],
    ];
    for (const [x, z] of anchors) if (olives.length < st.oliveCount && treeOk(x, z)) olives.push({ x, z });
    if (olives.length < st.oliveCount) {
      const cands = [];
      for (let x = -W / 2 + 1.5; x <= W / 2 - 1.5; x += 0.5) for (let z = -L / 2 + 1.5; z <= L / 2 - 1.5; z += 0.5) cands.push({ x, z });
      while (olives.length < st.oliveCount) {
        let pick = null, far = -1;
        for (const p of cands) {
          if (!treeOk(p.x, p.z)) continue;
          const d = olives.length ? Math.min(...olives.map(o => Math.hypot(o.x - p.x, o.z - p.z))) : Math.hypot(p.x - danceX, p.z);
          if (d > far) { far = d; pick = p; }
        }
        if (!pick) break;
        olives.push(pick);
      }
    }
    for (const o of olives) items.push(mkItem('olive', o.x, o.z, Math.abs(o.x * 7.3 + o.z * 3.1) % TAU));
  }
  return { items, needed };
}

// Everything the scene needs, worked out from the items.
function derive(st, items) {
  const W = st.tentW, L = st.tentL;
  const ridge = EAVE + (W / 2) * ROOF_PITCH;
  const roofY = x => ridge - (ridge - EAVE) * Math.min(1, Math.abs(x) / (W / 2));
  const tableR = TABLE_R[st.perTable] || 0.9;
  const hi = headInfo(st);
  const head = items.find(i => i.type === 'head');
  const danceIt = items.find(i => i.type === 'dance');
  const D = st.danceSize;
  const dance = { x: danceIt.x, z: danceIt.z, size: D };
  const danceRect = { x0: dance.x - D / 2, x1: dance.x + D / 2, z0: dance.z - D / 2, z1: dance.z + D / 2 };
  const tables = items.filter(i => i.type === 'round').sort((a, b) => a.z - b.z || a.x - b.x);
  tables.forEach((t, i) => { t.n = i + 1; t.cleared = distRect(t.x, t.z, danceRect) < tableR + 0.3; });
  const needed = Math.ceil(Math.max(0, st.guests - hi.seats) / st.perTable);
  const seated = Math.min(st.guests, hi.seats + tables.length * st.perTable);
  const speech = toWorld(head, hi.front + 0.9, 0);
  const cakeIt = items.find(i => i.type === 'cake');
  const cake = cakeIt ? { x: cakeIt.x, z: cakeIt.z } : toWorld(head, hi.front + 1.5, 1.7);
  const nb = Math.max(2, Math.round(L / 5)), bay = L / nb;
  const frames = [...Array(nb + 1)].map((_, i) => -L / 2 + i * bay);
  return {
    W, L, eave: EAVE, ridge, roofY, tableR, hi, head, dance, tables, needed, seated, speech, cake,
    frames, bay, chandeliers: nb,
  };
}

const SIZE_PRESETS = [[20, 30], [20, 35], [25, 30], [20, 40], [25, 35], [25, 40], [25, 45], [30, 40], [30, 45], [30, 50], [35, 50], [35, 60]];
function smallestFit(st) {
  for (const [w, l] of SIZE_PRESETS) {
    const a = autoLayout({ ...st, tentW: w, tentL: l }, { trees: false });
    if (a.items.filter(i => i.type === 'round').length >= a.needed) return [w, l];
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
// Rotations are applied yaw first, then pitch, then roll.
function mat(x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}
function place(geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  return geo.applyMatrix4(mat(x, y, z, ry, 1, 1, 1, rx, rz));
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const v2s = pts => pts.map(([x, y]) => new THREE.Vector2(x, y));
const tube = (pts, r, seg = 12, rs = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, rs);

function instanced(geo, material, matrices, { cast = true, receive = true, colors } = {}) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, matrices.length));
  matrices.forEach((mm, i) => m.setMatrixAt(i, mm));
  if (colors) colors.forEach((c, i) => m.setColorAt(i, c));
  m.count = matrices.length;
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
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
const quad = (a, b, c, d, want) => surface(1, 1, (u, v) => a.clone().lerp(b, u).lerp(d.clone().lerp(c, u), v), want);

// ── Procedural textures ────────────────────────────

function canvasTex(w, h, draw, { repeat = false, color = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
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
  }, { repeat: true }),
  // fine weave used as a bump map on all the fabrics
  weave: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const v = 110 + ((x + y) % 4 ? 40 : -20) + r0() * 30;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 2, 2);
    }
  }, { repeat: true, color: false }),
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
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(110,70,35,${0.05 + r0() * 0.08})`;
          g.fillRect(-cw * 1.5, y + r0() * ph, cw * 3, 0.8);
        }
        g.fillStyle = 'rgba(80,50,25,.35)';
        g.fillRect(-cw * 1.5, y + ph - 1.5, cw * 3, 1.5);
      }
      g.restore();
    }
  }, { repeat: true }),
  chequer: canvasTex(256, 256, (g, w) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#1D1D1B' : '#F2EFE8'; g.fillRect(i * w / 4, j * w / 4, w / 4, w / 4);
    }
  }, { repeat: true }),
  oak: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8A6844'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 1) {
      g.fillStyle = `rgba(${r0() < 0.5 ? '60,40,20' : '170,135,95'},${r0() * 0.18})`;
      g.fillRect(x, 0, 1, h);
    }
    for (let p = 0; p < w; p += 32) { g.fillStyle = 'rgba(40,25,10,.4)'; g.fillRect(p, 0, 1.5, h); }
  }, { repeat: true }),
  marble: canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#EEEAE3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,140,130,.35)';
    for (let i = 0; i < 14; i++) {
      g.lineWidth = 0.6 + r0() * 1.6;
      g.beginPath();
      let x = r0() * w, y = r0() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 12; k++) { x += 20 + r0() * 30; y += (r0() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  }, { repeat: true }),
  cane: canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#D9BE8B'; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(110,80,40,.55)'; g.lineWidth = 1.2;
    for (let i = -w; i < w * 2; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + w, w); g.stroke();
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i - w, w); g.stroke();
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke();
    }
  }, { repeat: true }),
  basket: canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#B08A55'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 8) for (let x = 0; x < w; x += 16) {
      g.fillStyle = `rgba(${(x / 16 + y / 8) % 2 ? '90,60,30' : '210,175,120'},.45)`;
      g.fillRect(x + ((y / 8) % 2) * 8, y, 12, 6);
    }
  }, { repeat: true }),
  grass: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8E8C55'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      const t = r0();
      g.fillStyle = t < 0.5 ? 'rgba(160,150,90,.35)' : t < 0.8 ? 'rgba(100,110,60,.35)' : 'rgba(190,170,110,.4)';
      g.fillRect(r0() * w, r0() * h, 1 + r0() * 2, 1 + r0() * 3);
    }
  }, { repeat: true }),
  gravel: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#D8CBB0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      const s = 140 + r0() * 90;
      g.fillStyle = `rgba(${s},${s - 10},${s - 30},.6)`;
      g.beginPath(); g.arc(r0() * w, r0() * h, 0.6 + r0() * 1.6, 0, TAU); g.fill();
    }
  }, { repeat: true }),
  rug: canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#EFE6D6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#B4693E'; g.lineWidth = 6;
    g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 3;
    for (let x = 60; x < w - 40; x += 48) for (let y = 60; y < h - 40; y += 48) {
      g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 14, y); g.lineTo(x, y + 14); g.lineTo(x - 14, y); g.closePath(); g.stroke();
    }
  }),
};
TEX.weave.repeat.set(6, 6);

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
const NEON_TEXT = { Champagne: 'Champagne !', Cocktails: 'Cocktails' };
TEX.neon = { Champagne: neonTex(NEON_TEXT.Champagne), Cocktails: neonTex(NEON_TEXT.Cocktails) };
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
const fabric = (color, o = {}) => std(color, { roughness: 0.95, bumpMap: TEX.weave, bumpScale: 0.6, ...o });
const MAT = {
  linen: fabric(0xF3EDE1),
  ivory: fabric(0xF6F0E4),
  roof: std(0xFBF8F2, { roughness: 0.9, side: THREE.BackSide, shadowSide: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: 0xdfeaf0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }),
  drape: fabric(0xF4EEE2, { transparent: true, opacity: 0.94, side: THREE.FrontSide }),
  curtain: fabric(0xF1EADC, { side: THREE.DoubleSide }),
  frame: std(0xC9C9C4, { roughness: 0.45, metalness: 0.6 }),
  sisal: std(0xffffff, { map: TEX.sisal, roughness: 1 }),
  grass: std(0xffffff, { map: TEX.grass, roughness: 1 }),
  gravel: std(0xffffff, { map: TEX.gravel, roughness: 1 }),
  wood: std(0xA77F55, { roughness: 0.55 }),
  fruitwood: std(0x9C6B42, { roughness: 0.4 }),
  darkWood: std(0x4A3424, { roughness: 0.5 }),
  oak: std(0xffffff, { map: TEX.oak, roughness: 0.6 }),
  marble: std(0xffffff, { map: TEX.marble, roughness: 0.25 }),
  cane: std(0xffffff, { map: TEX.cane, roughness: 0.9, side: THREE.DoubleSide }),
  acrylic: new THREE.MeshStandardMaterial({ color: 0xF4F6F7, roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false }),
  brass: std(0xC9A158, { roughness: 0.3, metalness: 1 }),
  zinc: std(0xB2B3AE, { roughness: 0.35, metalness: 0.8 }),
  porcelain: std(0xFFFFFF, { roughness: 0.25 }),
  greenGlaze: std(0x8A9A6E, { roughness: 0.2 }),
  rattan: std(0xffffff, { map: TEX.basket, roughness: 0.9, side: THREE.DoubleSide }),
  crystal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.25, depthWrite: false }),
  votive: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
  amber: new THREE.MeshStandardMaterial({ color: 0xE0A04A, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
  leaf: std(0xffffff, { roughness: 0.7, side: THREE.DoubleSide }),
  stem: std(0x5E6B44, { roughness: 0.8 }),
  bloom: std(0xffffff, { roughness: 0.75, side: THREE.DoubleSide }),
  trunk: std(0x6A5A48, { roughness: 0.95 }),
  terracotta: std(0xB4693E, { roughness: 0.7 }),
  glaze: std(0x6F6B38, { roughness: 0.35 }),
  stone: std(0xE6E0D4, { roughness: 0.85 }),
  soil: std(0x3E3226, { roughness: 1 }),
  pine: std(0xffffff, { roughness: 0.9 }),
  cypress: std(0x2F3A22, { roughness: 0.9 }),
  lavender: std(0x7E6FA6, { roughness: 0.9 }),
  lavLeaf: std(0x7F8A6C, { roughness: 0.9 }),
  black: std(0x18181a, { roughness: 0.6 }),
  speaker: std(0x222222, { roughness: 0.5 }),
  suit: fabric(0x1E2433, { roughness: 0.75 }),
  greySuit: fabric(0x6B6E72, { roughness: 0.75 }),
  shirt: fabric(0xFAF8F2),
  dress: fabric(0xFFFDF8, { roughness: 0.85 }),
  skin: std(0xE3BFA0, { roughness: 0.6 }),
  hair: std(0x5A3E2A, { roughness: 0.7 }),
  rugM: std(0xffffff, { map: TEX.rug, roughness: 1 }),
  travertine: std(0xE4D8C4, { roughness: 0.6 }),
  terraCushion: fabric(0xB86E4B),
  oliveCushion: fabric(0x7A8058),
  cake: std(0xFFFBF2, { roughness: 0.6 }),
  bottleG: std(0x2F4A2C, { roughness: 0.15, metalness: 0.2 }),
  bottleA: std(0x8A5A22, { roughness: 0.15, metalness: 0.2 }),
  bottleC: std(0xE8E8E0, { roughness: 0.1, transparent: true, opacity: 0.6 }),
  mirror: std(0xB8B6AE, { roughness: 0.15, metalness: 1 }),
  mountain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
};
const LINEN_COLORS = { A: 0xF3EDE1, B: 0xD9CCB4, C: 0xA9B497 };
const DANCE_MATS = {
  A: std(0xffffff, { map: TEX.chevron, roughness: 0.45 }),
  B: std(0xF4F1EA, { roughness: 0.12 }),
  C: std(0xffffff, { map: TEX.chequer, roughness: 0.2 }),
};

// HDR emissive materials: values above 1 are picked up by the glow pass.
const BULB = new THREE.MeshBasicMaterial({ color: 0xffffff });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffffff });
const SCREEN = new THREE.MeshBasicMaterial({ map: TEX.idle });
const NEON = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
const SELECT = new THREE.MeshBasicMaterial({ color: 0x4F6480, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
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
const SHARED_GEO = new Set();

// A slim olive leaf, base at the origin, pointing along +x, gently bent.
function leafGeometry(len, w) {
  const pos = [], idx = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n, hw = (w / 2) * Math.sin(Math.PI * Math.min(1, t * 1.1)), y = -0.25 * len * t * t;
    pos.push(t * len, y, -hw, t * len, y + 0.002, hw);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// A rose: three layers of scalloped petals around a closed bud.
function roseGeometry() {
  const layer = (r, h, y0, petals, open) => {
    const g = new THREE.LatheGeometry(v2s([[0.004, 0], [r * 0.55, h * 0.25], [r * 0.9, h * 0.6], [r * (1 + open), h]]), 20);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
      const k = 1 + 0.12 * Math.abs(Math.sin(a * petals / 2));
      p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, p.getY(i) + y0);
    }
    g.computeVertexNormals();
    return g;
  };
  return mergeGeometries([layer(0.042, 0.04, 0, 5, 0.25), layer(0.03, 0.042, 0.004, 5, 0.1), layer(0.018, 0.04, 0.01, 4, -0.1),
    place(new THREE.SphereGeometry(0.011, 8, 6), 0, 0.04, 0)]);
}
// A hydrangea head: a lumpy dome of florets.
function hydrangeaGeometry() {
  const g = new THREE.IcosahedronGeometry(0.075, 3);
  const p = g.attributes.position, r = rng(17);
  for (let i = 0; i < p.count; i++) {
    const v = v3(p.getX(i), p.getY(i), p.getZ(i));
    v.multiplyScalar(1 + 0.12 * Math.sin(v.x * 140) * Math.sin(v.y * 130) * Math.sin(v.z * 150) + r() * 0.02);
    if (v.y < -0.02) v.y = -0.02 - (v.y + 0.02) * 0.2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
// Small open flower (cosmos / daisy): a ring of petals and a centre.
function smallFlowerGeometry() {
  const petals = [];
  for (let i = 0; i < 8; i++) petals.push(place(new THREE.PlaneGeometry(0.02, 0.008), 0.012, 0, 0, (i / 8) * TAU, -Math.PI / 2).toNonIndexed());
  return mergeGeometries([...petals, place(new THREE.SphereGeometry(0.005, 6, 4), 0, 0.002, 0).toNonIndexed()]);
}
function spikeGeometry(len, r) {
  const parts = [];
  for (let i = 0; i < 9; i++) parts.push(place(new THREE.SphereGeometry(r * (1 - i / 14), 6, 4), 0, (i / 8) * len, 0));
  return mergeGeometries(parts);
}
// Brass candelabra standing at the origin: stem, foot and four curved arms.
const CANDELABRA_ARMS = [0, 1, 2, 3].map(k => { const a = (k / 4) * TAU + 0.4; return [Math.cos(a) * 0.2, Math.sin(a) * 0.2]; });
function candelabraGeometry() {
  const parts = [
    place(new THREE.CylinderGeometry(0.012, 0.016, 0.62, 10), 0, 0.31, 0),
    place(new THREE.CylinderGeometry(0.09, 0.11, 0.02, 24), 0, 0.01, 0),
  ];
  for (const [ax, az] of CANDELABRA_ARMS) {
    parts.push(tube([v3(0, 0.42, 0), v3(ax * 0.6, 0.43, az * 0.6), v3(ax, 0.5, az), v3(ax, 0.56, az)], 0.008, 10, 5));
    parts.push(place(new THREE.CylinderGeometry(0.025, 0.018, 0.02, 12), ax, 0.565, az));
  }
  return mergeGeometries(parts);
}

// Three chair designs. Each returns [{ geo, mat }] parts, drawn instanced.
function chairParts(style) {
  if (style === 'B') {   // Chiavari
    const bits = [];
    for (const [x, z] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.18], [0.18, 0.18]]) {
      const tall = z < 0;
      bits.push(place(new THREE.CylinderGeometry(0.011, 0.014, tall ? 0.94 : 0.45, 8), x, tall ? 0.47 : 0.225, z, 0, tall ? -0.06 : 0));
    }
    for (const y of [0.62, 0.78, 0.92]) bits.push(place(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), 0, y, -0.185 - (y - 0.45) * 0.06, 0, 0, Math.PI / 2));
    for (const x of [-0.09, 0, 0.09]) bits.push(place(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), x, 0.77, -0.205, 0, -0.06));
    for (const y of [0.12, 0.3]) for (const z of [-0.17, 0.18]) bits.push(place(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 6), 0, y, z, 0, 0, Math.PI / 2));
    bits.push(place(new THREE.BoxGeometry(0.4, 0.03, 0.38), 0, 0.45, 0));
    return [
      { geo: mergeGeometries(bits), mat: MAT.fruitwood },
      { geo: place(new THREE.BoxGeometry(0.38, 0.05, 0.36), 0, 0.49, 0.01), mat: MAT.ivory },
    ];
  }
  if (style === 'C') {   // Louis ghost
    const back = new THREE.CylinderGeometry(0.17, 0.17, 0.035, 28).rotateX(Math.PI / 2).scale(1, 1.3, 1);
    const ring = new THREE.TorusGeometry(0.18, 0.016, 8, 32).scale(1, 1.3, 1);
    const bits = [
      place(new THREE.BoxGeometry(0.44, 0.04, 0.42), 0, 0.46, 0),
      place(back, 0, 0.76, -0.2, 0, -0.1),
      place(ring, 0, 0.76, -0.2, 0, -0.1),
    ];
    for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) bits.push(place(new THREE.CylinderGeometry(0.018, 0.012, 0.45, 10), x, 0.225, z));
    return [{ geo: mergeGeometries(bits), mat: MAT.acrylic, cast: false }];
  }
  // A: bentwood bistro chair with a caned seat and back
  const bits = [];
  for (const [x, z] of [[-0.18, -0.16], [0.18, -0.16], [-0.17, 0.17], [0.17, 0.17]]) bits.push(place(new THREE.CylinderGeometry(0.013, 0.016, 0.46, 8), x, 0.23, z));
  bits.push(place(new THREE.TorusGeometry(0.2, 0.012, 6, 32), 0, 0.46, 0, 0, Math.PI / 2));
  bits.push(place(new THREE.TorusGeometry(0.18, 0.007, 6, 32), 0, 0.17, 0, 0, Math.PI / 2));
  bits.push(tube([v3(-0.18, 0.44, -0.15), v3(-0.2, 0.7, -0.21), v3(-0.13, 0.9, -0.25), v3(0, 0.94, -0.26), v3(0.13, 0.9, -0.25), v3(0.2, 0.7, -0.21), v3(0.18, 0.44, -0.15)], 0.013, 32, 6));
  const caneBack = surface(10, 8, (u, v) => {
    const a = (u * 2 - 1);
    return v3(a * 0.15 * (1 - 0.35 * v * v), 0.55 + v * 0.32, -0.205 - 0.035 * v - 0.03 * (1 - a * a));
  });
  caneBack.deleteAttribute('normal');
  caneBack.computeVertexNormals();
  return [
    { geo: mergeGeometries(bits), mat: MAT.wood },
    { geo: mergeGeometries([place(new THREE.CylinderGeometry(0.195, 0.195, 0.012, 32), 0, 0.47, 0), caneBack]), mat: MAT.cane },
  ];
}

function initGeo() {
  GEO.plate = new THREE.CylinderGeometry(0.135, 0.12, 0.014, 28);
  GEO.charger = new THREE.CylinderGeometry(0.165, 0.165, 0.008, 32);
  GEO.napkin = new THREE.BoxGeometry(0.1, 0.008, 0.19);
  GEO.glass = new THREE.LatheGeometry(v2s([[0, 0], [0.035, 0], [0.035, 0.004], [0.005, 0.012], [0.004, 0.09], [0.03, 0.11], [0.038, 0.15], [0.034, 0.2]]), 14);
  GEO.coupe = new THREE.LatheGeometry(v2s([[0, 0], [0.03, 0], [0.03, 0.004], [0.004, 0.01], [0.004, 0.06], [0.05, 0.075], [0.058, 0.095]]), 14);
  GEO.votive = new THREE.CylinderGeometry(0.036, 0.032, 0.09, 16, 1, true);
  GEO.hurricane = new THREE.LatheGeometry(v2s([[0.06, 0], [0.07, 0.05], [0.075, 0.18], [0.065, 0.3]]), 20);
  GEO.flame = new THREE.SphereGeometry(0.009, 8, 6).scale(1, 2.4, 1);
  GEO.bulb = new THREE.SphereGeometry(0.028, 10, 8);
  GEO.candle = new THREE.CylinderGeometry(0.018, 0.018, 0.12, 12);
  GEO.pillar = new THREE.CylinderGeometry(0.035, 0.035, 0.14, 16);
  GEO.bottle = mergeGeometries([
    place(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 12), 0, 0.1, 0),
    place(new THREE.CylinderGeometry(0.014, 0.035, 0.1, 12), 0, 0.25, 0),
  ]);
  GEO.budVase = new THREE.LatheGeometry(v2s([[0, 0], [0.028, 0], [0.034, 0.04], [0.026, 0.09], [0.01, 0.12], [0.012, 0.135]]), 14);
  GEO.anduze = new THREE.LatheGeometry(v2s([[0, 0], [0.2, 0], [0.22, 0.04], [0.24, 0.12], [0.33, 0.35], [0.38, 0.55], [0.4, 0.7], [0.44, 0.74], [0.44, 0.8], [0.38, 0.8]]), 32);
  GEO.potBand = new THREE.TorusGeometry(0.385, 0.03, 8, 32).rotateX(Math.PI / 2);
  GEO.planter = mergeGeometries([place(new THREE.BoxGeometry(0.72, 0.7, 0.72), 0, 0.35, 0), place(new THREE.BoxGeometry(0.82, 0.07, 0.82), 0, 0.735, 0), place(new THREE.BoxGeometry(0.78, 0.06, 0.78), 0, 0.03, 0)]);
  GEO.basket = new THREE.CylinderGeometry(0.42, 0.34, 0.66, 32, 1, true).translate(0, 0.33, 0);
  GEO.basketRim = new THREE.TorusGeometry(0.42, 0.03, 8, 32).rotateX(Math.PI / 2).translate(0, 0.66, 0);
  GEO.urn = new THREE.LatheGeometry(v2s([[0, 0], [0.2, 0], [0.2, 0.05], [0.07, 0.12], [0.06, 0.5], [0.14, 0.56], [0.12, 0.6], [0.06, 0.65], [0.08, 0.7], [0.22, 0.82], [0.3, 0.95], [0.32, 1.0], [0.28, 1.0]]), 32);
  GEO.leaf = leafGeometry(0.075, 0.015);
  GEO.rose = roseGeometry();
  GEO.hydrangea = hydrangeaGeometry();
  GEO.flower = smallFlowerGeometry();
  GEO.lavender = spikeGeometry(0.07, 0.007);
  GEO.delphinium = spikeGeometry(0.45, 0.03);
  GEO.stemThin = new THREE.CylinderGeometry(0.002, 0.003, 1, 4).translate(0, 0.5, 0);
  GEO.candelabra = candelabraGeometry();
  GEO.candlestick = new THREE.CylinderGeometry(0.02, 0.04, 0.3, 12);
  GEO.cone = new THREE.ConeGeometry(1, 1, 32, 1, true).translate(0, -0.5, 0);
  GEO.crystalDrop = new THREE.OctahedronGeometry(0.018).scale(1, 1.8, 1);
  GEO.rattanShade = new THREE.LatheGeometry(v2s([[0.02, 0.32], [0.18, 0.3], [0.33, 0.18], [0.4, 0.02], [0.4, 0]]), 32);
  for (const g of Object.values(GEO)) SHARED_GEO.add(g);
}
initGeo();
const CHAIRS = { A: chairParts('A'), B: chairParts('B'), C: chairParts('C') };
for (const parts of Object.values(CHAIRS)) for (const p of parts) SHARED_GEO.add(p.geo);

const C = h => new THREE.Color(h);
const PAL = {
  olive: [C('#5D6A4B'), C('#6E7A58'), C('#8F9A7C'), C('#A7AF96')],
  green: [C('#4F6440'), C('#62764E'), C('#7C8C63')],
  white: [C('#FFFCF5'), C('#FBF5EA'), C('#F6EEE0')],
  blush: [C('#F3D6CC'), C('#EBC3B5'), C('#F7E3D9'), C('#F2CDB2'), C('#FFFCF5')],
  meadow: [C('#F2D2C4'), C('#E9D7A6'), C('#D9C5E3'), C('#FFFCF5'), C('#F0B9A2'), C('#C8D9E8')],
  hydr: [C('#F7F5EE'), C('#EEF0E6'), C('#F4EFE6')],
};
const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

// ── Renderer, scene, camera ────────────────────────

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0e1428, 90, 1300);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 2500);
camera.rotation.order = 'YXZ';

// soft indirect light everywhere, like light bouncing off the white tent
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
const MIRROR_BALL = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12, envMap: envTex, flatShading: true });

const rtTarget = new THREE.WebGLRenderTarget(1024, 576, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 512, 512);
gtao.output = GTAOPass.OUTPUT.Default;
gtao.blendIntensity = 0.85;
gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 16 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.35, 1.0);
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

const TIMES = {
  day: { top: C('#4F86C2'), hor: C('#E8DCC2'), gnd: C('#8E8457'), sun: C('#FFF1DC'), sunI: 3.2, sunEl: 58, sunAz: 205,
    hemiSky: C('#E4ECF5'), hemiGnd: C('#B09A70'), hemiI: 1.1, amb: 0.1, env: 0.55, night: 0, bloom: 0.08, exp: 1.05, stars: 0, fog: C('#DCD3BF'), roofGlow: 0.35, sunSize: 1 },
  golden: { top: C('#5C6E9C'), hor: C('#F2AE72'), gnd: C('#5E4B33'), sun: C('#FFAC62'), sunI: 2.4, sunEl: 6, sunAz: 292,
    hemiSky: C('#F2C9A0'), hemiGnd: C('#5E4A30'), hemiI: 0.5, amb: 0.06, env: 0.25, night: 0.5, bloom: 0.25, exp: 1.05, stars: 0, fog: C('#C99A78'), roofGlow: 0.12, sunSize: 3 },
  night: { top: C('#02040B'), hor: C('#111831'), gnd: C('#08080A'), sun: C('#8FA6D6'), sunI: 0.16, sunEl: 38, sunAz: 120,
    hemiSky: C('#26304F'), hemiGnd: C('#161009'), hemiI: 0.08, amb: 0.02, env: 0.025, night: 1, bloom: 0.32, exp: 1.15, stars: 1, fog: C('#0B1024'), roofGlow: 0, sunSize: 0.6 },
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

// ── Scene layers ───────────────────────────────────
// The tent and garden (static) rarely change; the furniture and decoration
// (items) are rebuilt whenever something moves; the item being dragged is
// drawn on its own so it can follow the pointer.

let lay = null;
let auto = null;
const anim = {};
function newLayer() { return { group: new THREE.Group(), reg: {}, glows: [], lights: [], obstacles: { circles: [], rects: [] } }; }
const layers = { static: newLayer(), items: newLayer(), drag: newLayer() };
let cur = layers.static;

function addTo(key, obj, parent = cur.group) {
  (cur.reg[key] ||= []).push(obj);
  parent.add(obj);
  return obj;
}
function addGlow(key, pts, day, night, parent, color) {
  if (!pts.length) return;
  const p = glowPoints(pts, color);
  cur.glows.push({ points: p, day, night });
  addTo(key, p, parent);
}
function addLight(light, base, parent, kind = 'warm') {
  cur.lights.push({ light, base, kind });
  parent.add(light);
}
function clearLayer(name) {
  const l = layers[name];
  l.group.traverse(o => {
    if (o.geometry && !SHARED_GEO.has(o.geometry)) o.geometry.dispose();
    if (o.material && o.material.isShaderMaterial && o.material !== BEAM) o.material.dispose();
    if (o.isLight) o.dispose?.();
  });
  scene.remove(l.group);
  layers[name] = newLayer();
  scene.add(layers[name].group);
  return layers[name];
}

const currentItems = () => state.items || auto.items;

// Work out the layout. With `relayout` the automatic arrangement is redone.
function computeAll(relayout) {
  if (relayout || !auto) auto = autoLayout(state);
  lay = derive(state, currentItems());
}

function buildStatic() {
  cur = clearLayer('static');
  buildOutside();
  buildTent();
  buildDrapes();
  buildChandeliers();
  const sx = lay.W / 2 - 1.2;
  spot.position.set(sx, lay.roofY(sx) - 0.35, 0);
  const ext = Math.max(lay.W, lay.L) * 0.75 + 8;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext });
  sun.shadow.camera.updateProjectionMatrix();
}

function buildItems(exclude) {
  cur = clearLayer('items');
  const items = currentItems().filter(i => i.id !== exclude);
  const by = t => items.filter(i => i.type === t);
  anim.cleared = new THREE.Group();
  cur.group.add(anim.cleared);
  for (const h of by('head')) buildHeadTable(h, cur.group);
  buildRounds(by('round').filter(t => !t.cleared), cur.group);
  buildRounds(by('round').filter(t => t.cleared), anim.cleared);
  for (const d of by('dance')) buildDanceFloor(d, cur.group);
  buildOlives(by('olive'), cur.group);
  buildUrns(by('urn'), cur.group);
  for (const b of by('bar')) buildBar(b, cur.group);
  for (const d of by('dj')) buildDJ(d, cur.group);
  for (const c of by('cake')) buildCake(c, cur.group);
  for (const l of by('lounge')) buildLounge(l, cur.group);
  for (const s of by('screen')) buildScreen(s, cur.group);
  buildGarlands();
  buildFigures();
  buildDisco();
  partyLights.forEach((p, i) => {
    const { dance } = lay;
    const x = dance.x + (i % 2 ? 1 : -1) * dance.size / 2;
    const z = dance.z + (i < 2 ? -1 : 1) * dance.size / 2;
    p.l.position.set(x, lay.roofY(x) - 0.5, z);
  });
}

// Draw one item on its own (while it is being dragged), without its lights.
function buildDrag(it) {
  cur = clearLayer('drag');
  const g = cur.group;
  const one = { head: buildHeadTable, dance: buildDanceFloor, bar: buildBar, dj: buildDJ, cake: buildCake, lounge: buildLounge, screen: buildScreen }[it.type];
  if (one) one(it, g);
  else ({ round: buildRounds, olive: buildOlives, urn: buildUrns })[it.type]?.([it], g);
  for (const { light } of cur.lights) light.removeFromParent();
  cur.lights = [];
  cur = layers.items;
}

function rebuildAll(relayout) {
  computeAll(relayout);
  buildStatic();
  buildItems();
  afterBuild();
}
function rebuildItems(relayout) {
  computeAll(relayout);
  buildItems();
  afterBuild();
}
function afterBuild() {
  applyVisibility();
  updateSelection();
  updatePanelInfo();
}

// ── Garden, tent, drapes ───────────────────────────

function buildOutside() {
  const { W, L } = lay;
  const g = new THREE.Group();
  cur.group.add(g);
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
  // hurricane lanterns along the entrance path
  const lanterns = [], lanternM = [], candles = [];
  for (let x = W / 2 + 6; x < W / 2 + 44; x += 3) for (const s of [-1, 1]) {
    lanternM.push(mat(x, 0, s * 1.9, 0, 1.6));
    candles.push(mat(x, 0.11, s * 1.9, 0, 1.2));
    lanterns.push({ p: v3(x, 0.24, s * 1.9), size: 0.4, flicker: 0.3 });
  }
  g.add(instanced(GEO.hurricane, MAT.crystal, lanternM, { cast: false }), instanced(GEO.pillar, MAT.ivory, candles, { cast: false }));
  addGlow('photophores', lanterns, 0.05, 1.0, g);

  // cypresses flanking the path, umbrella pines around the domaine
  const cyp = [];
  for (let x = W / 2 + 8; x < W / 2 + 44; x += 6) for (const s of [-1, 1]) cyp.push(mat(x, 0, s * 3.6, r() * TAU, 1, 0.9 + r() * 0.3));
  g.add(instanced(new THREE.LatheGeometry(v2s([[0, 0], [0.45, 0.4], [0.7, 2.5], [0.6, 5], [0.3, 7], [0, 8]]), 16), MAT.cypress, cyp));
  const trunkGeos = [], crowns = [], crownCol = [];
  for (let i = 0; i < 18; i++) {
    const a = r() * TAU, d = Math.max(W, L) / 2 + 14 + r() * 40;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (x > W / 2 && Math.abs(z) < 8) continue;
    const h = 7 + r() * 4, lx = (r() - 0.5) * 2.5, lz = (r() - 0.5) * 2.5;
    trunkGeos.push(tube([v3(x, 0, z), v3(x + lx * 0.2, h * 0.4, z + lz * 0.2), v3(x + lx * 0.7, h * 0.8, z + lz * 0.7), v3(x + lx, h, z + lz)], 0.22, 10, 7));
    // the flat, dense crown of a stone pine
    for (let k = 0; k < 40; k++) {
      const ca = r() * TAU, cr = Math.sqrt(r()) * 3.6;
      crowns.push(mat(x + lx + Math.cos(ca) * cr, h + 0.2 + (r() - 0.3) * 0.5 - cr * 0.12, z + lz + Math.sin(ca) * cr, r() * TAU, 1.0 + r() * 0.6, 0.45 + r() * 0.2, 1.0 + r() * 0.6));
      crownCol.push(pick(PAL.green, r).clone().multiplyScalar(0.55 + r() * 0.2));
    }
  }
  g.add(mesh(mergeGeometries(trunkGeos), MAT.trunk));
  g.add(instanced(new THREE.SphereGeometry(1, 14, 10), MAT.pine, crowns, { colors: crownCol }));

  // lavender rows on the entrance side
  const lavB = [], lavF = [];
  for (let row = 0; row < 12; row++) for (let z = -34; z <= 34; z += 0.9) {
    if (Math.abs(z) < 6) continue;
    const x = W / 2 + 9 + row * 1.6;
    lavB.push(mat(x, 0.18, z, r() * TAU, 0.42, 0.3, 0.42));
    lavF.push(mat(x, 0.36, z, r() * TAU, 0.4, 0.22, 0.4));
  }
  const half = new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2);
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
  g.add(instanced(new THREE.IcosahedronGeometry(1, 2), MAT.cypress, hills, { cast: false, receive: false }));
}

function buildTent() {
  const { W, L, eave, ridge, roofY, frames, bay } = lay;
  const g = new THREE.Group();
  cur.group.add(g);
  const obs = cur.obstacles;

  const floor = mesh(new THREE.BoxGeometry(W + 0.3, 0.12, L + 0.3), MAT.sisal, { cast: false });
  MAT.sisal.map.repeat.set(W / 1.5, L / 1.5);
  floor.position.y = -0.06;
  g.add(floor);

  // aluminium frame: legs, rafters, ridge and eave purlins
  const legs = [], rafters = [];
  const rl = Math.hypot(W / 2, ridge - eave), ra = Math.atan2(ridge - eave, W / 2);
  for (const z of frames) for (const s of [-1, 1]) {
    legs.push(mat(s * W / 2, eave / 2, z));
    rafters.push(mat(s * W / 4, (eave + ridge) / 2, z, 0, 1, 1, 1, 0, -s * ra));
    obs.circles.push({ x: s * W / 2, z, r: 0.2 });
  }
  const endPosts = [];
  for (let x = -W / 2 + 5; x < W / 2 - 0.5; x += 5) for (const z of [-L / 2, L / 2]) {
    const h = roofY(x);
    endPosts.push(mat(x, h / 2, z, 0, 1, h, 1));
  }
  g.add(instanced(new THREE.BoxGeometry(0.12, eave, 0.2), MAT.frame, legs));
  g.add(instanced(new THREE.BoxGeometry(rl, 0.2, 0.1), MAT.frame, rafters));
  g.add(instanced(new THREE.BoxGeometry(0.1, 1, 0.1), MAT.frame, endPosts));
  for (const [x, y] of [[0, ridge], [-W / 2, eave], [W / 2, eave]]) {
    const b = mesh(new THREE.BoxGeometry(0.1, 0.16, L), MAT.frame);
    b.position.set(x, y, 0);
    g.add(b);
  }

  // roof and gables (seen from inside only when the cutaway is on)
  const roof = new THREE.Group();
  const o = 0.25;
  for (const s of [-1, 1]) {
    roof.add(mesh(quad(v3(s * (W / 2 + o), eave - o * ROOF_PITCH, -L / 2 - o), v3(s * (W / 2 + o), eave - o * ROOF_PITCH, L / 2 + o), v3(0, ridge, L / 2 + o), v3(0, ridge, -L / 2 - o), v3(s, 2, 0)), MAT.roof));
    const tri = new THREE.BufferGeometry().setFromPoints([v3(-W / 2, eave, s * L / 2), v3(W / 2, eave, s * L / 2), v3(0, ridge, s * L / 2)]);
    tri.computeVertexNormals();
    if (tri.attributes.normal.getZ(0) * s < 0) tri.setIndex([0, 2, 1]);
    tri.computeVertexNormals();
    roof.add(mesh(tri, MAT.roof));
  }
  addTo('roof', roof, g);

  // side walls
  const door = 1.6;
  if (state.walls === 'open') {
    const rolls = [];
    for (let i = 0; i < frames.length - 1; i++) for (const s of [-1, 1]) rolls.push(mat(s * (W / 2 + 0.08), eave - 0.18, -L / 2 + (i + 0.5) * bay, 0, 1, bay - 0.3, 1, Math.PI / 2));
    g.add(instanced(new THREE.CylinderGeometry(0.11, 0.11, 1, 16), MAT.ivory, rolls));
  } else {
    const wm = state.walls === 'glass' ? MAT.glass : MAT.roof;
    const panel = (a, b, c, d, want) => g.add(mesh(quad(a, b, c, d, want), wm, { cast: state.walls !== 'glass' }));
    panel(v3(-W / 2, eave, -L / 2), v3(-W / 2, eave, L / 2), v3(-W / 2, 0, L / 2), v3(-W / 2, 0, -L / 2), v3(-1, 0, 0));
    panel(v3(W / 2, eave, -L / 2), v3(W / 2, eave, -door), v3(W / 2, 0, -door), v3(W / 2, 0, -L / 2), v3(1, 0, 0));
    panel(v3(W / 2, eave, door), v3(W / 2, eave, L / 2), v3(W / 2, 0, L / 2), v3(W / 2, 0, door), v3(1, 0, 0));
    panel(v3(W / 2, eave, -door), v3(W / 2, eave, door), v3(W / 2, 2.5, door), v3(W / 2, 2.5, -door), v3(1, 0, 0));
    for (const s of [-1, 1]) panel(v3(-W / 2, eave, s * L / 2), v3(W / 2, eave, s * L / 2), v3(W / 2, 0, s * L / 2), v3(-W / 2, 0, s * L / 2), v3(0, 0, s));
    if (state.walls === 'glass') {
      const mull = [];
      for (let z = -L / 2; z <= L / 2; z += 1.25) for (const s of [-1, 1]) {
        if (s > 0 && Math.abs(z) < door) continue;
        mull.push(mat(s * W / 2, eave / 2, z));
      }
      for (let x = -W / 2; x <= W / 2; x += 1.25) for (const s of [-1, 1]) mull.push(mat(x, eave / 2, s * L / 2));
      g.add(instanced(new THREE.BoxGeometry(0.05, eave, 0.05), MAT.frame, mull));
    }
    // walls block walking, except the doorway
    const t = 0.15;
    obs.rects.push({ x0: -W / 2 - t, x1: -W / 2 + t, z0: -L / 2, z1: L / 2 });
    obs.rects.push({ x0: W / 2 - t, x1: W / 2 + t, z0: -L / 2, z1: -door });
    obs.rects.push({ x0: W / 2 - t, x1: W / 2 + t, z0: door, z1: L / 2 });
    for (const s of [-1, 1]) obs.rects.push({ x0: -W / 2, x1: W / 2, z0: s * L / 2 - t, z1: s * L / 2 + t });
  }
}

function buildDrapes() {
  const { W, L, eave, roofY, frames, bay } = lay;
  const ceil = new THREE.Group();
  const nu = Math.ceil(bay / 0.05);
  const swagged = state.style.drapes !== 'B';
  for (let i = 0; i < frames.length - 1; i++) for (const s of [-1, 1]) {
    const z0 = frames[i];
    const geo = surface(nu, 22, (u, v) => {
      const x = s * (0.12 + v * (W / 2 - 0.3));
      const sag = swagged ? 0.42 * Math.sin(Math.PI * u) * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.1)), 0.8) : 0;
      const pleat = (swagged ? 0.03 : 0.022) * (1 + Math.sin(u * bay * TAU / (swagged ? 0.32 : 0.2))) * (swagged ? Math.sin(Math.PI * v) : 1);
      return v3(x, roofY(x) - 0.14 - sag - pleat, z0 + u * bay);
    }, v3(0, -1, 0));
    ceil.add(mesh(geo, MAT.drape, { cast: false }));
  }
  if (swagged) {
    const ros = frames.map(z => mat(0, roofY(0) - 0.2, z, 0, 0.35, 0.18, 0.35));
    ceil.add(instanced(new THREE.SphereGeometry(1, 20, 14), MAT.drape, ros, { cast: false }));
  }
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
      const hw = y > tie ? 0.13 + 0.55 * Math.pow((y - tie) / (h - tie), 0.7) : 0.13 + 0.24 * Math.sqrt((tie - y) / tie);
      const a = (u * 2 - 1) * hw;
      const d = 0.07 + 0.035 * Math.sin((u * 2 - 1) * 15) + 0.09 * Math.exp(-((y - tie) ** 2) / 0.25);
      return v3(p.x + p.t.x * a + p.n.x * d, y, p.z + p.t.z * a + p.n.z * d);
    }));
  }
  wall.add(mesh(mergeGeometries(curtGeos), MAT.curtain, { cast: false }));
  const ties = poles.map(p => mat(p.x + p.n.x * 0.16, tie, p.z + p.n.z * 0.16));
  wall.add(instanced(new THREE.TorusGeometry(0.13, 0.025, 8, 20).rotateX(Math.PI / 2), MAT.brass, ties, { cast: false }));
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

function buildChandeliers() {
  const { roofY, frames, bay } = lay;
  const g = new THREE.Group();
  const style = state.style.chandeliers;
  const spots = [];
  for (let i = 0; i < frames.length - 1; i++) spots.push(frames[i] + bay / 2);
  const top = roofY(0);
  const y = top - 1.9;
  const r = rng(5);
  const chains = [], candles = [], flames = [], glows = [], leaves = [], leafCol = [];
  const rings = [], drops = [], shades = [];
  for (const z of spots) {
    if (style === 'C') {
      // three woven pendants at staggered heights
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU, x = Math.cos(a) * 0.55, zz = z + Math.sin(a) * 0.55, yy = y + 0.2 - k * 0.25;
        shades.push(mat(x, yy, zz, r() * TAU, 0.9 + k * 0.15));
        chains.push(mat(x, (yy + 0.3 + top) / 2, zz, 0, 1, top - yy - 0.3, 1));
        flames.push(mat(x, yy + 0.05, zz, 0, 3.5));
        glows.push({ p: v3(x, yy, zz), size: 0.9, flicker: 0.02 });
      }
    } else {
      chains.push(mat(0, (y + top) / 2, z, 0, 1, top - y, 1));
      rings.push(mat(0, y, z), mat(0, y - 0.18, z, 0, 0.55));
      const n = style === 'B' ? 16 : 12;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU, x = Math.cos(a) * 0.55, zz = z + Math.sin(a) * 0.55;
        candles.push(mat(x, y + 0.08, zz));
        flames.push(mat(x, y + 0.16, zz));
        glows.push({ p: v3(x, y + 0.17, zz), size: 0.2, flicker: style === 'B' ? 0.05 : 0.25 });
      }
      if (style === 'B') {
        for (let k = 0; k < 90; k++) {
          const a = r() * TAU, rr = 0.15 + r() * 0.42, yy = y - 0.05 - r() * 0.55 * (1 - rr / 0.7);
          drops.push(mat(Math.cos(a) * rr, yy, z + Math.sin(a) * rr, r() * TAU));
        }
      } else {
        // olive branches woven round the ring
        for (let k = 0; k < 260; k++) {
          const a = r() * TAU, rr = 0.55 + (r() - 0.5) * 0.1;
          leaves.push(mat(Math.cos(a) * rr, y + (r() - 0.5) * 0.1, z + Math.sin(a) * rr, r() * TAU, 1, 1, 1, (r() - 0.5) * 1.5, (r() - 0.5) * 1.5));
          leafCol.push(pick(PAL.olive, r));
        }
      }
    }
    const pl = new THREE.PointLight(0xFFB774, 0, 18, 1.6);
    pl.position.set(0, y - 0.3, z);
    addLight(pl, 9, g);
  }
  if (rings.length) g.add(instanced(new THREE.TorusGeometry(0.55, 0.016, 8, 48).rotateX(Math.PI / 2), style === 'B' ? MAT.brass : MAT.black, rings, { cast: false }));
  g.add(instanced(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), MAT.black, chains, { cast: false }));
  if (candles.length) g.add(instanced(GEO.candle, MAT.ivory, candles, { cast: false }));
  if (style === 'C') g.add(instanced(GEO.bulb, BULB, flames, { cast: false, receive: false }), instanced(GEO.rattanShade, MAT.rattan, shades, { cast: false }));
  else g.add(instanced(GEO.flame, FLAME, flames, { cast: false, receive: false }));
  if (drops.length) g.add(instanced(GEO.crystalDrop, MAT.crystal, drops, { cast: false }));
  if (leaves.length) g.add(instanced(GEO.leaf, MAT.leaf, leaves, { cast: false, colors: leafCol }));
  addGlow('chandeliers', glows, 0.15, 1.0, g);
  addTo('chandeliers', g);

  // two soft fill lights along the length so the far tables are not in the dark
  for (const z of [-lay.L / 3, lay.L / 3]) {
    const pl = new THREE.PointLight(0xFFC08A, 0, 20, 1.6);
    pl.position.set(lay.W / 4, lay.eave - 0.4, z);
    addLight(pl, 6, cur.group);
  }
}

function buildGarlands() {
  const { W, L, eave, roofY, dance, frames, bay } = lay;
  const g = new THREE.Group();
  const lines = [];
  const style = state.style.garlands;
  if (style === 'A') {
    const c = v3(dance.x, roofY(dance.x) - 0.45, dance.z);
    const per = [];
    const inset = 0.3, y = eave - 0.12;
    for (let z = -L / 2 + inset; z <= L / 2 - inset + 0.01; z += 2.5) per.push(v3(-W / 2 + inset, y, z), v3(W / 2 - inset, y, z));
    for (let x = -W / 2 + inset + 2.5; x < W / 2 - inset - 0.5; x += 2.5) per.push(v3(x, roofY(x) - 0.3, -L / 2 + inset), v3(x, roofY(x) - 0.3, L / 2 - inset));
    for (const e of per) {
      const len = c.distanceTo(e);
      lines.push(t => c.clone().lerp(e, t).add(v3(0, -0.05 * len * Math.sin(Math.PI * t), 0)));
    }
  } else if (style === 'B') {
    for (let z = -L / 2 + 1.25; z < L / 2; z += 2.5) {
      lines.push(t => {
        const x = -W / 2 + 0.3 + t * (W - 0.6);
        return v3(x, roofY(x) - 0.55 - 0.3 * Math.abs(Math.sin(Math.PI * x / 2.5)), z);
      });
    }
  } else {
    for (let x = -W / 2 + 2.5; x < W / 2 - 1.5; x += 2.5) {
      lines.push(t => {
        const z = -L / 2 + 0.3 + t * (L - 0.6);
        const k = ((z - frames[0]) % bay) / bay;
        return v3(x, roofY(x) - 0.3 - 0.5 * Math.sin(Math.PI * k), z);
      });
    }
  }
  const wire = [], bulbs = [], glows = [];
  let metres = 0;
  for (const f of lines) {
    let prev = f(0), len = 0;
    for (let i = 1; i <= 120; i++) { const p = f(i / 120); len += p.distanceTo(prev); wire.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p; }
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

// ── Furniture and flowers ──────────────────────────

function itemGroup(it) {
  const g = new THREE.Group();
  g.position.set(it.x, 0, it.z);
  g.rotation.y = it.rot || 0;
  return g;
}

function addChairs(matrices, parent) {
  const ch = new THREE.Group();
  for (const p of CHAIRS[state.style.chairs]) ch.add(instanced(p.geo, p.mat, matrices, { cast: p.cast !== false }));
  addTo('chairs', ch, parent);
}

// Place settings; `seats` = [{x, z, gx, gz, a}] with the glass at (gx, gz).
function placeSettings(seats, top) {
  const tw = state.style.tableware;
  const out = { chargers: [], plates: [], glasses: [], napkins: [] };
  for (const s of seats) {
    out.chargers.push(mat(s.x, top + 0.004, s.z));
    out.plates.push(mat(s.x, top + 0.016, s.z));
    out.glasses.push(mat(s.gx, top, s.gz));
    out.napkins.push(mat(s.x, top + 0.03, s.z, s.a));
  }
  const g = new THREE.Group();
  g.add(instanced(GEO.charger, tw === 'B' ? MAT.rattan : MAT.brass, out.chargers, { cast: false }),
    instanced(GEO.plate, tw === 'C' ? MAT.greenGlaze : MAT.porcelain, out.plates, { cast: false }),
    instanced(GEO.glass, MAT.crystal, out.glasses, { cast: false }),
    instanced(GEO.napkin, state.style.linen === 'C' ? MAT.ivory : MAT.oliveCushion, out.napkins, { cast: false }));
  return g;
}

// Collects flower parts so a whole set of arrangements becomes a few draws.
function flowerBatch() {
  const b = { leaves: [], leafCol: [], roses: [], roseCol: [], hydr: [], hydrCol: [], small: [], smallCol: [], lav: [], delph: [], stems: [], vases: [], candelabra: [], sticks: [], candles: [], flames: [], glows: [] };
  b.flush = (parent, key = 'flowers') => {
    const g = new THREE.Group();
    if (b.leaves.length) g.add(instanced(GEO.leaf, MAT.leaf, b.leaves, { colors: b.leafCol, cast: false }));
    if (b.roses.length) g.add(instanced(GEO.rose, MAT.bloom, b.roses, { colors: b.roseCol }));
    if (b.hydr.length) g.add(instanced(GEO.hydrangea, MAT.bloom, b.hydr, { colors: b.hydrCol }));
    if (b.small.length) g.add(instanced(GEO.flower, MAT.bloom, b.small, { colors: b.smallCol, cast: false }));
    if (b.lav.length) g.add(instanced(GEO.lavender, MAT.lavender, b.lav, { cast: false }));
    if (b.delph.length) g.add(instanced(GEO.delphinium, MAT.bloom, b.delph, { colors: b.delph.map(() => PAL.white[0]) }));
    if (b.stems.length) g.add(instanced(GEO.stemThin, MAT.stem, b.stems, { cast: false }));
    if (b.vases.length) g.add(instanced(GEO.budVase, MAT.crystal, b.vases, { cast: false }));
    if (b.candelabra.length) g.add(instanced(GEO.candelabra, MAT.brass, b.candelabra));
    if (b.sticks.length) g.add(instanced(GEO.candlestick, MAT.brass, b.sticks));
    if (b.candles.length) g.add(instanced(GEO.candle, MAT.ivory, b.candles, { cast: false }));
    if (b.flames.length) g.add(instanced(GEO.flame, FLAME, b.flames, { cast: false, receive: false }));
    addGlow(key, b.glows, 0.2, 1.0, g);
    addTo(key, g, parent);
  };
  return b;
}
// An olive sprig: pairs of leaves along a short arc from (x,y,z) towards angle a.
function sprig(b, r, x, y, z, a, len, droop = 0.2, palette = PAL.olive) {
  const n = Math.round(len / 0.03);
  for (let i = 0; i < n; i++) {
    const t = i / n, d = t * len;
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = y - droop * t * t * len;
    for (const s of [-1, 1]) {
      b.leaves.push(mat(px, py, pz, -a + s * (0.7 + r() * 0.4), 0.8 + r() * 0.4, 1, 0.8 + r() * 0.4, (r() - 0.5) * 0.6, s * 0.3));
      b.leafCol.push(pick(palette, r));
    }
  }
}
function rose(b, r, x, y, z, palette, s = 1) {
  b.roses.push(mat(x, y, z, r() * TAU, s * (0.85 + r() * 0.35), s, s * (0.85 + r() * 0.35), (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
  b.roseCol.push(pick(palette, r));
}
// A thin stem from (x,y,z), height h, leaning `lean` towards heading la. Returns its tip.
function stem(b, x, y, z, h, la, lean) {
  b.stems.push(mat(x, y, z, la, 1, h, 1, lean));
  return { x: x + Math.sin(lean) * Math.sin(la) * h, y: y + Math.cos(lean) * h, z: z + Math.sin(lean) * Math.cos(la) * h };
}

// One table centrepiece in the chosen style, centred at (x, z) on a table top at height `top`.
function centrepiece(b, r, x, z, top) {
  const st = state.style.centrepiece;
  if (st === 'B') {
    // brass candelabra with a collar of roses and trailing greenery
    b.candelabra.push(mat(x, top, z));
    for (const [ax, az] of [...CANDELABRA_ARMS, [0, 0]]) {
      const ch = ax || az ? 0.62 : 0.68;
      b.candles.push(mat(x + ax, top + ch, z + az, 0, 1, 1.5, 1));
      b.flames.push(mat(x + ax, top + ch + 0.1, z + az));
      b.glows.push({ p: v3(x + ax, top + ch + 0.11, z + az), size: 0.3, flicker: 0.3 });
    }
    for (let k = 0; k < 16; k++) {
      const a = r() * TAU, rr = 0.06 + r() * 0.1;
      rose(b, r, x + Math.cos(a) * rr, top + 0.36 + r() * 0.1, z + Math.sin(a) * rr, PAL.blush, 1.1);
    }
    for (let k = 0; k < 2; k++) { b.hydr.push(mat(x + (k ? 0.08 : -0.08), top + 0.38, z, r() * TAU, 0.9)); b.hydrCol.push(pick(PAL.hydr, r)); }
    for (let k = 0; k < 10; k++) sprig(b, r, x, top + 0.38, z, r() * TAU, 0.22 + r() * 0.15, 1.6);
    for (let k = 0; k < 8; k++) sprig(b, r, x, top + 0.02, z, r() * TAU, 0.2 + r() * 0.1, 0.1);
  } else if (st === 'C') {
    // a loose cluster of bud vases: lavender and wildflowers
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + r(), rr = 0.08 + r() * 0.14, vx = x + Math.cos(a) * rr, vz = z + Math.sin(a) * rr;
      b.vases.push(mat(vx, top, vz, 0, 0.9 + r() * 0.4));
      for (let s = 0, n = 3 + Math.floor(r() * 3); s < n; s++) {
        const tip = stem(b, vx, top + 0.1, vz, 0.2 + r() * 0.15, r() * TAU, (r() - 0.5) * 0.35);
        if (k % 2) b.lav.push(mat(tip.x, tip.y, tip.z));
        else { b.small.push(mat(tip.x, tip.y, tip.z, r() * TAU, 1.2)); b.smallCol.push(pick(PAL.meadow, r)); }
      }
    }
    for (let k = 0; k < 6; k++) sprig(b, r, x + (r() - 0.5) * 0.3, top + 0.01, z + (r() - 0.5) * 0.3, r() * TAU, 0.15, 0.05);
  } else {
    // A: low olive branches with white garden roses
    for (let k = 0; k < 9; k++) sprig(b, r, x, top + 0.05 + r() * 0.04, z, (k / 9) * TAU + r() * 0.4, 0.22 + r() * 0.12, 0.15);
    for (let k = 0; k < 9; k++) {
      const a = r() * TAU, rr = r() * 0.12;
      rose(b, r, x + Math.cos(a) * rr, top + 0.07 + r() * 0.05, z + Math.sin(a) * rr, PAL.white, 1.15);
    }
  }
}

function photophoreBatch() {
  const st = state.style.photophores;
  const b = { glass: [], candles: [], flames: [], glows: [] };
  b.add = (x, y, z) => {
    if (st === 'C') {
      b.glass.push(mat(x, y, z));
      b.candles.push(mat(x, y + 0.07, z));
      b.flames.push(mat(x, y + 0.16, z));
      b.glows.push({ p: v3(x, y + 0.17, z), size: 0.35, flicker: 0.3 });
    } else {
      b.glass.push(mat(x, y + 0.045, z));
      b.candles.push(mat(x, y + 0.02, z, 0, 1.4, 0.3, 1.4));
      b.flames.push(mat(x, y + 0.05, z));
      b.glows.push({ p: v3(x, y + 0.06, z), size: 0.3, flicker: 0.4, color: st === 'B' ? [1.0, 0.5, 0.18] : undefined });
    }
  };
  b.flush = parent => {
    if (!b.glass.length) return;
    const g = new THREE.Group();
    g.add(instanced(st === 'C' ? GEO.hurricane : GEO.votive, st === 'B' ? MAT.amber : MAT.votive, b.glass, { cast: false }),
      instanced(st === 'C' ? GEO.pillar : GEO.candle, MAT.ivory, b.candles, { cast: false }),
      instanced(GEO.flame, FLAME, b.flames, { cast: false, receive: false }));
    addGlow('photophores', b.glows, 0.25, 1.0, g);
    addTo('photophores', g, parent);
  };
  return b;
}

function linenMaterial() {
  MAT.linen.color.setHex(LINEN_COLORS[state.style.linen]);
  return MAT.linen;
}

// A box of cloth that falls in soft folds to the floor.
function skirtBox(w, h, l) {
  const geo = new THREE.BoxGeometry(w, h, l, 24, 4, Math.ceil(l / 0.04));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = (h / 2 - y) / h;                    // 0 at the top, 1 at the floor
    if (Math.abs(Math.abs(x) - w / 2) < 1e-4) p.setX(i, x + Math.sign(x) * (0.012 * Math.sin(z * 38) * k + 0.04 * k));
    if (Math.abs(Math.abs(z) - l / 2) < 1e-4) p.setZ(i, z + Math.sign(z) * (0.012 * Math.sin(x * 38) * k + 0.04 * k));
  }
  geo.translate(0, h / 2, 0);
  geo.computeVertexNormals();
  return geo;
}
function skirtRound(R, h) {
  const geo = new THREE.CylinderGeometry(R + 0.03, R + 0.15, h, 120, 6, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = (h / 2 - y) / h;
    const s = 1 + (0.014 * Math.sin(a * 26) + 0.006 * Math.sin(a * 9 + 1)) * k / (R + 0.1);
    p.setX(i, x * s); p.setZ(i, z * s);
  }
  geo.translate(0, h / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

function buildHeadTable(it, parent) {
  const hi = headInfo(state);
  const g = itemGroup(it);
  const stageH = 0.25, top = stageH + 0.76;
  const sw = hi.front - hi.back;
  const stage = mesh(new THREE.BoxGeometry(sw, stageH, hi.len + 1.6), MAT.darkWood);
  stage.position.set((hi.front + hi.back) / 2, stageH / 2, 0);
  const stageRug = mesh(new THREE.BoxGeometry(sw - 0.05, 0.01, hi.len + 1.5), MAT.sisal, { cast: false });
  stageRug.position.set((hi.front + hi.back) / 2, stageH + 0.005, 0);
  const cloth = mesh(skirtBox(hi.depth, 0.76, hi.len), linenMaterial());
  cloth.position.y = stageH;
  g.add(stage, stageRug, cloth);

  // chairs and place settings, on one side or both
  const chairs = [], seats = [];
  for (const [cx, ry] of hi.chairs) for (let i = 0; i < hi.per; i++) {
    const z = -hi.len / 2 + 0.3 + 0.325 + i * 0.65;
    chairs.push(mat(cx, stageH, z, ry));
    const sx = Math.sign(cx) * (hi.depth / 2 - 0.2);
    seats.push({ x: sx, z, gx: sx * 0.45, gz: z + 0.16, a: 0 });
  }
  addChairs(chairs, g);
  addTo('tableware', placeSettings(seats, top), g);

  // flowers along the table, and photophores
  const b = flowerBatch(), r = rng(21);
  const cx = hi.both ? 0 : 0.18;
  const hf = state.style.headFlowers;
  if (hf === 'C') {
    for (let z = -hi.len / 2 + 0.2; z < hi.len / 2; z += 0.09) sprig(b, r, cx + (r() - 0.5) * 0.08, top + 0.03, z, r() < 0.5 ? Math.PI / 2 : -Math.PI / 2 + (r() - 0.5), 0.15, 0.1);
    for (let z = -hi.len / 2 + 0.6; z < hi.len / 2 - 0.3; z += 1.3) {
      b.sticks.push(mat(cx, top + 0.15, z));
      b.candles.push(mat(cx, top + 0.36, z, 0, 1, 1.6, 1));
      b.flames.push(mat(cx, top + 0.48, z));
      b.glows.push({ p: v3(cx, top + 0.49, z), size: 0.3, flicker: 0.3 });
    }
  } else {
    const abundant = hf === 'B';
    for (let z = -hi.len / 2 + 0.15; z < hi.len / 2 - 0.1; z += abundant ? 0.1 : 0.16) {
      sprig(b, r, cx + (r() - 0.5) * 0.1, top + 0.04, z, (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 1.2, 0.18 + r() * 0.1, abundant ? 0.6 : 0.2);
      if (r() < (abundant ? 0.8 : 0.4)) rose(b, r, cx + (r() - 0.5) * 0.16, top + 0.06 + (abundant ? r() * 0.12 : 0), z, abundant ? PAL.blush : PAL.white, 1.2);
      if (abundant && r() < 0.25) { b.hydr.push(mat(cx + (r() - 0.5) * 0.1, top + 0.08, z, r() * TAU)); b.hydrCol.push(pick(PAL.hydr, r)); }
      if (abundant && r() < 0.5) { b.small.push(mat(cx + (r() - 0.5) * 0.25, top + 0.1 + r() * 0.12, z, r() * TAU, 1.3)); b.smallCol.push(pick(PAL.meadow, r)); }
    }
  }
  b.flush(g);
  const ph = photophoreBatch();
  for (let z = -hi.len / 2 + 0.95; z < hi.len / 2 - 0.3; z += 0.65) for (const s of hi.both ? [-1, 1] : [1]) ph.add(cx + s * 0.16, top, z);
  ph.flush(g);
  lay.headPhotophores = ph.glass.length;

  // backdrop drape and a curtain of fairy lights behind the table
  const back = new THREE.Group();
  const span = hi.len + 2.2, bx = hi.back - 0.05;
  back.add(mesh(surface(Math.ceil(span / 0.04), 6, (u, v) => v3(bx + 0.05 * (1 + Math.sin(u * span * TAU / 0.25)), stageH + v * (lay.eave - 0.15 - stageH), -span / 2 + u * span), v3(1, 0, 0)), MAT.curtain, { cast: false }));
  const fb = [], fg = [];
  for (let z = -span / 2 + 0.1; z < span / 2; z += 0.22) for (let y = stageH + 0.3; y < lay.eave - 0.2; y += 0.2) {
    fb.push(mat(bx + 0.2, y + (r() - 0.5) * 0.06, z, 0, 0.3));
    fg.push({ p: v3(bx + 0.2, y, z), size: 0.09, flicker: 0.7, color: [1.0, 0.72, 0.42] });
  }
  back.add(instanced(GEO.bulb, BULB, fb, { cast: false, receive: false }));
  addGlow('curtain', fg, 0.2, 1.0, back);
  addTo('curtain', back, g);

  // microphone at the speech spot
  const mic = new THREE.Group();
  mic.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 8).translate(0, 0.72, 0), MAT.black));
  mic.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 20), MAT.black));
  mic.add(mesh(new THREE.SphereGeometry(0.03, 10, 8).translate(0, 1.47, 0), MAT.zinc));
  mic.position.set(hi.front + 1.25, 0, 0);
  g.add(mic);
  if (cur === layers.items) anim.mic = mic;
  addTo('headTable', g, parent);
}

function buildRounds(tables, parent) {
  if (!tables.length) return;
  const { tableR } = lay;
  const per = state.perTable;
  const top = 0.76;
  const g = new THREE.Group();
  const tm = tables.map(t => mat(t.x, 0, t.z));
  g.add(instanced(skirtRound(tableR, top), linenMaterial(), tm));
  g.add(instanced(new THREE.CylinderGeometry(tableR + 0.03, tableR + 0.03, 0.015, 64).translate(0, top, 0), MAT.linen, tm));
  addTo('rounds', g, parent);

  const chairs = [], seats = [];
  for (const t of tables) for (let i = 0; i < per; i++) {
    const a = (i / per) * TAU + (t.rot || 0);
    const rc = tableR + 0.33, rp = tableR - 0.22, ga = a + 0.22, rg = tableR - 0.42;
    chairs.push(mat(t.x + Math.cos(a) * rc, 0, t.z + Math.sin(a) * rc, Math.atan2(-Math.cos(a), -Math.sin(a))));
    seats.push({ x: t.x + Math.cos(a) * rp, z: t.z + Math.sin(a) * rp, gx: t.x + Math.cos(ga) * rg, gz: t.z + Math.sin(ga) * rg, a: -a });
  }
  addChairs(chairs, parent);
  addTo('tableware', placeSettings(seats, top + 0.008), parent);

  const b = flowerBatch();
  const ph = photophoreBatch();
  const n = state.photophores;
  for (const t of tables) {
    const r = rng(Math.round(t.x * 100 + t.z * 7919));
    centrepiece(b, r, t.x, t.z, top + 0.008);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + 0.3, rr = state.style.centrepiece === 'C' ? 0.33 : 0.36;
      ph.add(t.x + Math.cos(a) * rr, top + 0.008, t.z + Math.sin(a) * rr);
    }
  }
  b.flush(parent);
  ph.flush(parent);
}

function buildDanceFloor(it, parent) {
  const D = state.danceSize;
  const g = itemGroup(it);
  const style = state.style.danceFloor;
  const m = DANCE_MATS[style];
  if (m.map) m.map.repeat.set(D / (style === 'C' ? 2 : 2.4), D / (style === 'C' ? 2 : 2.4));
  const f = mesh(new THREE.BoxGeometry(D, 0.04, D), m, { cast: false });
  f.position.y = 0.02;
  g.add(f);
  for (const [w, d, x, z] of [[D + 0.06, 0.03, 0, D / 2], [D + 0.06, 0.03, 0, -D / 2], [0.03, D, D / 2, 0], [0.03, D, -D / 2, 0]]) {
    const b = mesh(new THREE.BoxGeometry(w, 0.045, d), MAT.brass, { cast: false });
    b.position.set(x, 0.022, z);
    g.add(b);
  }
  addTo('dance', g, parent);
}

function buildOlives(trees, parent) {
  if (!trees.length) return;
  const g = new THREE.Group();
  const pots = [], bands = [], soil = [], leaves = [], leafCol = [], bulbs = [], glows = [];
  const trunkGeos = [];
  const T = 1.25;   // a little larger than life so they read from across the tent
  const pot = state.style.pots;
  const potH = (pot === 'A' ? 0.8 : pot === 'B' ? 0.77 : 0.66) * T;
  for (const o of trees) {
    const r = rng(Math.round(o.x * 131 + o.z * 977) + 5);
    pots.push(mat(o.x, 0, o.z, o.rot || 0, T));
    if (pot === 'A') bands.push(mat(o.x, 0.52 * T, o.z, 0, T));
    if (pot === 'C') bands.push(mat(o.x, 0, o.z, 0, T));
    const sr = (pot === 'B' ? 0.36 : 0.38) * T;
    soil.push(mat(o.x, potH - 0.06, o.z, 0, sr, 1, sr));
    // a gnarled trunk splitting into limbs, each ending in a cluster of leaves
    const base = v3(o.x, potH - 0.05, o.z);
    const fork = v3(o.x + (r() - 0.5) * 0.15, potH + 0.55 * T, o.z + (r() - 0.5) * 0.15);
    trunkGeos.push(tube([base, base.clone().add(v3((r() - 0.5) * 0.08, 0.25, (r() - 0.5) * 0.08)), fork], 0.085 * T, 10, 8));
    const tips = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + r() * 0.8, out = (0.35 + r() * 0.25) * T;
      const mid = fork.clone().add(v3(Math.cos(a) * out * 0.45, (0.35 + r() * 0.15) * T, Math.sin(a) * out * 0.45));
      const end = fork.clone().add(v3(Math.cos(a) * out, (0.65 + r() * 0.3) * T, Math.sin(a) * out));
      trunkGeos.push(tube([fork, mid, end], (0.05 - k * 0.004) * T, 10, 6));
      tips.push(end);
      for (let s = 0; s < 3; s++) {
        const sa = a + (r() - 0.5) * 1.6;
        const tip = end.clone().add(v3(Math.cos(sa) * 0.3 * T, (0.15 + r() * 0.25) * T, Math.sin(sa) * 0.3 * T));
        trunkGeos.push(tube([end, end.clone().lerp(tip, 0.5).add(v3(0, 0.05, 0)), tip], 0.018 * T, 6, 5));
        tips.push(tip);
      }
    }
    for (const tip of tips) for (let k = 0; k < 150; k++) {
      const d = v3(r() - 0.5, (r() - 0.35) * 0.8, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()) * 0.4 * T);
      const p = tip.clone().add(d);
      const ls = 1.9 + r() * 0.7;
      leaves.push(mat(p.x, p.y, p.z, r() * TAU, ls, ls, ls * 1.3, (r() - 0.5) * 1.8, (r() - 0.3) * 1.2));
      // silvery undersides mixed with darker tops
      leafCol.push(r() < 0.35 ? PAL.olive[3] : pick(PAL.olive, r));
    }
    for (let k = 0; k < 30; k++) {
      const p = pick(tips, r).clone().add(v3((r() - 0.5) * 0.5, (r() - 0.6) * 0.4, (r() - 0.5) * 0.5));
      bulbs.push(mat(p.x, p.y, p.z, 0, 0.3));
      glows.push({ p, size: 0.1, flicker: 0.6, color: [1.0, 0.7, 0.38] });
    }
    // a hidden uplight in the pot washes the canopy from below
    const up = new THREE.SpotLight(0xFFC890, 0, 4.5 * T, 0.75, 0.6, 1.4);
    up.position.set(o.x, potH + 0.05, o.z);
    up.target.position.set(o.x, potH + 2, o.z);
    g.add(up.target);
    addLight(up, 5, g, 'tree');
  }
  const potMat = pot === 'A' ? MAT.terracotta : pot === 'B' ? MAT.stone : MAT.rattan;
  g.add(instanced(pot === 'A' ? GEO.anduze : pot === 'B' ? GEO.planter : GEO.basket, potMat, pots));
  if (bands.length) g.add(instanced(pot === 'A' ? GEO.potBand : GEO.basketRim, pot === 'A' ? MAT.glaze : MAT.rattan, bands));
  g.add(instanced(new THREE.CylinderGeometry(1, 1, 0.02, 24), MAT.soil, soil, { cast: false }));
  g.add(mesh(mergeGeometries(trunkGeos), MAT.trunk));
  g.add(instanced(GEO.leaf, MAT.leaf, leaves, { colors: leafCol }));
  g.add(instanced(GEO.bulb, BULB, bulbs, { cast: false, receive: false }));
  addGlow('olives', glows, 0.12, 1.0, g);
  addTo('olives', g, parent);
}

function buildUrns(urns, parent) {
  if (!urns.length) return;
  const g = new THREE.Group();
  const st = state.style.urns;
  const b = flowerBatch();
  const urnM = [];
  for (const u of urns) {
    const r = rng(Math.round(u.x * 53 + u.z * 389) + 9);
    urnM.push(mat(u.x, 0, u.z, u.rot || 0));
    const y = 1.0;
    if (st === 'C') {
      for (let k = 0; k < 7; k++) {
        const a = r() * TAU;
        b.delph.push(mat(u.x + Math.cos(a) * 0.08, y + 0.15, u.z + Math.sin(a) * 0.08, a, 1, 1.2 + r() * 0.6, 1, 0.1 + r() * 0.25));
      }
      for (let k = 0; k < 16; k++) sprig(b, r, u.x, y + 0.1 + r() * 0.5, u.z, r() * TAU, 0.35 + r() * 0.25, -0.4);
      for (let k = 0; k < 10; k++) sprig(b, r, u.x, y + 0.02, u.z, r() * TAU, 0.4, 1.4);
    } else {
      const meadow = st === 'B';
      for (let k = 0; k < (meadow ? 6 : 9); k++) {
        const d = v3(r() - 0.5, r() * 0.8, r() - 0.5).normalize().multiplyScalar(0.25);
        b.hydr.push(mat(u.x + d.x, y + 0.12 + d.y, u.z + d.z, r() * TAU, meadow ? 1.1 : 1.6));
        b.hydrCol.push(meadow ? pick(PAL.meadow, r) : pick(PAL.hydr, r));
      }
      for (let k = 0; k < 24; k++) {
        const d = v3(r() - 0.5, r() * 0.9, r() - 0.5).normalize().multiplyScalar(0.28 + r() * 0.12);
        rose(b, r, u.x + d.x, y + 0.12 + d.y, u.z + d.z, meadow ? PAL.meadow : PAL.white, 1.5);
      }
      if (meadow) for (let k = 0; k < 40; k++) {
        const a = r() * TAU, rr = r() * 0.3;
        const tip = stem(b, u.x + Math.cos(a) * rr, y + 0.05, u.z + Math.sin(a) * rr, 0.3 + r() * 0.45, a, (r() - 0.2) * 0.5);
        b.small.push(mat(tip.x, tip.y, tip.z, r() * TAU, 1.6));
        b.smallCol.push(pick(PAL.meadow, r));
      }
      for (let k = 0; k < 18; k++) sprig(b, r, u.x, y + 0.08 + r() * 0.2, u.z, r() * TAU, 0.45 + r() * 0.2, 1.3, meadow ? PAL.green : PAL.olive);
    }
  }
  g.add(instanced(GEO.urn, MAT.stone, urnM));
  b.flush(g, 'urns');
  addTo('urns', g, parent);
}

function buildBar(it, parent) {
  const bar = itemGroup(it);
  const r = rng(8);
  const oak = state.style.bars === 'B';
  const front = mesh(new THREE.BoxGeometry(4, 1.06, 0.6), oak ? MAT.oak : MAT.ivory);
  if (oak) MAT.oak.map.repeat.set(4, 1);
  front.position.y = 0.53;
  const top = mesh(new THREE.BoxGeometry(4.2, 0.05, 0.75), oak ? MAT.marble : MAT.zinc);
  top.position.y = 1.085;
  const rail = mesh(new THREE.CylinderGeometry(0.02, 0.02, 4, 10).rotateZ(Math.PI / 2), MAT.brass);
  rail.position.set(0, 0.16, 0.42);
  bar.add(front, top, rail);
  if (!oak) {
    const panels = [];
    for (let x = -1.6; x <= 1.61; x += 0.8) panels.push(mat(x, 0.55, 0.305));
    bar.add(instanced(new THREE.BoxGeometry(0.62, 0.7, 0.02), MAT.linen, panels));
  }
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
  const pend = [], pg = [];
  for (const x of [-1.3, 0, 1.3]) {
    pend.push(mat(x, 2.2, 0, 0, 2));
    pg.push({ p: v3(x, 2.2, 0), size: 0.5, flicker: 0.03 });
  }
  bar.add(instanced(GEO.bulb, BULB, pend, { cast: false, receive: false }));
  const pl = new THREE.PointLight(0xFFBE80, 0, 8, 1.6);
  pl.position.set(0, 2.1, 0.2);
  addLight(pl, 3, bar);
  if (it.v === 'Champagne') {
    const coupes = [];
    for (let lvl = 0; lvl < 5; lvl++) {
      const n = 5 - lvl, sp = 0.115;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) coupes.push(mat(-1.2 + (i - (n - 1) / 2) * sp, 1.11 + lvl * 0.1, (j - (n - 1) / 2) * sp));
    }
    bar.add(instanced(GEO.coupe, MAT.crystal, coupes, { cast: false }));
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), NEON.clone());
  sign.material.map = TEX.neon[it.v] || TEX.neon.Cocktails;
  sign.material.color = new THREE.Color(2.2, 1.9, 1.6);
  sign.position.set(0, 2.62, -1.47);
  addTo('neon', sign, bar);
  addGlow('bars', pg, 0.2, 1.0, bar);
  addTo('bars', bar, parent);
}

function buildDJ(it, parent) {
  const booth = itemGroup(it);
  const desk = mesh(new THREE.BoxGeometry(2, 1.05, 0.7), MAT.darkWood);
  desk.position.y = 0.525;
  const topM = mesh(new THREE.BoxGeometry(2.05, 0.04, 0.75), MAT.brass);
  topM.position.y = 1.07;
  booth.add(desk, topM);
  for (const x of [-0.55, 0.55]) {
    const d = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 28), MAT.black);
    d.position.set(x, 1.11, 0);
    booth.add(d);
  }
  const mixer = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.35), MAT.black);
  mixer.position.set(0, 1.12, 0);
  booth.add(mixer);
  for (const x of [-1.5, 1.5]) {
    const st = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), MAT.black);
    st.position.set(x, 0.65, 0);
    const sp = mesh(new THREE.BoxGeometry(0.5, 0.8, 0.42), MAT.speaker);
    sp.position.set(x, 1.7, 0);
    booth.add(st, sp);
  }
  const led = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.01), BULB);
  led.position.set(0, 0.95, 0.36);
  booth.add(led);
  addTo('dj', booth, parent);
}

function buildCake(it, parent) {
  const g = itemGroup(it);
  g.add(mesh(skirtRound(0.45, 0.76), MAT.linen));
  g.add(mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.015, 40).translate(0, 0.76, 0), MAT.linen));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.1, 28).translate(0, 0.81, 0), MAT.brass));
  let y = 0.86;
  for (const [rr, h] of [[0.2, 0.16], [0.16, 0.15], [0.12, 0.14], [0.085, 0.13]]) {
    g.add(mesh(new THREE.CylinderGeometry(rr, rr, h, 40).translate(0, y + h / 2, 0), MAT.cake));
    y += h;
  }
  const b = flowerBatch(), r = rng(77);
  for (let k = 0; k < 12; k++) {
    const a = r() * TAU, yy = 0.9 + r() * 0.5, rr = 0.2 - (yy - 0.86) * 0.2;
    sprig(b, r, Math.cos(a) * rr, yy, Math.sin(a) * rr, a, 0.08, 0.3);
    if (k % 2) rose(b, r, Math.cos(a) * rr, yy, Math.sin(a) * rr, PAL.white, 0.9);
  }
  b.flush(g);
  addTo('cake', g, parent);
}

function buildLounge(it, parent) {
  const g = itemGroup(it);
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
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.4, 36).translate(0, 0.2, 0), MAT.travertine));
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.3, 24, 1, true).translate(1.6, 1.5, 0), MAT.curtain),
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 8).translate(1.6, 0.7, 0), MAT.brass));
  addGlow('lounge', [{ p: v3(1.6, 1.45, 0), size: 0.9, flicker: 0.02 }], 0.1, 1.0, g);
  const pl = new THREE.PointLight(0xFFB774, 0, 6, 1.6);
  pl.position.set(1.6, 1.4, 0);
  addLight(pl, 2, g);
  addTo('lounge', g, parent);
}

function buildScreen(it, parent) {
  const scr = itemGroup(it);
  const cy = Math.min(3.75, lay.ridge - 1.75);
  anim.lowerThird ||= new THREE.MeshBasicMaterial({ map: lowerThirdTex(''), transparent: true, depthWrite: false });
  for (const x of [-2.75, 2.75]) {
    const leg = mesh(new THREE.BoxGeometry(0.29, cy + 1.55, 0.29), MAT.black);
    leg.position.set(x, (cy + 1.55) / 2, 0);
    scr.add(leg);
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
  addTo('screens', scr, parent);
}

// Simple figures in the manner of an architect's model.
function figure(kind) {
  const f = new THREE.Group();
  const head = y => f.add(mesh(new THREE.SphereGeometry(0.095, 20, 16).scale(0.9, 1.1, 0.95).translate(0, y, 0), MAT.skin));
  if (kind === 'bride') {
    f.add(mesh(new THREE.LatheGeometry(v2s([[0, 0], [0.48, 0], [0.42, 0.2], [0.3, 0.55], [0.17, 0.95], [0.13, 1.05], [0.15, 1.2], [0.16, 1.32], [0.11, 1.4], [0.05, 1.43], [0, 1.43]]), 40), MAT.dress));
    f.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.1, 10).translate(0, 1.47, 0), MAT.skin));
    head(1.6);
    f.add(mesh(new THREE.SphereGeometry(0.06, 12, 10).translate(0, 1.66, -0.08), MAT.hair));
    f.add(mesh(new THREE.LatheGeometry(v2s([[0.06, 1.66], [0.18, 1.3], [0.32, 0.6], [0.45, 0.02]]), 32, Math.PI * 0.6, Math.PI * 0.8), MAT.crystal));
    for (const s of [-1, 1]) f.add(mesh(tube([v3(s * 0.15, 1.33, 0), v3(s * 0.2, 1.15, 0.08), v3(s * 0.12, 1.05, 0.2)], 0.028, 10, 6), MAT.skin));
  } else {
    const m = kind === 'guest' ? MAT.greySuit : MAT.suit;
    for (const s of [-1, 1]) f.add(mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.86, 12).translate(s * 0.085, 0.43, 0), m));
    f.add(mesh(new THREE.LatheGeometry(v2s([[0, 0.84], [0.17, 0.86], [0.19, 1.1], [0.22, 1.36], [0.13, 1.45], [0.05, 1.49], [0, 1.49]]), 32), m));
    f.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.02).translate(0, 1.32, 0.17), MAT.shirt));
    f.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.1, 10).translate(0, 1.53, 0), MAT.skin));
    head(1.66);
    f.add(mesh(new THREE.SphereGeometry(0.097, 16, 12, 0, TAU, 0, Math.PI / 2).translate(0, 1.69, -0.01), MAT.hair));
    for (const s of [-1, 1]) f.add(mesh(tube([v3(s * 0.21, 1.38, 0), v3(s * 0.25, 1.12, 0.05), v3(s * 0.18, 0.95, 0.15)], 0.04, 10, 6), m));
  }
  return f;
}
function buildFigures() {
  const couple = new THREE.Group();
  const bride = figure('bride'), groom = figure('groom');
  bride.position.x = -0.2; groom.position.x = 0.2;
  bride.rotation.y = Math.PI / 2; groom.rotation.y = -Math.PI / 2;
  couple.add(bride, groom);
  cur.group.add(couple);
  anim.couple = couple;
  const speaker = figure('guest');
  speaker.position.set(lay.speech.x, 0, lay.speech.z);
  speaker.rotation.y = (lay.head.rot || 0) + Math.PI / 2;
  cur.group.add(speaker);
  anim.speaker = speaker;
}

function buildDisco() {
  const { dance, roofY } = lay;
  const g = new THREE.Group();
  const y = roofY(dance.x) - 1.3;
  const ball = mesh(new THREE.IcosahedronGeometry(0.36, 3), MIRROR_BALL, { cast: false });
  ball.position.set(dance.x, y, dance.z);
  g.add(ball, mesh(new THREE.CylinderGeometry(0.008, 0.008, roofY(dance.x) - y, 4).translate(dance.x, (roofY(dance.x) + y) / 2, dance.z), MAT.black));
  anim.ball = ball;
  // reflections that sweep the floor and walls while the ball turns
  const spin = new THREE.Group();
  spin.position.set(dance.x, 0, dance.z);
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

// ── Visibility and quality ─────────────────────────

function applyVisibility() {
  const plan = state.view === 'plan';
  for (const l of Object.values(layers)) for (const [key, objs] of Object.entries(l.reg)) {
    const on = (state.show[key] ?? true) && !(plan && PLAN_HIDE.has(key));
    for (const o of objs) o.visible = on;
  }
  const cut = state.show.cutaway;
  MAT.roof.side = cut ? THREE.BackSide : THREE.DoubleSide;
  MAT.glass.side = cut ? THREE.BackSide : THREE.DoubleSide;
  MAT.drape.side = cut ? THREE.FrontSide : THREE.DoubleSide;
  MAT.roof.needsUpdate = MAT.glass.needsUpdate = MAT.drape.needsUpdate = true;
  applyQuality();
}
function applyQuality() {
  const hq = state.quality !== 'fast';
  gtao.enabled = hq;
  bloom.enabled = hq;
  // the uplights in the olive pots are the first thing to go on a slow device
  for (const l of Object.values(layers)) for (const { light, kind } of l.lights) if (kind === 'tree') light.visible = hq;
  const ratio = Math.min(window.devicePixelRatio, hq ? 2 : 1);
  if (renderer.getPixelRatio() !== ratio) { renderer.setPixelRatio(ratio); resize(); }
}

// ── Arranging by hand ──────────────────────────────

const arrange = { on: false, sel: null, drag: null, history: [] };
const raycaster = new THREE.Raycaster();
const floorPlane = new THREE.Plane(v3(0, 1, 0), 0);
let selMesh = null;

function floorHit(e) {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(floorPlane, p) ? p : null;
}
// The smallest thing under the pointer wins, so a tree on the dance floor can be picked.
function itemAt(x, z) {
  let best = null, bestArea = Infinity;
  for (const it of currentItems()) {
    if (itemDist(it, x, z) > 0.05) continue;
    const f = footprint(it);
    const area = f.r !== undefined ? Math.PI * f.r * f.r : (f.x1 - f.x0) * (f.z1 - f.z0);
    if (area < bestArea) { best = it; bestArea = area; }
  }
  return best;
}
// The first change by hand freezes the automatic layout into the plan.
function takeOver() {
  if (!state.items) state.items = structuredClone(auto.items);
}
function remember() {
  arrange.history.push(JSON.stringify(state.items));
  if (arrange.history.length > 60) arrange.history.shift();
}
const findItem = id => currentItems().find(i => i.id === id);

function updateSelection() {
  if (selMesh) { selMesh.removeFromParent(); selMesh.geometry.dispose(); selMesh = null; }
  const it = arrange.on && arrange.sel && findItem(arrange.sel);
  if (!it) return;
  const f = footprint(it);
  let geo;
  if (f.r !== undefined) geo = new THREE.RingGeometry(f.r + 0.05, f.r + 0.13, 48).rotateX(-Math.PI / 2);
  else {
    const s = new THREE.Shape();
    s.moveTo(f.x0 - 0.13, f.z0 - 0.13); s.lineTo(f.x1 + 0.13, f.z0 - 0.13); s.lineTo(f.x1 + 0.13, f.z1 + 0.13); s.lineTo(f.x0 - 0.13, f.z1 + 0.13);
    const h = new THREE.Path();
    h.moveTo(f.x0 - 0.05, f.z0 - 0.05); h.lineTo(f.x0 - 0.05, f.z1 + 0.05); h.lineTo(f.x1 + 0.05, f.z1 + 0.05); h.lineTo(f.x1 + 0.05, f.z0 - 0.05);
    s.holes.push(h);
    geo = new THREE.ShapeGeometry(s).rotateX(Math.PI / 2);
  }
  selMesh = new THREE.Mesh(geo, SELECT);
  selMesh.position.set(it.x, 0.07, it.z);
  selMesh.rotation.y = it.rot || 0;
  selMesh.renderOrder = 6;
  scene.add(selMesh);
}

const ITEM_NAMES = { head: 'Head table', round: 'Round table', olive: 'Olive tree', urn: 'Flower urn', bar: 'Bar', dj: 'DJ booth', cake: 'Cake table', lounge: 'Lounge', screen: 'Screen', dance: 'Dance floor' };
const FIXED = new Set(['head', 'dance']);
function select(id) {
  arrange.sel = id;
  const it = id && findItem(id);
  $('#selected').textContent = it
    ? `${ITEM_NAMES[it.type]}${it.n ? ' ' + it.n : ''} selected${FIXED.has(it.type) ? ' (it can be moved but not removed)' : ''}.`
    : 'Click anything to select it, then drag it.';
  updateSelection();
}

addEventListener('pointerdown', e => {
  if (e.target !== canvas || !arrange.on || state.view === 'walk' || e.button !== 0) return;
  const p = floorHit(e);
  const it = p && itemAt(p.x, p.z);
  if (!it) { select(null); return; }
  controls.enabled = false;   // runs before the orbit controls see this press
  arrange.drag = { id: it.id, sx: e.clientX, sy: e.clientY, ox: it.x - p.x, oz: it.z - p.z, x0: it.x, z0: it.z, lifted: false };
  select(it.id);
}, true);
addEventListener('pointermove', e => {
  const d = arrange.drag;
  if (!d) return;
  if (!d.lifted) {
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    d.lifted = true;
    takeOver();
    computeAll();
    buildItems(d.id);
    buildDrag(findItem(d.id));
    applyVisibility();
  }
  const p = floorHit(e);
  if (!p) return;
  const lim = 25;
  d.x = Math.max(-lay.W / 2 - lim, Math.min(lay.W / 2 + lim, Math.round((p.x + d.ox) * 20) / 20));
  d.z = Math.max(-lay.L / 2 - lim, Math.min(lay.L / 2 + lim, Math.round((p.z + d.oz) * 20) / 20));
  layers.drag.group.position.set(d.x - d.x0, 0, d.z - d.z0);
  if (selMesh) selMesh.position.set(d.x, 0.07, d.z);
});
addEventListener('pointerup', () => {
  const d = arrange.drag;
  if (!d) return;
  arrange.drag = null;
  controls.enabled = state.view !== 'walk';
  if (!d.lifted) return;
  clearLayer('drag');
  if (d.x !== undefined) {
    remember();
    const it = findItem(d.id);
    it.x = d.x; it.z = d.z;
    saveState();
  }
  rebuildItems();
});

function rotateSel(step = Math.PI / 12) {
  if (!arrange.sel || !findItem(arrange.sel)) return;
  takeOver(); remember();
  const it = findItem(arrange.sel);
  it.rot = ((it.rot || 0) + step + TAU) % TAU;
  saveState(); rebuildItems();
}
function deleteSel() {
  const it = arrange.sel && findItem(arrange.sel);
  if (!it || FIXED.has(it.type)) return;
  takeOver(); remember();
  state.items = state.items.filter(i => i.id !== arrange.sel);
  saveState(); select(null); rebuildItems();
}
function undo() {
  const prev = arrange.history.pop();
  if (!prev) return;
  state.items = JSON.parse(prev);
  saveState(); rebuildItems();
}
// Add a new item at the nearest free spot to the middle of the view.
function addItem(type) {
  takeOver(); remember();
  const c = controls.target;
  const need = (footprint({ type }).r ?? 1) + 0.1;
  let best = null;
  for (let rad = 0; rad < 30 && !best; rad += 0.25) {
    for (let a = 0; a < TAU && !best; a += 0.2) {
      const x = c.x + Math.cos(a) * rad, z = c.z + Math.sin(a) * rad;
      if (Math.abs(x) > lay.W / 2 - need || Math.abs(z) > lay.L / 2 - need) continue;
      if (currentItems().every(it => it.type === 'dance' || itemDist(it, x, z) >= need)) best = { x, z };
    }
  }
  const p = best || { x: c.x, z: c.z };
  const it = mkItem(type, Math.round(p.x * 20) / 20, Math.round(p.z * 20) / 20);
  state.items.push(it);
  saveState();
  rebuildItems();
  select(it.id);
}

addEventListener('keydown', e => {
  if (typing(e) || !arrange.on) return;
  if (e.key === 'r' || e.key === 'R') rotateSel(e.shiftKey ? -Math.PI / 12 : Math.PI / 12);
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key === 'Escape') select(null);
});

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
}
function collide(p) {
  const pr = 0.28;
  const dancing = MOMENTS[state.moment].dancing;
  const pushCircle = (cx, cz, r) => {
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), m = r + pr;
    if (d < m && d > 1e-6) { p.x = cx + dx / d * m; p.z = cz + dz / d * m; }
  };
  const pushRect = (q, r) => {
    const cx = Math.max(r.x0, Math.min(q.x, r.x1)), cz = Math.max(r.z0, Math.min(q.z, r.z1));
    const dx = q.x - cx, dz = q.z - cz, d = Math.hypot(dx, dz);
    if (d >= pr) return false;
    if (d > 1e-6) { q.x = cx + dx / d * pr; q.z = cz + dz / d * pr; }
    else {
      const opts = [[r.x0 - pr - q.x, 0], [r.x1 + pr - q.x, 0], [0, r.z0 - pr - q.z], [0, r.z1 + pr - q.z]];
      opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      q.x += opts[0][0]; q.z += opts[0][1];
    }
    return true;
  };
  for (const c of layers.static.obstacles.circles) pushCircle(c.x, c.z, c.r);
  for (const r of layers.static.obstacles.rects) pushRect(p, r);
  for (const it of currentItems()) {
    if (it.type === 'dance') continue;
    if (it.type === 'round' && it.cleared && dancing) continue;
    const f = footprint(it);
    if (f.r !== undefined) { pushCircle(it.x, it.z, it.type === 'round' ? lay.tableR + 0.42 : f.r); continue; }
    const rect = it.type === 'head' ? { ...f, z0: f.z0 + 0.6, z1: f.z1 - 0.6 } : f;
    const q = toLocal(it, p.x, p.z);
    if (pushRect(q, rect)) { const w = toWorld(it, q.x, q.z); p.x = w.x; p.z = w.z; }
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

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const typing = e => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);

function setHelp() {
  const v = state.view;
  $('#help').textContent = v === 'walk'
    ? 'Drag to look · W A S D / Z Q S D or arrows to move · Shift to hurry · click the map to jump'
    : arrange.on ? 'Drag anything to move it · R rotates · Delete removes · drag empty space to turn the view'
      : v === 'plan' ? 'Floor plan · drag to pan around, scroll to zoom' : 'Drag to turn · right-drag to pan · scroll to zoom';
}
function setView(v, fromEntrance) {
  state.view = v;
  const { W, L } = lay;
  $('#pad').classList.toggle('show', v === 'walk');
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
  setHelp();
  applyVisibility();
  syncPanel();
}

// ── Panel ──────────────────────────────────────────

// style rows are generated from the catalogue
$('#styles').innerHTML = Object.entries(CATALOG).map(([k, c]) => `
  <div class="style-row">
    <div class="row"><span>${c.label}</span>
      <div class="seg small" data-style="${k}">${Object.keys(c.opts).map(o => `<button data-val="${o}">${o}</button>`).join('')}</div>
    </div>
    <div class="style-name" data-style-name="${k}"></div>
  </div>`).join('');

function syncPanel() {
  for (const seg of $$('.seg[data-key]')) {
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', String(state[seg.dataset.key]) === b.dataset.val);
  }
  for (const seg of $$('.seg[data-style]')) {
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', state.style[seg.dataset.style] === b.dataset.val);
  }
  for (const n of $$('[data-style-name]')) n.textContent = CATALOG[n.dataset.styleName].opts[state.style[n.dataset.styleName]];
  for (const i of $$('input[data-key]')) i.value = state[i.dataset.key];
  for (const o of $$('output[data-for]')) o.textContent = state[o.dataset.for];
  for (const i of $$('input[data-show]')) i.checked = !!state.show[i.dataset.show];
  $('#arrange').checked = arrange.on;
  $('#arrange-tools').classList.toggle('show', arrange.on);
  $('#custom-note').classList.toggle('show', !!state.items);
}

function inventory() {
  const { tables, seated, hi, dance } = lay;
  const items = currentItems();
  const count = t => items.filter(i => i.type === t).length;
  const sh = state.show, sty = k => `${state.style[k]} · ${CATALOG[k].opts[state.style[k]]}`;
  const ph = tables.length * state.photophores + (lay.headPhotophores || 0);
  const rows = [
    ['Tent', `${state.tentW} × ${state.tentL} m · ${state.tentW * state.tentL} m²`],
    ['Side walls', { open: 'rolled up', glass: 'glass', closed: 'white' }[state.walls]],
    ['Seated guests', `${seated} of ${state.guests}`],
    [`Round tables Ø${(lay.tableR * 2).toFixed(1)} m`, `${tables.length} × ${state.perTable}`],
    ['Head table', `${hi.len.toFixed(1)} m · ${hi.seats} seats · ${hi.both ? 'both sides' : 'one side'}`],
    ['Chairs', `${tables.length * state.perTable + hi.seats} · ${sty('chairs')}`],
    ['Table linen', sty('linen')],
    ['Tableware', sty('tableware')],
    ['Table flowers', `${tables.length} · ${sty('centrepiece')}`],
    ['Head table flowers', sty('headFlowers')],
    ['Dance floor', `${dance.size} × ${dance.size} m · ${sty('danceFloor')}`],
    ['Tables cleared after dinner', tables.filter(t => t.cleared).length],
  ];
  if (count('urn')) rows.push(['Flower urns', `${count('urn')} · ${sty('urns')}`]);
  if (count('bar')) rows.push(['Bars', `${count('bar')} · ${sty('bars')}`]);
  if (count('dj')) rows.push(['DJ booth', count('dj')]);
  if (count('screen')) rows.push(['Screens 4.8 × 2.7 m', count('screen')]);
  if (count('cake')) rows.push(['Cake table', count('cake')]);
  if (count('lounge')) rows.push(['Lounge corner', count('lounge')]);
  if (sh.ceilingDrapes) rows.push(['Ceiling drapes', `≈ ${Math.round(state.tentW * state.tentL * 1.25)} m² · ${sty('drapes')}`]);
  if (sh.wallDrapes) rows.push(['Wall drapes', `${lay.frames.length * 2 + Math.max(0, Math.ceil((state.tentW - 0.5) / 5) - 1) * 2} tied panels + swags`]);
  if (sh.garlands) rows.push(['Guirlandes', `≈ ${lay.garland.metres} m · ${lay.garland.bulbs} bulbs · ${sty('garlands')}`]);
  if (sh.chandeliers) rows.push(['Chandeliers', `${lay.chandeliers} · ${sty('chandeliers')}`]);
  if (sh.photophores) rows.push(['Photophores', `${ph} · ${sty('photophores')}`]);
  if (sh.olives) rows.push(['Olive trees', `${count('olive')} · ${sty('pots')}`]);
  if (sh.curtain) rows.push(['Fairy-light curtain', `${(hi.len + 2.2).toFixed(1)} m wide`]);
  if (sh.spotlight) rows.push(['Follow spot', '1']);
  if (sh.disco) rows.push(['Mirror ball', '1 + 4 warm moving lights']);
  return rows;
}

function updatePanelInfo() {
  const { tables, needed, seated, hi } = lay;
  const W = state.tentW, L = state.tentL;
  const short = state.guests - seated;
  const area = W * L;
  const cleared = tables.filter(t => t.cleared).length;
  let html = `<b>${seated}</b> of ${state.guests} guests seated · ${tables.length} round tables + head table<br>`;
  html += `${area} m² · ${(area / state.guests).toFixed(2)} m² per guest (1.5 m² rule: ${Math.round(state.guests * 1.5)} m²)<br>`;
  html += `After dinner ${cleared} table${cleared === 1 ? '' : 's'} (${cleared * state.perTable} seats) are carried out for the dance floor.`;
  if (short > 0) {
    html += `<br><span class="warn">${short} guests have no seat (${needed - tables.length} more tables needed).</span>`;
    if (!state.items) {
      const fit = smallestFit(state);
      if (fit) html += `<br><span class="ok">Smallest standard size that fits everyone: <b>${fit[0]} × ${fit[1]} m</b></span> <button class="btn solid" id="btn-fit" style="margin-top:6px">Try ${fit[0]} × ${fit[1]}</button>`;
    } else html += '<br><span class="ok">Add tables by hand, or re-arrange automatically.</span>';
  } else {
    const spare = hi.seats + tables.length * state.perTable - state.guests;
    html += `<br><span class="ok">Everyone has a seat${spare > 0 ? `, with ${spare} spare` : ''}.</span>`;
  }
  $('#capacity').innerHTML = html;
  const fitBtn = $('#btn-fit');
  if (fitBtn) fitBtn.onclick = () => {
    const fit = smallestFit(state);
    state.tentW = fit[0]; state.tentL = fit[1];
    commit('tentW');
  };
  const chip = $('#chip');
  chip.textContent = short > 0 ? `${W} × ${L} m tent · ${seated} / ${state.guests} seated` : `${W} × ${L} m tent · all ${state.guests} guests seated`;
  chip.classList.toggle('warn', short > 0);
  $('#inventory').innerHTML = inventory().map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join('');
}

function commit(key) {
  const relayout = LAYOUT_KEYS.has(key) || (LAYOUT_SHOW.has(key) && !state.items);
  if (LAYOUT_KEYS.has(key) && state.items
    && confirm('Re-arrange the tent automatically for this change? Your hand-placed arrangement will be replaced. (Cancel keeps it.)')) {
    state.items = null; arrange.history = []; arrange.sel = null;
  }
  saveState();
  if (STATIC_KEYS.has(key)) rebuildAll(relayout);
  else if (relayout || ITEM_KEYS.has(key) || key === 'headSeats') rebuildItems(relayout);
  else applyVisibility();
  if (key === 'view') setView(state.view);
  if (STATIC_KEYS.has(key)) setView(state.view === 'walk' ? 'orbit' : state.view);
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
for (const seg of $$('.seg[data-style]')) {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    const k = seg.dataset.style;
    if (!b || state.style[k] === b.dataset.val) return;
    state.style[k] = b.dataset.val;
    saveState();
    if (STATIC_STYLES.has(k)) { buildStatic(); applyVisibility(); }
    // the head table style changes its size, so an automatic layout is redone
    else rebuildItems(k === 'headTable' && !state.items);
    syncPanel();
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
$('#arrange').addEventListener('change', e => {
  arrange.on = e.target.checked;
  if (arrange.on && state.view === 'walk') setView('orbit');
  select(null);
  setHelp(); syncPanel();
});
for (const b of $$('[data-add]')) b.addEventListener('click', () => addItem(b.dataset.add));
$('#btn-rotate').addEventListener('click', () => rotateSel());
$('#btn-delete').addEventListener('click', deleteSel);
$('#btn-undo').addEventListener('click', undo);
$('#btn-auto').addEventListener('click', () => {
  if (!confirm('Replace your hand-placed arrangement with the automatic one?')) return;
  state.items = null; arrange.history = [];
  saveState(); select(null); rebuildItems(true); syncPanel();
});
$('#btn-entrance').addEventListener('click', () => setView('walk', true));
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Reset every choice and arrangement to the starting plan?')) return;
  state = structuredClone(DEFAULTS);
  arrange.history = [];
  saveState();
  select(null);
  rebuildAll(true);
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
  const s = 190 / Math.max(state.tentW, state.tentL);
  return { s, w: state.tentW * s, h: state.tentL * s };
}
function drawMini() {
  const W = state.tentW, L = state.tentL;
  const { tables, tableR } = lay;
  const { s, w, h } = miniScale();
  const pw = Math.round(h + 10), ph = Math.round(w + 10); // drawn landscape: length runs left→right
  if (mini.width !== pw * 2 || mini.height !== ph * 2) {
    mini.width = pw * 2; mini.height = ph * 2;
    mini.style.width = pw + 'px'; mini.style.height = ph + 'px';
  }
  mg.setTransform(2, 0, 0, 2, 0, 0);
  mg.clearRect(0, 0, pw, ph);
  // world (x, z) → map: z to the right, x down (head table along the top edge)
  const P = (x, z) => [5 + (z + L / 2) * s, 5 + (x + W / 2) * s];
  mg.fillStyle = '#EFE6D6'; mg.strokeStyle = '#8B8494'; mg.lineWidth = 1;
  mg.fillRect(5, 5, h, w); mg.strokeRect(5, 5, h, w);
  const dancing = MOMENTS[state.moment].dancing;
  const COLORS = { head: '#7A6A55', dance: dancing ? '#C9A27A' : '#E3D2BA', bar: '#4F6480', dj: '#363B26', lounge: '#B86E4B', screen: '#23260F' };
  const items = currentItems();
  for (const t of ['dance', 'head', 'bar', 'dj', 'lounge', 'screen']) for (const it of items) {
    if (it.type !== t) continue;
    const f = footprint(it);
    const corners = [[f.x0, f.z0], [f.x1, f.z0], [f.x1, f.z1], [f.x0, f.z1]].map(([lx, lz]) => { const p = toWorld(it, lx, lz); return P(p.x, p.z); });
    mg.fillStyle = COLORS[t];
    mg.beginPath(); corners.forEach(([a, b], i) => (i ? mg.lineTo(a, b) : mg.moveTo(a, b))); mg.closePath(); mg.fill();
  }
  mg.strokeStyle = '#657252';
  for (const t of tables) {
    if (t.cleared && dancing) continue;
    const [a, b] = P(t.x, t.z);
    mg.fillStyle = '#FAF6EE';
    mg.setLineDash(t.cleared ? [2, 2] : []);
    mg.beginPath(); mg.arc(a, b, Math.max(2, tableR * s), 0, TAU); mg.fill(); mg.stroke();
    mg.setLineDash([]);
    if (s > 4) { mg.fillStyle = '#4B5136'; mg.font = '7px Montserrat'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText(t.n, a, b + 0.5); }
  }
  for (const it of items) {
    if (it.type !== 'olive' && it.type !== 'urn' && it.type !== 'cake') continue;
    const [a, b] = P(it.x, it.z);
    mg.fillStyle = it.type === 'olive' ? '#657252' : it.type === 'urn' ? '#C48E9A' : '#B9A27E';
    mg.beginPath(); mg.arc(a, b, 2.4, 0, TAU); mg.fill();
  }
  const sel = arrange.on && arrange.sel && findItem(arrange.sel);
  if (sel) {
    const [a, b] = P(arrange.drag?.x ?? sel.x, arrange.drag?.z ?? sel.z);
    mg.strokeStyle = '#4F6480'; mg.lineWidth = 1.5;
    mg.beginPath(); mg.arc(a, b, 6, 0, TAU); mg.stroke(); mg.lineWidth = 1;
  }
  // entrance marker and the viewer
  const [ea, eb] = P(W / 2, 0);
  mg.fillStyle = '#92AAC4'; mg.fillRect(ea - 6, eb - 1, 12, 3);
  const cp = camera.position;
  const [ca, cb] = P(Math.max(-W / 2 - 2, Math.min(W / 2 + 2, cp.x)), Math.max(-L / 2 - 2, Math.min(L / 2 + 2, cp.z)));
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  mg.save(); mg.translate(ca, cb); mg.rotate(Math.atan2(dir.z, -dir.x));
  mg.fillStyle = '#9A4A2E';
  mg.beginPath(); mg.moveTo(0, -7); mg.lineTo(4.5, 4); mg.lineTo(-4.5, 4); mg.closePath(); mg.fill();
  mg.restore();
}
mini.addEventListener('click', e => {
  if (state.view !== 'walk') setView('walk');
  const r = mini.getBoundingClientRect();
  const { s } = miniScale();
  const z = (e.clientX - r.left - 5) / s - state.tentL / 2;
  const x = (e.clientY - r.top - 5) / s - state.tentW / 2;
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
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
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
  scene.environmentIntensity = env.env * (0.6 + 0.4 * mo.dim);
  scene.fog.color.copy(env.fog);
  stars.material.opacity = env.stars;
  renderer.toneMappingExposure = env.exp;
  bloom.strength = env.bloom;
  MAT.roof.emissive.setRGB(1, 0.97, 0.9).multiplyScalar(env.roofGlow);

  // warm lights come up as the evening goes on, and dip for the spotlight moments
  const warm = 0.12 + 0.88 * nf;
  for (const l of Object.values(layers)) {
    for (const { light, base, kind } of l.lights) light.intensity = base * (kind === 'tree' ? nf * (0.5 + 0.5 * mo.dim) : warm * mo.dim) * 2.2;
    for (const gs of l.glows) gs.points.material.uniforms.uIntensity.value = gs.day + (gs.night - gs.day) * nf;
  }
  BULB.color.copy(BULB_BASE).multiplyScalar(0.7 + 0.6 * nf);
  FLAME.color.copy(FLAME_BASE).multiplyScalar(0.6 + 0.9 * nf);

  // figures for each moment
  const { dance, cake, speech } = lay;
  if (anim.cleared) anim.cleared.visible = !m.dancing;
  const couple = anim.couple;
  couple.visible = state.moment === 'waltz' || state.moment === 'cake';
  anim.speaker.visible = state.moment === 'speech';
  if (anim.mic) anim.mic.visible = state.moment === 'speech';
  if (state.moment === 'waltz') {
    const a = t * 0.32;
    couple.position.set(dance.x + Math.cos(a) * dance.size * 0.22, 0.04, dance.z + Math.sin(a) * dance.size * 0.22);
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
  else target = v3(dance.x, 0, dance.z);
  spotAim.lerp(target, 1 - Math.exp(-dt * 6));
  spot.target.position.copy(spotAim);
  spot.angle = mo.angle;
  spot.intensity = 160 * mo.spot;
  const beamEnd = spotAim.clone().sub(spot.position).normalize().multiplyScalar(spot.position.distanceTo(spotAim) + 0.3).add(spot.position);
  aimBeam(spotBeam, spot.position, beamEnd, mo.angle * 0.9, 0.05 * mo.spot * (0.25 + 0.75 * nf));

  // party: moving warm spots, turning mirror ball and its sparkles
  const disco = state.show.disco ? 1 : 0;
  partyLights.forEach((p, i) => {
    const a = t * (0.55 + i * 0.12) + i * 1.7;
    p.l.target.position.set(dance.x + Math.cos(a) * dance.size * 0.35, 0, dance.z + Math.sin(a * 1.3) * dance.size * 0.35);
    p.l.intensity = 45 * mo.party * disco;
    aimBeam(p.beam, p.l.position, p.l.target.position, 0.2, 0.05 * mo.party * disco * (0.3 + 0.7 * nf));
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
  const screens = layers.items.reg.screens || [];
  if (m.live && state.show.screens && screens.length && frameN % 2 === 0) {
    let pos, look;
    const hr = lay.head.rot || 0, fx = Math.cos(hr), fz = -Math.sin(hr);
    if (m.live === 'speech') { pos = v3(speech.x + fx * 4.5 - fz * 1.4, 1.8, speech.z + fz * 4.5 + fx * 1.4); look = v3(speech.x, 1.45, speech.z); }
    else if (m.live === 'waltz') { pos = v3(dance.x + 5.2, 2.6, dance.z + 3.6); look = v3(couple.position.x, 1.0, couple.position.z); }
    else { pos = v3(cake.x + 3.4, 1.7, cake.z - 1.4); look = v3(cake.x + 0.4, 1.05, cake.z - 0.1); }
    screenCam.position.lerp(pos, 0.2);
    screenLook.lerp(look, 0.2);
    screenCam.lookAt(screenLook);
    for (const o of screens) o.visible = false;
    renderer.setRenderTarget(rtTarget);
    renderer.render(scene, screenCam);
    renderer.setRenderTarget(null);
    for (const o of screens) o.visible = state.show.screens;
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

scene.add(layers.static.group, layers.items.group, layers.drag.group);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, state.quality === 'fast' ? 1 : 2));
resize();
if (state.items) nextId = state.items.reduce((n, i) => Math.max(n, +i.id.split('-').pop() || 0), 0) + 1;
rebuildAll(true);
applyMoment();
syncPanel();
setView('orbit');
spotAim.set(lay.dance.x, 0, lay.dance.z);
screenCam.position.set(lay.dance.x + 5, 2.5, 3);
requestAnimationFrame(() => {
  tick();
  setTimeout(() => $('#loading').classList.add('gone'), 250);
});

// Redraw the canvas textures once the script font has arrived.
document.fonts.load('80px "Parfumerie Script"').then(() => {
  drawIdle(TEX.idle.userData.canvas.getContext('2d'), 1024, 576);
  TEX.idle.needsUpdate = true;
  for (const [label, tex] of Object.entries(TEX.neon)) {
    tex.image = neonTex(NEON_TEXT[label]).image;
    tex.needsUpdate = true;
  }
}).catch(() => {});

// handy when debugging from the console
window.tentPlan = {
  get state() { return state; }, get layout() { return lay; }, autoLayout, smallestFit, camera, walk, controls, arrange,
  select, addItem, rotateSel, rebuildItems,
  snap() {  // jump straight to the target lighting instead of easing
    const t = TIMES[state.time];
    for (const k in t) env[k] = t[k] instanceof THREE.Color ? t[k].clone() : t[k];
    const m = MOMENTS[state.moment];
    Object.assign(mo, { dim: m.dim, spot: state.show.spotlight ? m.spot : 0, party: m.party, angle: m.angle || mo.angle });
  },
};
