// three.js 장면 구성. 역 JSON → 지면·도로·층판·승강장·스크린도어·계단·에스컬레이터·엘리베이터·개찰구·출구·라벨
// 공식 역 안내도처럼 보이도록: 모든 덩어리에 테두리 선, 부드러운 그림자, 평평한 색
import * as THREE from 'three';
import { doorPos } from './route.js';
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
    const edgeCol = css('--slab-edge');

    // 지면: 전체 범위를 덮는 옅은 판 (지하는 비쳐 보이도록 반투명)
    const ext = extent(st);
    const ground = box(ext.x1 - ext.x0 + 80, 0.4, ext.z1 - ext.z0 + 80, mat(css('--ground'), 0.22), (ext.x0 + ext.x1) / 2, -0.4, (ext.z0 + ext.z1) / 2);
    ground.receiveShadow = true; world.add(ground);
    // 도로와 이름
    for (const r of st.roads || []) {
      const road = box(r.x1 - r.x0, 0.3, r.z1 - r.z0, mat(css('--road'), 0.9), (r.x0 + r.x1) / 2, -0.15, (r.z0 + r.z1) / 2);
      road.receiveShadow = true; world.add(road);
      const alongX = (r.x1 - r.x0) > (r.z1 - r.z0);
      // 중앙선
      world.add(box(alongX ? r.x1 - r.x0 : 0.4, 0.05, alongX ? 0.4 : r.z1 - r.z0, mat(css('--road-line'), 1), (r.x0 + r.x1) / 2, 0.03, (r.z0 + r.z1) / 2));
      if (r.name) {
        for (const end of [0, 1]) {
          const lb = label(r.name, { size: 20, weight: 600, color: css('--road-ink'), px: 13 });
          lb.position.set(alongX ? (end ? r.x1 - 14 : r.x0 + 14) : (r.x0 + r.x1) / 2, 1.5, alongX ? (r.z0 + r.z1) / 2 : (end ? r.z1 - 14 : r.z0 + 14)); world.add(lb);
        }
      }
    }
    // 고가 기둥
    const deck = (st.floors || []).filter((f) => f.y > 0).map((f) => f.y);
    const pillarTop = deck.length ? Math.min(...deck) * Y : 8 * Y;
    for (const [x, z] of st.pillars || []) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, pillarTop, 14), mat(edgeCol, 1)); c.position.set(x, pillarTop / 2, z); c.castShadow = true; world.add(c); }
    // 층판
    for (const f of st.floors || []) {
      const m = box(f.x1 - f.x0, 1.2, f.z1 - f.z0, mat(css('--slab'), 1), (f.x0 + f.x1) / 2, f.y * Y - 0.8, (f.z0 + f.z1) / 2);
      m.receiveShadow = true; m.castShadow = true; world.add(m); world.add(outline(m, edgeCol));
      if (f.label) { const sp = label(f.label, { size: 20, weight: 600, bg: css('--panel'), color: css('--ink'), px: 12 }); sp.position.set(f.x0 + 8, f.y * Y + 3.5, f.z0 + 3); world.add(sp); }
    }
    for (const [name, pos] of st.tags || []) { const sp = label(name, { size: 20, weight: 600, bg: css('--panel'), color: css('--ink'), px: 12 }); sp.position.copy(V(pos)).add(new THREE.Vector3(0, 4, 0)); world.add(sp); }
    for (const [name, pos, dir] of st.ends || []) world.add(arrowLabel(name, V(pos), dir));

    // 승강장
    for (const key in st.platforms) {
      const p = st.platforms[key], a = V(p.a), b = V(p.b), len = a.distanceTo(b), alongX = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
      const mid = a.clone().add(b).multiplyScalar(0.5), pw = p.width || 6;
      const tracks = p.tracks || [p.track];
      const slab = box(alongX ? len : pw, 1.4, alongX ? pw : len, mat(platColor(p.line), 1), mid.x, mid.y - 0.7, mid.z);
      slab.receiveShadow = true; slab.castShadow = true; world.add(slab); world.add(outline(slab, edgeCol));
      const head = p.car1 === 'a' ? a : b, tail = p.car1 === 'a' ? b : a, dir = head.clone().sub(tail).normalize();
      const doors = p.doorsPerCar || DOORS_PER_CAR;
      for (const tr of tracks) {
        const sx = Math.sign(tr[0]), sz = Math.sign(tr[2]);
        const edgeOff = pw / 2 - 0.25;
        // 안전선 (노란 띠)
        world.add(box(alongX ? len : 0.5, 0.06, alongX ? 0.5 : len, mat(css('--safety'), 1), mid.x + sx * (edgeOff - 1.2), mid.y + 0.04, mid.z + sz * (edgeOff - 1.2)));
        // 스크린도어: 유리벽 + 문
        const wall = box(alongX ? len : 0.18, 2.2, alongX ? 0.18 : len, mat(css('--glass'), 0.28), mid.x + sx * edgeOff, mid.y + 1.1, mid.z + sz * edgeOff);
        world.add(wall);
        world.add(box(alongX ? len : 0.3, 0.25, alongX ? 0.3 : len, mat(lineColor(p.line), 1), mid.x + sx * edgeOff, mid.y + 2.3, mid.z + sz * edgeOff));
        for (let c = 1; c <= p.cars; c++) for (let d = 1; d <= doors; d++) {
          const q = this.Vp(doorPos(p, c, d));
          world.add(box(alongX ? 1.7 : 0.26, 2.1, alongX ? 0.26 : 1.7, mat(lineColor(p.line), 0.55), q.x + sx * edgeOff, q.y + 1.05, q.z + sz * edgeOff));
          world.add(box(alongX ? 1.7 : 0.6, 0.08, alongX ? 0.6 : 1.7, mat(css('--ink'), 0.8), q.x + sx * (edgeOff - 0.6), q.y + 0.05, q.z + sz * (edgeOff - 0.6)));
        }
        // 선로: 자갈 바닥 + 레일 2줄
        const tl = len + 60, tm = mid.clone().add(V(tr));
        const bed = box(alongX ? tl : 4.2, 0.5, alongX ? 4.2 : tl, mat(css('--track'), 1), tm.x, tm.y - 1.7, tm.z); bed.receiveShadow = true; world.add(bed);
        for (const s of [-0.75, 0.75]) world.add(box(alongX ? tl : 0.18, 0.18, alongX ? 0.18 : tl, mat(css('--rail'), 1), tm.x + (alongX ? 0 : s), tm.y - 1.4, tm.z + (alongX ? s : 0)));
        const n = Math.floor(tl / 26);
        for (let i = 0; i < n; i++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4.2, 4), mat(lineColor(p.line), 1));
          cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); cone.scale.z = 0.3;
          world.add(cone); this.arrows.push({ m: cone, base: tm.clone().sub(dir.clone().multiplyScalar(tl / 2)), dir, len: tl, off: i * 26, y: tm.y - 1.0 });
        }
      }
      const tr0 = tracks[0];
      const lb = label(p.label, { size: 20, bg: lineColor(p.line), color: '#fff', round: true, px: 12 });
      lb.position.copy(mid).sub(V(tr0).multiplyScalar(1.6)).add(new THREE.Vector3(0, 5, 0));
      lb.position.add(dir.clone().multiplyScalar(-len * 0.28)); world.add(lb);
      if (key === fromKey) {
        for (let c = 1; c <= p.cars; c++) {
          const q = this.Vp(doorPos(p, c, 2)).lerp(this.Vp(doorPos(p, c, 3)), 0.5).add(V(tr0));
          const car = box(alongX ? 19 : 3.0, 3.4, alongX ? 3.0 : 19, mat(lineColor(p.line), 0.4), q.x, q.y + 0.6, q.z);
          car.userData.car = c; car.name = 'car'; world.add(car); world.add(outline(car, lineColor(p.line)));
          const nl = label(String(c), { size: 20, weight: 700, color: css('--ink'), px: 11 }); nl.position.set(q.x, q.y + 6, q.z); world.add(nl);
        }
      }
    }
    // 계단 · 에스컬레이터 · 엘리베이터 · 통로
    for (const [ai, bi, t] of st.edges) {
      if (t === 'plat') continue;
      const a = V(st.nodes[ai].p), b = V(st.nodes[bi].p);
      if (t === 'walk' || t === 'gate') { const r = ramp(a.clone().setY(a.y - 0.3), b.clone().setY(b.y - 0.3), css('--walk'), 5); r.receiveShadow = true; world.add(r); }
      else if (t === 'esc') world.add(escalator(a, b, 3.4));
      else if (t === 'elevator') world.add(elevator(a, b));
      else world.add(stairs(a, b, t === 'mix' ? 4 : 3.6, t === 'mix'));
    }
    for (const id in st.nodes) {
      const n = st.nodes[id], v = V(n.p);
      if (n.type === 'gate') {
        const e = st.edges.find((e) => e[2] === 'gate' && (e[0] === id || e[1] === id));
        const o = e ? V(st.nodes[e[0] === id ? e[1] : e[0]].p).sub(v).normalize() : new THREE.Vector3(1, 0, 0);
        for (let i = -3; i <= 3; i++) { const g = box(0.8, 2.2, 2.0, mat(css('--gate'), 1), v.x - o.z * i * 2.1, v.y + 1.1, v.z + o.x * i * 2.1); g.rotation.y = Math.atan2(o.x, o.z); g.castShadow = true; world.add(g); }
        const lb = label('개찰구', { size: 18, bg: css('--gate'), color: '#fff', px: 11 }); lb.position.set(v.x, v.y + 8, v.z); world.add(lb);
      }
      if (n.type === 'exit') {
        const pad = box(9, 0.5, 9, mat(css('--slab'), 1), v.x, 0.1, v.z); pad.receiveShadow = true; world.add(pad); world.add(outline(pad, edgeCol));
        const roof = box(5.5, 0.6, 5.5, mat(css('--exit'), 1), v.x, 4.2, v.z); roof.castShadow = true; world.add(roof); world.add(outline(roof, css('--exit-ink')));
        for (const [dx, dz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) world.add(box(0.35, 4, 0.35, mat(css('--exit-ink'), 1), v.x + dx, 2, v.z + dz));
        const lb = label(String(n.no), { size: 32, weight: 700, bg: css('--exit'), color: css('--exit-ink'), round: true, px: 18 }); lb.position.set(v.x, 11, v.z); world.add(lb);
      }
    }
    // 방위 표시 (북쪽 화살표) 를 지면 모서리에
    const cx = ext.x1 + 30, cz = ext.z0 - 20;
    world.add(arrowLabel('북', new THREE.Vector3(cx, 0.5, cz), [0, 0, -1]));
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
    const lifted = pts.map((v) => v.clone().add(new THREE.Vector3(0, 1.6, 0)));
    this.curve = new THREE.CatmullRomCurve3(lifted, false, 'catmullrom', 0.04);
    this.routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(this.curve, Math.max(60, lifted.length * 24), 1.2, 10, false), new THREE.MeshBasicMaterial({ color: css('--route') })));
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 14), new THREE.MeshBasicMaterial({ color: css('--route') })); this.routeGroup.add(this.marker);
    this.pulse = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.5, 32), new THREE.MeshBasicMaterial({ color: css('--route'), side: THREE.DoubleSide, transparent: true }));
    this.pulse.rotation.x = -Math.PI / 2; this.pulse.position.copy(start).add(new THREE.Vector3(0, 0.4, 0)); this.routeGroup.add(this.pulse);
    const dl = label(`${r.c}-${r.d}`, { size: 30, weight: 700, bg: css('--route'), color: '#fff', round: true, px: 17 });
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

