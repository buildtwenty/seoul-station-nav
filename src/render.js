// three.js 장면 구성. 역 JSON → 층판·승강장·계단·에스컬레이터·엘리베이터·개찰구·출구·라벨
import * as THREE from 'three';
import { doorPos, nodePos } from './route.js';
import { DEFAULT_Y_SCALE, DOORS_PER_CAR } from './schema.js';

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export class StationScene {
  constructor(scene) {
    this.scene = scene;
    this.world = new THREE.Group();
    this.routeGroup = new THREE.Group();
    scene.add(this.world, this.routeGroup);
    this.arrows = []; this.marker = null; this.curve = null; this.pulse = null;
    this.yScale = DEFAULT_Y_SCALE;
  }

  V(a) { return new THREE.Vector3(a[0], a[1] * this.yScale, a[2]); }
  Vp(p) { return new THREE.Vector3(p.x, p.y * this.yScale, p.z); }

  build(st, fromKey) {
    const Y = this.yScale, V = (a) => this.V(a);
    this.scene.background = new THREE.Color(css('--bg'));
    this.scene.remove(this.world); this.world = new THREE.Group(); this.scene.add(this.world); this.arrows = [];
    const world = this.world;
    const lineColor = (l) => css(`--line${l}`) || css('--ink');
    const platColor = (l) => css(`--plat${l}`) || css('--slab');

    for (const r of st.roads || []) world.add(box(r.x1 - r.x0, 0.3, r.z1 - r.z0, mat(css('--ground'), 0.3), (r.x0 + r.x1) / 2, -0.2, (r.z0 + r.z1) / 2));
    for (const [x, z] of st.pillars || []) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 8.2 * Y, 12), mat(css('--slab-edge'), 1)); c.position.set(x, 4.1 * Y, z); world.add(c); }
    for (const f of st.floors || []) {
      const m = box(f.x1 - f.x0, 1, f.z1 - f.z0, mat(css('--slab'), 1), (f.x0 + f.x1) / 2, f.y * Y - 0.75, (f.z0 + f.z1) / 2);
      world.add(m);
      if (f.label) { const sp = label(f.label, { size: 22, weight: 600, bg: css('--panel'), color: css('--ink'), scale: 0.17 }); sp.position.set(f.x0 + 6, f.y * Y + 4, f.z0 + 4); world.add(sp); }
    }
    for (const [name, pos] of st.tags || []) { const sp = label(name, { size: 22, weight: 600, bg: css('--panel'), color: css('--ink'), scale: 0.17 }); sp.position.copy(V(pos)).add(new THREE.Vector3(0, 4, 0)); world.add(sp); }
    for (const [name, pos, dir] of st.ends || []) world.add(arrowLabel(name, V(pos), dir));

    for (const key in st.platforms) {
      const p = st.platforms[key], a = V(p.a), b = V(p.b), len = a.distanceTo(b), alongX = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
      const mid = a.clone().add(b).multiplyScalar(0.5), pw = p.width || 6;
      const tracks = p.tracks || [p.track];
      world.add(box(alongX ? len : pw, 1.2, alongX ? pw : len, mat(platColor(p.line), 1), mid.x, mid.y - 0.6, mid.z));
      const head = p.car1 === 'a' ? a : b, tail = p.car1 === 'a' ? b : a, dir = head.clone().sub(tail).normalize();
      for (const tr of tracks) {
        const tv = V(tr);
        world.add(box(alongX ? len : 0.8, 1.26, alongX ? 0.8 : len, mat(lineColor(p.line), 1), mid.x + Math.sign(tr[0]) * (pw / 2 - 0.3), mid.y - 0.6, mid.z + Math.sign(tr[2]) * (pw / 2 - 0.3)));
        const tl = len + 60, tm = mid.clone().add(tv);
        world.add(box(alongX ? tl : 3.8, 0.6, alongX ? 3.8 : tl, mat(css('--track'), 1), tm.x, tm.y - 1.7, tm.z));
        const n = Math.floor(tl / 26);
        for (let i = 0; i < n; i++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.6, 4), mat(lineColor(p.line), 1));
          cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); cone.scale.z = 0.3;
          world.add(cone); this.arrows.push({ m: cone, base: tm.clone().sub(dir.clone().multiplyScalar(tl / 2)), dir, len: tl, off: i * 26, y: tm.y - 1.2 });
        }
      }
      const tr0 = tracks[0];
      const lb = label(p.label, { size: 20, bg: lineColor(p.line), color: '#fff', round: true, scale: 0.14 });
      lb.position.copy(mid).sub(V(tr0).multiplyScalar(1.6)).add(new THREE.Vector3(0, 5, 0));
      lb.position.add(dir.clone().multiplyScalar(-len * 0.28)); world.add(lb);
      const doors = p.doorsPerCar || DOORS_PER_CAR;
      for (let c = 1; c <= p.cars; c++) for (let d = 1; d <= doors; d++) {
        const q = this.Vp(doorPos(p, c, d));
        world.add(box(alongX ? 1.6 : 0.5, 0.2, alongX ? 0.5 : 1.6, mat(css('--sub'), 0.9), q.x + Math.sign(tr0[0]) * (pw / 2 - 0.8), q.y + 0.08, q.z + Math.sign(tr0[2]) * (pw / 2 - 0.8)));
      }
      if (key === fromKey) {
        for (let c = 1; c <= p.cars; c++) {
          const q = this.Vp(doorPos(p, c, 2)).lerp(this.Vp(doorPos(p, c, 3)), 0.5).add(V(tr0));
          const car = box(alongX ? 19 : 3.2, 3.4, alongX ? 3.2 : 19, mat(lineColor(p.line), 0.4), q.x, q.y + 0.6, q.z);
          car.userData.car = c; car.name = 'car'; world.add(car);
          const nl = label(String(c), { size: 20, weight: 700, color: css('--ink'), scale: 0.13 }); nl.position.set(q.x, q.y + 6, q.z); world.add(nl);
        }
      }
    }
    for (const [ai, bi, t] of st.edges) {
      if (t === 'plat') continue;
      const a = V(st.nodes[ai].p), b = V(st.nodes[bi].p);
      if (t === 'walk' || t === 'gate') world.add(ramp(a.clone().setY(a.y - 0.3), b.clone().setY(b.y - 0.3), css('--slab'), 5));
      else if (t === 'esc') world.add(escalator(a, b, 3.2, css('--escal')));
      else if (t === 'elevator') world.add(elevator(a, b));
      else world.add(stairs(a, b, t === 'mix' ? 3.6 : 3.2, css('--stairs')));
    }
    for (const id in st.nodes) {
      const n = st.nodes[id], v = V(n.p);
      if (n.type === 'gate') {
        const e = st.edges.find((e) => e[2] === 'gate' && (e[0] === id || e[1] === id));
        const o = e ? V(st.nodes[e[0] === id ? e[1] : e[0]].p).sub(v).normalize() : new THREE.Vector3(1, 0, 0);
        for (let i = -3; i <= 3; i++) { const g = box(0.8, 2.4, 2.2, mat(css('--gate'), 1), v.x - o.z * i * 2.1, v.y + 1.2, v.z + o.x * i * 2.1); g.rotation.y = Math.atan2(o.x, o.z); world.add(g); }
        const lb = label('개찰구', { size: 18, bg: css('--gate'), color: '#fff', scale: 0.13 }); lb.position.set(v.x, v.y + 8, v.z); world.add(lb);
      }
      if (n.type === 'exit') {
        world.add(box(9, 0.5, 9, mat(css('--ground'), 0.55), v.x, -0.1, v.z));
        world.add(box(5, 4, 5, mat(css('--exit'), 1), v.x, 2, v.z));
        const lb = label(String(n.no), { size: 32, weight: 700, bg: css('--exit'), color: css('--exit-ink'), round: true, scale: 0.2 }); lb.position.set(v.x, 12, v.z); world.add(lb);
      }
    }
  }

  /** 경로 그리기. 반환: 경로 경계 { t, r } (카메라 맞춤용) */
  drawRoute(st, fromKey, r, reduced) {
    this.scene.remove(this.routeGroup); this.routeGroup = new THREE.Group(); this.scene.add(this.routeGroup);
    this.marker = null; this.curve = null; this.pulse = null;
    if (!r) return null;
    const p = st.platforms[fromKey], start = this.Vp(doorPos(p, r.c, r.d));
    const tr0 = (p.tracks || [p.track])[0];
    const pts = [start.clone().add(this.V(tr0).multiplyScalar(0.5)), start];
    r.path.forEach((s) => pts.push(this.V(st.nodes[s.id].p)));
    const lifted = pts.map((v) => v.clone().add(new THREE.Vector3(0, 1.3, 0)));
    this.curve = new THREE.CatmullRomCurve3(lifted, false, 'catmullrom', 0.04);
    this.routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(this.curve, Math.max(60, lifted.length * 24), 1.35, 10, false), new THREE.MeshBasicMaterial({ color: css('--route') })));
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 14), new THREE.MeshBasicMaterial({ color: css('--route') })); this.routeGroup.add(this.marker);
    this.pulse = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.5, 32), new THREE.MeshBasicMaterial({ color: css('--route'), side: THREE.DoubleSide, transparent: true }));
    this.pulse.rotation.x = -Math.PI / 2; this.pulse.position.copy(start).add(new THREE.Vector3(0, 0.4, 0)); this.routeGroup.add(this.pulse);
    const dl = label(`${r.c}-${r.d}`, { size: 30, weight: 700, bg: css('--route'), color: '#fff', round: true, scale: 0.18 });
    dl.position.copy(start).add(new THREE.Vector3(0, 11, 0)); this.routeGroup.add(dl);
    this.world.children.forEach((o) => { if (o.name === 'car') o.material.opacity = o.userData.car === r.c ? 0.9 : 0.26; });
    this.marker.position.copy(this.curve.getPointAt(reduced ? 1 : 0));
    const bb = new THREE.Box3().setFromPoints(lifted), c = bb.getCenter(new THREE.Vector3()), d = bb.getSize(new THREE.Vector3()).length();
    return { t: c, r: Math.max(330, d * 2.1) };
  }

  animate(tt, reduced) {
    for (const a of this.arrows) { const s = reduced ? a.off : (a.off + tt * 14) % a.len; a.m.position.copy(a.base).add(a.dir.clone().multiplyScalar(s)); a.m.position.y = a.y; }
    if (this.marker && this.curve && !reduced) { const u = (tt * 0.11) % 1.25; this.marker.position.copy(this.curve.getPointAt(Math.min(1, u))); }
    if (this.pulse && !reduced) { const k = 1 + 0.5 * ((tt * 1.2) % 1); this.pulse.scale.set(k, k, k); this.pulse.material.opacity = 1 - ((tt * 1.2) % 1); }
  }
}

