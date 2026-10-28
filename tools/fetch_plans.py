"""서울교통공사 사이버스테이션 역 안내도 이미지를 내려받는다.

사용: python tools/fetch_plans.py 건대입구 면목
      python tools/fetch_plans.py --all        (stations-index.json 의 모든 역, 시간이 걸림)

저장: data/plans/<역코드>/station_<코드>.jpg (지상 포함 안내도), in_<코드>.jpg (내부 안내도)
      둘 중 있는 것만 저장된다. 이미지 저작권은 서울교통공사에 있으므로 저장소에는 올리지 않는다(.gitignore).
역코드는 data/stations-index.json (서울교통공사 /kr/getLineData.do 에서 추출) 에서 찾는다.
"""
import json, sys, os, urllib.request, time
if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://www.seoulmetro.co.kr/common/resources/cyber/fileView.jsp?fileName='
UA = {'User-Agent': 'Mozilla/5.0 (seoul-station-nav; personal research)'}

def fetch(name, cd):
    out = os.path.join(ROOT, 'data', 'plans', cd); os.makedirs(out, exist_ok=True)
    got = []
    for kind in ('station', 'in'):
        fn = f'{kind}_{cd}.jpg'; dst = os.path.join(out, fn)
        if os.path.exists(dst): got.append(fn); continue
        try:
            req = urllib.request.Request(BASE + fn, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            if data[:3] == b'\xff\xd8\xff' and len(data) > 20000:
                open(dst, 'wb').write(data); got.append(fn)
        except Exception as e:
            pass
        time.sleep(0.3)
    print(f'{name} ({cd}): {", ".join(got) or "없음"}')

def main(args):
    idx = json.load(open(os.path.join(ROOT, 'data', 'stations-index.json'), encoding='utf-8'))
    if args == ['--all']:
        todo = {(s['name'], s['cd']) for s in idx}
    else:
        todo = {(s['name'], s['cd']) for s in idx if s['name'] in args}
        missing = set(args) - {n for n, _ in todo}
        if missing: print('색인에 없는 역:', ', '.join(missing))
    for name, cd in sorted(todo): fetch(name, cd)

if __name__ == '__main__':
    main(sys.argv[1:])
