// 경로 계산. three.js에 의존하지 않아서 node 검사 스크립트에서도 쓴다.
import { COST, DOORS_PER_CAR } from './schema.js';

export const vec = (a) => ({ x: a[0], y: a[1], z: a[2] });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const lerp = (a, b, s) => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, z: a.z + (b.z - a.z) * s });

/** 승강장 p의 c번째 칸 d번째 문 위치 (실제 높이, 과장 없음) */
export function doorPos(p, c, d) {
  const doors = p.doorsPerCar || DOORS_PER_CAR;
  let s = ((c - 1) + (d - 0.5) / doors) / p.cars;
  if (p.car1 === 'b') s = 1 - s;
  return lerp(vec(p.a), vec(p.b), s);
}

export function nodePos(st, id) {
  return vec(st.nodes[id].p);
}

function buildAdj(st, opts) {
  const adj = {};
  const add = (a, b, t, e) => { (adj[a] = adj[a] || []).push({ to: b, t, e }); };
  for (const [a, b, t, e] of st.edges) {
    if (opts.noStairs && (t === 'stair' || t === 'esc' || t === 'mix')) continue;
    add(a, b, t, e || 0); add(b, a, t, e || 0);
  }
  return adj;
}

/**
 * 출발 좌표 startPos에서 startAccess(승강장 접근 지점들)를 거쳐 targets 중 하나까지 최단 경로.
 * 반환: { cost, path: [{id, t, e}] } 또는 null
 */
export function shortest(st, startPos, startAccess, targets, opts = {}) {
  const adj = opts._adj || buildAdj(st, opts);
  const pos = (id) => (id === '@' ? startPos : nodePos(st, id));
  adj['@'] = startAccess.map((id) => ({ to: id, t: 'plat', e: 0 }));
  const d = { '@': 0 }, prev = {}, done = new Set();
  for (;;) {
    let u = null, best = Infinity;
    for (const k in d) if (!done.has(k) && d[k] < best) { best = d[k]; u = k; }
    if (u === null) return null;
    done.add(u);
    if (targets.includes(u)) return { cost: best, path: trace(u) };
    for (const e of adj[u] || []) {
      const c = COST[e.t] || COST.walk;
      const w = dist(pos(u), pos(e.to)) * c.w + c.fixed;
      if (d[e.to] === undefined || best + w < d[e.to]) { d[e.to] = best + w; prev[e.to] = { from: u, t: e.t, e: e.e }; }
    }
  }
  function trace(u) {
    const out = [];
    while (u !== '@') { out.unshift({ id: u, t: prev[u].t, e: prev[u].e }); u = prev[u].from; }
    return out;
  }
}

/** 목적지 키(출구 노드 id 또는 승강장 키)를 노드 id 목록으로 */
export function targetsOf(st, toKey) {
  return st.platforms[toKey] ? st.platforms[toKey].access : [toKey];
}

/** 모든 문을 시도해서 가장 싼 문과 경로. 반환에 c(칸), d(문) 포함 */
export function bestRoute(st, fromKey, toKey, opts = {}) {
  const p = st.platforms[fromKey];
  const targets = targetsOf(st, toKey);
  const doors = p.doorsPerCar || DOORS_PER_CAR;
  const adj = buildAdj(st, opts);
  let best = null;
  for (let c = 1; c <= p.cars; c++) {
    for (let d = 1; d <= doors; d++) {
      const r = shortest(st, doorPos(p, c, d), p.access, targets, { ...opts, _adj: { ...adj } });
      if (r && (!best || r.cost < best.cost - 0.01)) best = { ...r, c, d };
    }
  }
  return best;
}

/** 공식 빠른환승 값 찾기. official = data/official/fast_transfer.json 의 stations[역명] */
export function officialDoor(st, official, fromKey, toKey) {
  const from = st.platforms[fromKey], to = st.platforms[toKey];
  if (!from || !to || !from.official || !official) return null;
  const rows = official[st.officialName || st.name] || [];
  const norm = (s) => (s || '').replace(/\(.*$/, '').trim();
  const hit = rows.find((r) =>
    r.line === from.official.line &&
    from.official.toward.some((t) => norm(t) === norm(r.toward)) &&
    (!to.nextStation || norm(r.xferNext) === norm(to.nextStation)) &&
    r.car && r.door);
  return hit ? { car: hit.car, door: hit.door, text: `${hit.car}-${hit.door}`, row: hit } : null;
}
