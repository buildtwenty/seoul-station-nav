"""역 JSON 검사.

사용: python tools/validate.py data/venues/*.json
      python tools/validate.py            (data/index.json 에 있는 모든 역)

검사 항목
- 연결에 적힌 노드 id가 모두 존재하는가
- 승강장 접근 지점(access)이 노드에 있는가
- 층을 넘는 연결이 stair/esc/elevator/mix 인가
- 모든 승강장에서 모든 출구·다른 노선 승강장에 도달 가능한가
- 공식 빠른환승 값(data/official/fast_transfer.json)과 모형 계산값 비교
- est 비율
종료 코드: 오류가 있으면 1
"""
import json, sys, os, glob, math, heapq
if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COST = {'walk': (1.0, 0), 'plat': (1.0, 0), 'esc': (1.1, 0), 'elevator': (1.3, 20), 'mix': (1.4, 0), 'stair': (1.6, 0), 'gate': (1.0, 6)}
VERTICAL = {'stair', 'esc', 'elevator', 'mix'}

def dist(a, b): return math.dist(a, b)
def lerp(a, b, s): return [a[i] + (b[i] - a[i]) * s for i in range(3)]
def door_pos(p, c, d):
    doors = p.get('doorsPerCar', 4)
    s = ((c - 1) + (d - 0.5) / doors) / p['cars']
    if p['car1'] == 'b': s = 1 - s
    return lerp(p['a'], p['b'], s)

def shortest(st, start, access, targets):
    adj = {}
    for a, b, t, *e in st['edges']:
        adj.setdefault(a, []).append((b, t)); adj.setdefault(b, []).append((a, t))
    adj['@'] = [(i, 'plat') for i in access]
    pos = lambda i: start if i == '@' else st['nodes'][i]['p']
    d = {'@': 0}; pq = [(0, '@')]; prev = {}
    while pq:
        c, u = heapq.heappop(pq)
        if c > d.get(u, math.inf): continue
        if u in targets:
            path = []; x = u
            while x != '@': path.append(x); x = prev[x]
            return c, path[::-1]
        for v, t in adj.get(u, []):
            w, f = COST.get(t, (1, 0)); nc = c + dist(pos(u), pos(v)) * w + f
            if nc < d.get(v, math.inf): d[v] = nc; prev[v] = u; heapq.heappush(pq, (nc, v))
    return None

def best_route(st, fk, tk):
    p = st['platforms'][fk]
    targets = set(st['platforms'][tk]['access']) if tk in st['platforms'] else {tk}
    best = None
    for c in range(1, p['cars'] + 1):
        for d in range(1, p.get('doorsPerCar', 4) + 1):
            r = shortest(st, door_pos(p, c, d), p['access'], targets)
            if r and (best is None or r[0] < best[0] - 0.01): best = (r[0], c, d, r[1])
    return best

def norm(s): return (s or '').split('(')[0].strip()

def official_door(st, official, fk, tk):
    f, t = st['platforms'][fk], st['platforms'].get(tk)
    if not t or 'official' not in f: return None
    for r in official.get(st.get('officialName', st['name']), []):
        if r['line'] != f['official']['line']: continue
        if not any(norm(x) == norm(r['toward']) for x in f['official']['toward']): continue
        if t.get('nextStation') and norm(r['xferNext']) != norm(t['nextStation']): continue
        if r['car'] and r['door']: return (r['car'], r['door'])
    return None

def check(path, official):
    st = json.load(open(path, encoding='utf-8'))
    errs, warns = [], []
    nodes, edges = st['nodes'], st['edges']
    for a, b, t, *e in edges:
        for i in (a, b):
            if i not in nodes: errs.append(f"연결 {a}-{b}: 노드 '{i}' 없음")
        if a in nodes and b in nodes:
            dy = abs(nodes[a]['p'][1] - nodes[b]['p'][1])
            if dy > 0.5 and t not in VERTICAL: errs.append(f"연결 {a}-{b}: 높이 차 {dy:.1f} m 인데 종류가 '{t}'")
            if dy <= 0.5 and t in VERTICAL and t != 'elevator': warns.append(f"연결 {a}-{b}: 같은 높이인데 종류가 '{t}'")
    for k, p in st['platforms'].items():
        for i in p['access']:
            if i not in nodes: errs.append(f"승강장 {k}: 접근 지점 '{i}' 없음")
    exits = [i for i, n in nodes.items() if n.get('type') == 'exit']
    if not exits: errs.append('출구 노드가 없음')
    results = []
    for fk, p in st['platforms'].items():
        targets = exits + [k for k, q in st['platforms'].items() if q['line'] != p['line']]
        for tk in targets:
            r = best_route(st, fk, tk)
            label = nodes[tk]['label'] if tk in nodes else st['platforms'][tk]['short']
            if not r: errs.append(f"{p['short']} → {label}: 도달 불가"); continue
            off = official_door(st, official, fk, tk)
            tag = ''
            if off:
                tag = '  공식 일치' if (r[1], r[2]) == off else f"  공식 불일치(공식 {off[0]}-{off[1]})"
                if (r[1], r[2]) != off: warns.append(f"{p['short']} → {label}: 모형 {r[1]}-{r[2]} vs 공식 {off[0]}-{off[1]}")
            results.append(f"  {p['short']} → {label}: {r[1]}-{r[2]}{tag}")
    est_n = sum(1 for n in nodes.values() if n.get('est')) + sum(1 for e in edges if len(e) > 3 and e[3])
    tot = len(nodes) + len(edges)
    print(f"== {st['name']} ({os.path.relpath(path, ROOT)}): 노드 {len(nodes)} 연결 {len(edges)} 추정 {est_n}/{tot} ({100 * est_n // max(1, tot)}%)")
    for r in results: print(r)
    for w in warns: print('  주의:', w)
    for e in errs: print('  오류:', e)
    return not errs, {'id': st['id'], 'nodes': len(nodes), 'edges': len(edges), 'estRatio': round(est_n / max(1, tot), 2)}

def main(args):
    official = {}
    op = os.path.join(ROOT, 'data', 'official', 'fast_transfer.json')
    if os.path.exists(op): official = json.load(open(op, encoding='utf-8'))['stations']
    if not args:
        idx = json.load(open(os.path.join(ROOT, 'data', 'index.json'), encoding='utf-8'))
        args = [os.path.join(ROOT, v['file']) for v in idx]
    files = [f for a in args for f in (glob.glob(a) or [a])]
    ok = True
    for f in files:
        good, _ = check(f, official); ok = ok and good
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main(sys.argv[1:])
