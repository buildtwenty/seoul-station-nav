"""면목역 JSON을 만든다 (A등급 · 공식 안내도 단면·입체도 + 나무위키 + 카카오맵).

사용: python tools/build_myeonmok.py
근거:
- 공식 안내도 in_2723.jpg 단면: B1 대합실(고객안전실·화장실·개찰구·1·2·3번 출구), B2 통과, B3 대합실, B4 승강장.
  승강장에서 B3로: 상봉 쪽 에스컬레이터(+계단), 가운데 엘리베이터, 사가정 쪽 계단. B3에서 B1로: 상봉 쪽 긴 에스컬레이터(+계단)와 엘리베이터.
  B1에서 지상: 1번 계단(상봉 쪽), 3번 에스컬레이터(가운데), 2번 에스컬레이터 2대(사가정 쪽), 엘리베이터(사가정 쪽)
  단면의 가로 위치는 승강장 양 끝(터널대피경로 표시)을 0~1로 놓고 비율로 읽음. 승강장 160 m(8량)
- 나무위키: 2면 2선 곡선 상대식 승강장, 지하 4층. 출구 1: 동원시장·면목초 방면, 2: 서일대·면목8동 방면, 3: 면목본동주민센터·면목공원 방면
- 카카오맵: 1번 출구는 면목로 서쪽·북쪽(상봉 쪽), 3번은 서쪽·역 가운데, 2번은 동쪽·남쪽(사가정 쪽)
좌표 m. z축이 면목로(상봉 북쪽 -80 ~ 사가정 남쪽 +80). 장암 방면(상봉 쪽으로 가는 열차) 승강장이 동쪽(x=+7), 석남 방면이 서쪽(x=-7)
"""
import json, os, sys
if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

N, E = {}, []
def n(id, p, label, type, no=None, est=0):
    d = {"p": p, "label": label, "type": type}
    if no is not None: d["no"] = no
    if est: d["est"] = 1
    N[id] = d
def e(a, b, t, est=0): E.append([a, b, t, est])

B1, B3, B4 = -6, -18, -24

# ---------- B4 승강장 (상대식) ----------
for side, x, nm in (('u', 7, '장암 방면'), ('d', -7, '석남 방면')):
    n(f'esA_{side}', [x, B4, -28], '상봉 쪽 에스컬레이터', 'stair', est=1)
    n(f'stA_{side}', [x, B4, -24], '상봉 쪽 계단', 'stair', est=1)
    n(f'ev4_{side}', [x, B4, -10], '엘리베이터 (승강장)', 'elevator', est=1)
    n(f'stB_{side}', [x, B4, 6], '사가정 쪽 계단', 'stair', est=1)
    # B3 층계참 (승강장 바로 위)
    n(f'lA_{side}', [x * 0.6, B3, -18], '지하 3층 대합실', 'landing', est=1)
    n(f'ev3_{side}', [x * 0.6, B3, -10], '엘리베이터 (지하 3층)', 'elevator', est=1)
    n(f'lB_{side}', [x * 0.6, B3, -4], '지하 3층 대합실', 'landing', est=1)
    e(f'esA_{side}', f'lA_{side}', 'esc'); e(f'stA_{side}', f'lA_{side}', 'stair', 1)
    e(f'ev4_{side}', f'ev3_{side}', 'elevator', 1)
    e(f'stB_{side}', f'lB_{side}', 'stair')
    e(f'esA_{side}', f'stA_{side}', 'plat'); e(f'stA_{side}', f'ev4_{side}', 'plat'); e(f'ev4_{side}', f'stB_{side}', 'plat')
    e(f'lA_{side}', f'ev3_{side}', 'walk', 1); e(f'ev3_{side}', f'lB_{side}', 'walk', 1)
e('lA_u', 'lA_d', 'walk'); e('lB_u', 'lB_d', 'walk'); e('ev3_u', 'ev3_d', 'walk', 1)

# ---------- B3 → B1 (상봉 쪽 긴 에스컬레이터 + 계단, 엘리베이터) ----------
n('esL3', [0, B3, -51], '지하 3층 대합실 · 긴 에스컬레이터 앞', 'landing')
n('esL1', [0, B1, -31], '지하 1층 대합실', 'landing')
n('stL3', [3, B3, -49], '지하 3층 대합실 · 긴 계단 앞', 'landing', est=1)
n('ev1', [0, B1, -10], '엘리베이터 (지하 1층)', 'elevator', est=1)
e('lA_u', 'esL3', 'walk'); e('lA_d', 'esL3', 'walk'); e('esL3', 'stL3', 'walk', 1)
e('esL3', 'esL1', 'esc'); e('stL3', 'esL1', 'stair', 1)
e('ev3_u', 'ev1', 'elevator', 1); e('ev3_d', 'ev1', 'elevator', 1)