/* ---------- 도형 ---------- */
function mat(color, opacity) { return new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity: opacity ?? 1, depthWrite: !(opacity < 1) }); }
function box(w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; }
export function label(text, opts = {}) {
  const s = opts.size || 26, pad = opts.bg ? 12 : 4, cv = document.createElement('canvas'), g = cv.getContext('2d');
  const font = `${opts.weight || 600} ${s * 2}px "IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + pad * 4, h = s * 2 + pad * 3; cv.width = w; cv.height = h;
  if (opts.bg) { g.fillStyle = opts.bg; const r = opts.round ? h / 2 : 12; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill(); }
  g.font = font; g.fillStyle = opts.color || css('--ink'); g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const k = opts.scale || 0.16; sp.scale.set(w * k / 2, h * k / 2, 1); sp.renderOrder = 10; return sp;
}
function ramp(a, b, color, width) {
  const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, len), mat(color, 1));
  m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); return m;
}
function stairs(a, b, width, color) {
  const g = new THREE.Group(), h = new THREE.Vector3(b.x - a.x, 0, b.z - a.z), L = h.length(), n = Math.max(5, Math.min(30, Math.round(L / 1.5)));
  const yaw = Math.atan2(h.x, h.z), dy = (b.y - a.y) / n, m = mat(color, 1);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, s = box(width, Math.abs(dy) + 0.5, L / n + 0.05, m, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.abs(dy) / 2, a.z + (b.z - a.z) * t); s.rotation.y = yaw; g.add(s); }
  return g;
}
function escalator(a, b, width, color) {
  const g = new THREE.Group(); g.add(ramp(a, b, color, width));
  for (const side of [-1, 1]) {
    const h = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize(), off = new THREE.Vector3(-h.z, 0, h.x).multiplyScalar(side * width / 2);
    g.add(ramp(a.clone().add(off).add(new THREE.Vector3(0, 1.4, 0)), b.clone().add(off).add(new THREE.Vector3(0, 1.4, 0)), css('--ink'), 0.35));
  }
  return g;
}
function elevator(a, b) {
  const g = new THREE.Group(), lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
  const shaft = box(3.2, hi - lo + 3, 3.2, mat(css('--elev'), 0.35), a.x, (lo + hi) / 2 + 1.5, a.z); g.add(shaft);
  for (const v of [a, b]) g.add(box(3.4, 0.4, 3.4, mat(css('--elev'), 1), v.x, v.y + 0.2, v.z));
  const lb = label('EV', { size: 16, weight: 700, bg: css('--elev'), color: '#fff', round: true, scale: 0.12 }); lb.position.set(a.x, hi + 5, a.z); g.add(lb);
  return g;
}
function arrowLabel(text, pos, dir) {
  const g = new THREE.Group(), lb = label(text, { size: 26, weight: 700, color: css('--ink'), scale: 0.2 }); lb.position.copy(pos).add(new THREE.Vector3(0, 9, 0)); g.add(lb);
  const d = new THREE.Vector3(...dir), shaft = ramp(pos.clone(), pos.clone().add(d.clone().multiplyScalar(16)), css('--ink'), 1.6); g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(3.4, 8, 4), mat(css('--ink'), 1)); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); head.scale.z = 0.3;
  head.position.copy(pos).add(d.clone().multiplyScalar(20)); g.add(head); return g;
}
