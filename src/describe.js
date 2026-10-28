// 경로 → 한국어 단계 안내
import { HOW_KO } from './schema.js';
import { doorPos, nodePos, dist, vec } from './route.js';

function josa(word, a, b) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return a;
  const j = (c - 0xac00) % 28;
  return j === 0 || j === 8 ? a : b;
}

/** 반환: [{text, tag?, q?}] */
export function describe(st, fromKey, r) {
  const p = st.platforms[fromKey], out = [];
  const platOf = (...ids) => Object.values(st.platforms).find((q) => ids.every((i) => q.access.includes(i)));
  out.push({ text: `${p.short} 열차의 ${r.c}번째 칸 ${r.d}번 문에서 내립니다.` });
  let prev = doorPos(p, r.c, r.d), prevId = null, first = false, walked = false;
  r.path.forEach((s, i) => {
    const node = st.nodes[s.id], v = nodePos(st, s.id), name = node.label, dy = v.y - prev.y;
    if (s.t === 'plat') {
      if (r.path[i + 1] && r.path[i + 1].t === 'plat') { if (i === 0) first = true; prevId = s.id; return; }
      const q = (i === 0 || (first && !walked)) ? p : platOf(prevId, s.id), d = dist(prev, v);
      const toward = q ? (dist(v, vec(q.a)) < dist(prev, vec(q.a)) ? q.ends[0] : q.ends[1]) : '';
      if (i === 0 || (first && !walked)) {
        walked = true;
        out.push({ text: d < 4 ? `내리면 바로 앞이 ${name}입니다.` : `승강장에서 ${toward} 쪽으로 걸어 ${name} 앞까지 갑니다.` });
      } else out.push({ text: `승강장을 따라 ${toward} 쪽으로 걸어 ${name} 앞까지 갑니다.` });
    } else if (s.t === 'gate') {
      const g = st.nodes[prevId].label;
      out.push({ text: `${g}${josa(g, '를', '을')} 통과합니다.`, q: s.e });
    } else if (s.t === 'walk') {
      if (prevId && st.nodes[prevId].label === name) { prev = v; prevId = s.id; return; }
      out.push({ text: `${name}까지 걸어갑니다.`, q: s.e });
    } else {
      const arr = platOf(s.id), where = arr ? `${arr.short} 승강장` : name;
      out.push({ text: `${HOW_KO[s.t]} ${dy > 0 ? '올라가면' : '내려가면'} ${where}입니다.`, tag: s.t, q: s.e });
    }
    prev = v; prevId = s.id;
  });
  return out.filter((s, i) => i === 0 || s.text !== out[i - 1].text);
}