# ---------- B1 대합실: 개찰구 2곳, 출구 3개, 지상 엘리베이터 ----------
n('g1', [0, B1, -44], '개찰구 (상봉 쪽)', 'gate', est=1); n('h1', [0, B1, -52], '1번 출구 앞', 'concourse', est=1)
n('x1', [-16, 0, -72], '1번 출구', 'exit', 1)
n('g2', [0, B1, -5], '개찰구 (사가정 쪽)', 'gate', est=1); n('h2', [0, B1, 0], '2·3번 출구 앞', 'concourse', est=1)
n('x3', [-16, 0, -12], '3번 출구', 'exit', 3)
n('h2b', [0, B1, 18], '2번 출구 앞', 'concourse', est=1)
n('x2', [16, 0, 30], '2번 출구', 'exit', 2)
n('evG1', [4, B1, 7], '엘리베이터 (지하 1층, 2번 출구 쪽)', 'elevator', est=1)
n('evG', [12, 0, 7], '엘리베이터 (지상, 2번 출구 옆)', 'elevator', est=1)
e('esL1', 'g1', 'walk'); e('g1', 'h1', 'gate'); e('h1', 'x1', 'stair')
e('esL1', 'ev1', 'walk', 1); e('ev1', 'g2', 'walk'); e('g2', 'h2', 'gate'); e('h2', 'x3', 'esc')
e('h2', 'h2b', 'walk'); e('h2b', 'x2', 'esc'); e('h2', 'evG1', 'walk', 1); e('evG1', 'evG', 'elevator', 1); e('evG', 'x2', 'walk', 1)

st = {
 "id": "myeonmok", "kind": "station", "name": "면목", "officialName": "면목",
 "codes": {"7호선": "2723"},
 "lede": "7호선 단일역. 승강장이 지하 4층이라 지상까지 세 번 올라갑니다. 상대식 승강장이라 반대편으로는 지하 3층 대합실에서 건넙니다.",
 "source": {
   "urls": ["https://www.seoulmetro.co.kr/common/resources/cyber/fileView.jsp?fileName=in_2723.jpg", "https://namu.wiki/w/면목역"],
   "plans": ["data/plans/2723/in_2723.jpg"],
   "checked": "2026-10-28",
   "note": "공식 안내도 단면·입체도에서 층 구성과 설비 순서를 읽고, 승강장 방향 위치는 단면의 비율로 잡음. 출구 방향은 카카오맵, 승강장 형태는 나무위키. 좌표는 tools/build_myeonmok.py 가 만든다"
 },
 "yScale": 2.4,
 "floors": [
   {"y": B1, "x0": -8, "x1": 8, "z0": -90, "z1": 24, "label": "7호선 대합실 · 지하 1층"},
   {"y": B3, "x0": -8, "x1": 8, "z0": -90, "z1": 24, "label": "7호선 대합실 · 지하 3층"}
 ],
 "tags": [["승강장 · 지하 4층", [-16, B4, 30]]],
 "ends": [["상봉 방면", [0, B4, -104], [0, 0, -1]], ["사가정 방면", [0, B4, 104], [0, 0, 1]]],
 "roads": [{"x0": -14, "x1": 14, "z0": -140, "z1": 140, "name": "면목로"}],
 "pillars": [],
 "platforms": {
   "p7u": {"line": 7, "label": "장암 방면", "short": "7호선 장암 방면", "a": [7, B4, -80], "b": [7, B4, 80], "car1": "a", "cars": 8, "track": [-4.5, 0, 0], "ends": ["상봉", "사가정"],
           "access": ["esA_u", "stA_u", "ev4_u", "stB_u"], "official": {"line": "7호선", "toward": ["장암"]}, "nextStation": "상봉"},
   "p7d": {"line": 7, "label": "석남 방면", "short": "7호선 석남 방면", "a": [-7, B4, -80], "b": [-7, B4, 80], "car1": "b", "cars": 8, "track": [4.5, 0, 0], "ends": ["상봉", "사가정"],
           "access": ["esA_d", "stA_d", "ev4_d", "stB_d"], "official": {"line": "7호선", "toward": ["온수(성공회대입구)", "석남", "온수"]}, "nextStation": "사가정"}
 },
 "nodes": N, "edges": E,
 "facts": {
   "ok": ["공식 안내도: 지하 1층 대합실(개찰구·출구), 지하 2층 통과, 지하 3층 대합실, 지하 4층 승강장",
          "승강장→지하 3층: 상봉 쪽 에스컬레이터와 계단, 가운데 엘리베이터, 사가정 쪽 계단. 지하 3층→지하 1층: 상봉 쪽 긴 에스컬레이터·계단과 엘리베이터",
          "출구: 1번은 지하 1층 상봉 쪽 끝에서 계단, 3번은 가운데에서 에스컬레이터, 2번은 사가정 쪽에서 에스컬레이터. 2번 출구 쪽에 지상 엘리베이터",
          "나무위키: 2면 2선 곡선 상대식 승강장. 카카오맵: 1·3번 출구는 면목로 서쪽, 2번은 동쪽. 1번이 북쪽(상봉 쪽), 2번이 남쪽(사가정 쪽)"],
   "est": ["설비의 승강장 방향 위치는 안내도 단면 비율로 읽은 값(한두 칸 오차). 공식 출구별 빠른하차 자료로 검증 전",
           "개찰구 위치(고객안전실 옆 상봉 쪽 1곳, 2·3번 출구 쪽 1곳으로 둠)",
           "상대식 승강장 양쪽에 설비가 똑같이 있다고 둠(안내도 단면은 양쪽을 겹쳐 그림)",
           "출구가 지상 어디까지 이어지는지(출구 구조물 위치는 지도 기준 대략)"]
 }
}
dst = os.path.join(ROOT, 'data', 'venues', 'myeonmok.json')
json.dump(st, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', dst, 'nodes', len(N), 'edges', len(E))
