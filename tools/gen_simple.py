"""단일 노선 지하역을 파라미터 몇 개로 자동 생성한다.

사용: python tools/gen_simple.py data/params/myeonmok.json
출력: data/venues/<id>.json

파라미터는 공식 역 안내도의 단면도(위쪽 띠)를 보고 적는다.
위치 at 은 승강장 a끝(0) → b끝(1) 사이 비율. 모든 위치는 est=1 로 표시된다.
"""
import json, sys, os
if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")

def main(path):
    P = json.load(open(path, encoding='utf-8'))
    cars, carlen = P.get('cars', 8), P.get('carLength', 20)
    L = cars * carlen
    lv = P['levels']                       # {"platform":-24,"lower":-18,"upper":-6}
    yP, yL, yU = lv['platform'], lv.get('lower'), lv['upper']
    axis = P.get('axis', 'z')              # 승강장이 놓인 축
    half = L / 2
    def pt(at, y, side=0.0):
        s = -half + at * L
        return [side, y, s] if axis == 'z' else [s, y, side]
    def zof(at): return -half + at * L

    nodes, edges = {}, []
    ends = P['ends']                       # {"a":{"name":"상봉","dir":-1},"b":{...}}
    island = P.get('layout', 'island') == 'island'
    pw = P.get('platformWidth', 10 if island else 6)

    # 승강장
    platforms = {}
    for q in P['platforms']:
        side = q['trackSide'] * (pw / 2 + 2.5)
        off = 0 if island else q['trackSide'] * (pw / 2 + 4)   # 상대식이면 승강장 자체가 양쪽으로 갈라짐
        platforms[q['key']] = {
            'line': P['line'], 'label': q['label'], 'short': f"{P['lineLabel']} {q['label']}",
            'a': pt(0, yP, off), 'b': pt(1, yP, off), 'car1': q['car1'], 'cars': cars, 'width': pw,
            'track': [side - off, 0, 0] if axis == 'z' else [0, 0, side - off],
            'ends': [ends['a']['name'], ends['b']['name']], 'access': [],
            'official': {'line': P['lineLabel'], 'toward': q.get('toward', [])},
        }
        if 'nextStation' in q: platforms[q['key']]['nextStation'] = q['nextStation']

    # 승강장 → 아래 대합실(lower) 접근
    lowerChain = []
    for i, a in enumerate(P['platformAccess']):
        pid, lid = f"pa_{a['id']}", f"lo_{a['id']}"
        kind = {'stair': '계단', 'esc': '에스컬레이터', 'elevator': '엘리베이터', 'mix': '계단'}[a['type']]
        where = f"{ends['a']['name'] if a['at'] < 0.5 else ends['b']['name']} 쪽"
        lowerName = P.get('lowerLabel', '대합실') if yL is not None else P.get('upperLabel', '대합실')
        for q in P['platforms']:
            off = 0 if island else q['trackSide'] * (pw / 2 + 4)
            nid = pid if island else f"{pid}_{q['key']}"
            nodes[nid] = {'p': pt(a['at'], yP, off), 'label': f"{where} {kind}", 'type': 'stair' if a['type'] != 'elevator' else 'elevator', 'est': 1}
            platforms[q['key']]['access'].append(nid)
            nodes[lid] = {'p': pt(a['at'], yL if yL is not None else yU), 'label': lowerName, 'type': 'landing', 'est': 1}
            edges.append([nid, lid, a['type'], 1])
        lowerChain.append((a['at'], lid))
    for q in platforms.values():
        acc = q['access']
        for i in range(len(acc) - 1): edges.append([acc[i], acc[i + 1], 'plat', 0])

    # lower → upper
    upperChain = []
    if yL is not None:
        for c in P.get('lowerToUpper', []):
            lid, uid = f"lu_{c['id']}", f"up_{c['id']}"
            kind = {'stair': '계단', 'esc': '에스컬레이터', 'elevator': '엘리베이터', 'mix': '계단'}[c['type']]
            nodes[lid] = {'p': pt(c['at'], yL), 'label': f"{P.get('lowerLabel', '대합실')} {kind} 앞", 'type': 'landing', 'est': 1}
            nodes[uid] = {'p': pt(c['at'], yU), 'label': P.get('upperLabel', '대합실'), 'type': 'landing', 'est': 1}
            edges.append([lid, uid, c['type'], 1])
            lowerChain.append((c['at'], lid)); upperChain.append((c['at'], uid))
    else:
        upperChain = lowerChain; lowerChain = []
    paidCenter = sum(a for a, _ in upperChain) / max(1, len(upperChain))

    # 개찰구
    for i, g in enumerate(P.get('gates', [])):
        gid = f"gate{i + 1}"
        nodes[gid] = {'p': pt(g['at'], yU), 'label': g.get('label', '개찰구'), 'type': 'gate', 'est': 1}
        upperChain.append((g['at'], gid))

    # 출구
    for x in P['exits']:
        hid, xid = f"h{x['no']}", f"x{x['no']}"
        nodes[hid] = {'p': pt(x['at'], yU), 'label': f"{x['no']}번 출구 앞", 'type': 'concourse', 'est': 1}
        nodes[xid] = {'p': pt(x['at'], 0, x.get('side', 1) * 18), 'label': f"{x['no']}번 출구", 'type': 'exit', 'no': x['no'], 'est': 1}
        edges.append([hid, xid, x.get('type', 'mix'), 1])
        upperChain.append((x['at'], hid))

    # 지상으로 가는 엘리베이터 (교통약자 경로). 가까운 출구 지점과 지상에서 걸어서 이어진다
    for i, ge in enumerate(P.get('groundElevators', [])):
        uid, gid = f"gev{i + 1}_u", f"gev{i + 1}"
        nodes[uid] = {'p': pt(ge['at'], yU), 'label': '엘리베이터 (대합실)', 'type': 'elevator', 'est': 1}
        nodes[gid] = {'p': pt(ge['at'], 0, ge.get('side', 1) * 10), 'label': f"엘리베이터 (지상, {ge['near']}번 출구 옆)", 'type': 'elevator', 'est': 1}
        edges.append([uid, gid, 'elevator', 1])
        edges.append([gid, f"x{ge['near']}", 'walk', 1])
        upperChain.append((ge['at'], uid))

    # 대합실 안 연결(같은 층 노드를 승강장 방향 순서로 잇는다)
    def chain(items):
        items = sorted(items)
        for (a1, n1), (a2, n2) in zip(items, items[1:]):
            if n1 == n2: continue
            t = 'walk'
            if nodes[n1]['type'] == 'gate' and abs(a2 - paidCenter) > abs(a1 - paidCenter): t = 'gate'
            if nodes[n2]['type'] == 'gate' and abs(a1 - paidCenter) > abs(a2 - paidCenter): t = 'gate'
            edges.append([n1, n2, t, 1])
    chain(lowerChain); chain(upperChain)

    # 층판·도로·방면
    def floorBox(y, a0, a1, label, w=14):
        z0, z1 = zof(a0), zof(a1)
        return {'y': y, 'x0': -w / 2, 'x1': w / 2, 'z0': z0, 'z1': z1, 'label': label} if axis == 'z' else {'y': y, 'x0': z0, 'x1': z1, 'z0': -w / 2, 'z1': w / 2, 'label': label}
    floors = []
    if yL is not None: floors.append(floorBox(yL, *P.get('lowerExtent', [0.1, 0.7]), P.get('lowerLabel', '대합실 (아래)')))
    floors.append(floorBox(yU, *P.get('upperExtent', [0.0, 0.75]), P.get('upperLabel', '대합실')))
    road = {'x0': -14, 'x1': 14, 'z0': -half - 50, 'z1': half + 50} if axis == 'z' else {'x0': -half - 50, 'x1': half + 50, 'z0': -14, 'z1': 14}
    endTags = [[f"{ends['a']['name']} 방면", pt(-0.15, yP), [0, 0, -1] if axis == 'z' else [-1, 0, 0]],
               [f"{ends['b']['name']} 방면", pt(1.15, yP), [0, 0, 1] if axis == 'z' else [1, 0, 0]]]

    out = {
        'id': P['id'], 'kind': 'station', 'name': P['name'], 'officialName': P.get('officialName', P['name']),
        'codes': P.get('codes', {}), 'generated': True, 'params': os.path.relpath(path).replace('\\', '/'),
        'lede': P.get('lede', f"{P['lineLabel']} 단일역. 공식 안내도의 단면을 보고 파라미터로 자동 생성한 모형입니다."),
        'source': P.get('source', {}), 'yScale': 2.4,
        'floors': floors, 'tags': [[f"승강장 ({P.get('platformLabel', '지하')})", pt(0.5, yP, pw)]], 'ends': endTags, 'roads': [road], 'pillars': [],
        'platforms': platforms, 'nodes': nodes, 'edges': edges,
        'facts': P.get('facts', {'ok': [], 'est': ['계단·개찰구·출구 위치 전부(단면도 비율로 어림)', '층 사이 높이']}),
    }
    dst = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'venues', f"{P['id']}.json")
    json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"wrote {dst}: nodes {len(nodes)}, edges {len(edges)}")

if __name__ == '__main__':
    for p in sys.argv[1:]: main(p)
