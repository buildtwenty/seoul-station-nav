# 역 하나 추가하는 순서

## 0. 등급 정하기

| 등급 | 대상 | 방법 |
|---|---|---|
| A | 환승역 (복잡한 동선) | 편집기(editor.html)로 안내도 위에서 좌표를 찍는다 |
| C | 단일 노선 역 | `data/params/<id>.json` 파라미터 → `tools/gen_simple.py` 자동 생성 |

## 1. 안내도 받기

```bash
python tools/fetch_plans.py 건대입구 면목
```

`data/plans/<역코드>/`에 `station_<코드>.jpg`(지상 포함 안내도)와 `in_<코드>.jpg`(내부 안내도)가 생긴다.
역코드는 `data/stations-index.json`에 있다. 이미지는 저작권 때문에 커밋하지 않는다.

안내도 위쪽 띠가 **단면도**다. 층 구성과 계단·엘리베이터·출구가 승강장 길이의 어디쯤인지 여기서 읽는다.
아래 입체 그림은 승강장 양쪽(동/서) 구분과 환승통로 모양을 읽는 데 쓴다.

## 2-C. 단일 노선 역: 파라미터로 만들기

`data/params/myeonmok.json`을 복사해서 고친다.

- `levels`: 층 높이. 승강장 `platform`, 그 위 대합실 `lower`(없으면 생략), 개찰구가 있는 대합실 `upper`. 모르면 층당 6 m
- `platformAccess`: 승강장에서 올라가는 계단·에스컬레이터·엘리베이터. `at`은 승강장 a끝(0)→b끝(1) 비율
- `lowerToUpper`: 아래 대합실 → 위 대합실 연결
- `gates`: 개찰구 위치. 유료 구역(계단이 올라오는 곳) 양쪽에 하나씩
- `exits`: 출구 번호·위치·동서 방향(`side` ±1)·종류
- `platforms[].car1`: 1번 칸이 a끝인지 b끝인지. 열차 진행 방향 앞쪽이 1번 칸
- `platforms[].toward`: 공식 빠른환승 자료의 "종착역명"과 맞추기 위한 이름 목록

```bash
python tools/gen_simple.py data/params/myeonmok.json
python tools/validate.py data/venues/myeonmok.json
```

## 2-A. 환승역: 편집기로 좌표 찍기

`editor.html`을 연다 (로컬 서버 필요: `python -m http.server`).

1. 안내도 이미지 열기
2. **축척**: 아는 길이의 두 점 클릭 → m 입력 (승강장 길이 = 칸 수 × 20 m 가 가장 믿을 만함)
3. **원점** 클릭
4. 모드 선택: 단면도 위에서 찍으면 "단면(옆)", 평면 성격 그림이면 "평면(위)"
5. 층 높이 입력 → 노드 찍기 (종류·이름) → 노드 두 개 이어 연결 (종류·추정 여부)
6. 내보내기 → `data/venues/<id>.json`에 저장. 기존 JSON을 불러와 이어서 고칠 수 있다

## 3. 등록·검사

`data/index.json`에 한 줄 추가. 그리고

```bash
python tools/validate.py
```

- "도달 불가"가 있으면 연결이 끊긴 것
- "공식 불일치"가 있으면 모형 좌표가 틀린 것. 계단 위치를 공식 칸 번호에 맞게 옮긴다

## 좌표 규칙

- 단위 m. x 동(+)/서(-), y 높이, z 남(+)/북(-)
- `yScale`은 그릴 때만 높이에 곱한다. 거리 계산은 실제 높이
- 승강장 `a`, `b`는 양 끝. `track`은 승강장 중심에서 선로까지의 벡터(섬식은 양쪽 승강장 키가 같은 a·b를 쓰고 track 부호만 반대)
- 노드 `type`: `stair`(승강장 계단 입구) · `landing` · `concourse` · `gate` · `exit`(`no` 필수) · `elevator`
- 연결 `type`: `walk` · `plat`(승강장 위) · `stair` · `esc` · `elevator` · `mix` · `gate`. 네 번째 값 1이면 추정