/* ---------- 범위 ---------- */
function extent(st) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const add = (x, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
  for (const id in st.nodes) add(st.nodes[id].p[0], st.nodes[id].p[2]);
  for (const k in st.platforms) { add(st.platforms[k].a[0], st.platforms[k].a[2]); add(st.platforms[k].b[0], st.platforms[k].b[2]); }
  for (const f of st.floors || []) { add(f.x0, f.z0); add(f.x1, f.z1); }
  if (!isFinite(x0)) return { x0: -50, x1: 50, z0: -50, z1: 50 };
  return { x0, x1, z0, z1 };
}

/* ---------- 도형 ---------- */
function mat(color, opacity) { return new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity: opacity ?? 1, depthWrite: !(opacity < 1) }); }
function box(w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; }
/** 덩어리 테두리 선 (안내도 느낌) */
function outline(mesh, color) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }));
  l.position.copy(mesh.position); l.rotation.copy(mesh.rotation); l.scale.copy(mesh.scale); return l;
}
export function label(text, opts = {}) {
  const s = opts.size || 26, pad = opts.bg ? 12 : 4, cv = document.createElement('canvas'), g = cv.getContext('2d');
  const font = `${opts.weight || 600} ${s * 2}px "IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + pad * 4, h = s * 2 + pad * 3; cv.width = w; cv.height = h;
  if (opts.bg) { g.fillStyle = opts.bg; const r = opts.round ? h / 2 : 12; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill(); }
  g.font = font; g.fillStyle = opts.color || css('--ink'); g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
  // 화면 크기 고정(sizeAttenuation:false): 확대해도 글자가 커지지 않는다. px = 화면에서의 글자 높이(대략)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  const sy = ((opts.px || 13) + pad * 0.9) / 640 * 0.62; sp.scale.set(sy * w / h, sy, 1); sp.renderOrder = 10; return sp;
}
function ramp(a, b, color, width, thick = 0.5) {
  const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.BoxGeometry(width, thick, len), mat(color, 1));
  m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); return m;
}
/** 계단: 디딤판 + 양옆 난간 */
function stairs(a, b, width, unsure) {
  const g = new THREE.Group(), h = new THREE.Vector3(b.x - a.x, 0, b.z - a.z), L = h.length(), n = Math.max(6, Math.min(34, Math.round(L / 1.3)));
  const yaw = Math.atan2(h.x, h.z), dy = (b.y - a.y) / n, m = mat(css(unsure ? '--mix' : '--stairs'), 1);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, s = box(width, Math.abs(dy) + 0.45, L / n + 0.05, m, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.abs(dy) / 2, a.z + (b.z - a.z) * t);
    s.rotation.y = yaw; s.castShadow = true; s.receiveShadow = true; g.add(s);
  }
  const hn = h.clone().normalize(), side = new THREE.Vector3(-hn.z, 0, hn.x);
  for (const sgn of [-1, 1]) {
    const off = side.clone().multiplyScalar(sgn * (width / 2 + 0.15)), up = new THREE.Vector3(0, 1.1, 0);
    const r = ramp(a.clone().add(off).add(up), b.clone().add(off).add(up), css('--ink'), 0.25, 0.25); g.add(r);
    for (const v of [a, b]) g.add(box(0.25, 1.1, 0.25, mat(css('--ink'), 1), v.x + off.x, v.y + 0.55, v.z + off.z));
  }
  return g;
}
/** 에스컬레이터: 두꺼운 경사판 + 가운데 디딤판 무늬 + 양옆 난간(손잡이) */
function escalator(a, b, width) {
  const g = new THREE.Group();
  const body = ramp(a, b, css('--escal'), width, 1.0); body.castShadow = true; body.receiveShadow = true; g.add(body); g.add(outline(body, css('--ink')));
  const L = a.distanceTo(b), n = Math.max(4, Math.round(L / 2.2));
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, q = a.clone().lerp(b, t); const s = box(width - 0.9, 0.12, 0.5, mat(css('--escal-step'), 1), q.x, q.y + 0.55, q.z); s.lookAt(b); g.add(s); }
  const hn = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize(), side = new THREE.Vector3(-hn.z, 0, hn.x);
  for (const sgn of [-1, 1]) {
    const off = side.clone().multiplyScalar(sgn * (width / 2 - 0.2));
    const bal = ramp(a.clone().add(off).add(new THREE.Vector3(0, 0.9, 0)), b.clone().add(off).add(new THREE.Vector3(0, 0.9, 0)), css('--glass'), 0.3, 1.3); bal.material.transparent = true; bal.material.opacity = 0.5; g.add(bal);
    g.add(ramp(a.clone().add(off).add(new THREE.Vector3(0, 1.65, 0)), b.clone().add(off).add(new THREE.Vector3(0, 1.65, 0)), css('--ink'), 0.34, 0.3));
  }
  return g;
}
function elevator(a, b) {
  const g = new THREE.Group(), lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
  const shaft = box(3.2, hi - lo + 3, 3.2, mat(css('--elev'), 0.3), a.x, (lo + hi) / 2 + 1.5, a.z); g.add(shaft); g.add(outline(shaft, css('--elev')));
  for (const v of [a, b]) { const d = box(3.4, 0.4, 3.4, mat(css('--elev'), 1), v.x, v.y + 0.2, v.z); d.castShadow = true; g.add(d); }
  const lb = label('EV', { size: 16, weight: 700, bg: css('--elev'), color: '#fff', round: true, px: 9 }); lb.position.set(a.x, hi + 5, a.z); g.add(lb);
  return g;
}
function arrowLabel(text, pos, dir) {
  const g = new THREE.Group(), lb = label(text, { size: 26, weight: 700, color: css('--ink'), px: 15 }); lb.position.copy(pos).add(new THREE.Vector3(0, 9, 0)); g.add(lb);
  const d = new THREE.Vector3(...dir), shaft = ramp(pos.clone(), pos.clone().add(d.clone().multiplyScalar(16)), css('--ink'), 1.6); g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(3.4, 8, 4), mat(css('--ink'), 1)); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); head.scale.z = 0.3;
  head.position.copy(pos).add(d.clone().multiplyScalar(20)); g.add(head); return g;
}
