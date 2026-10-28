# 역 안 길찾기 모형 (seoul-station-nav)

지하철역 **안**을 층별로 쌓은 3D 모형 위에서 "어느 문에서 내려서 어떤 계단으로 가야 빠른지"를 보여준다.
노선도는 역과 역 사이만 보여주지만, 이 모형은 승강장 → 계단 → 환승통로 → 개찰구 → 출구가 실제 높이 관계로 어떻게 이어지는지 보여준다.

빌드 없는 정적 사이트. GitHub Pages: https://buildtwenty.github.io/seoul-station-nav/

## 쓰는 법

1. 역을 고른다
2. "내린 열차"(승강장·방향)와 "가는 곳"(출구 또는 갈아탈 노선)을 고른다
3. 가장 가까운 **칸-문 번호**와 단계별 안내가 나오고, 모형 위에 분홍 경로가 그려진다
4. "계단 없이"를 켜면 엘리베이터·평지만 쓰는 경로를 찾는다

## 정답은 어디서 오나

- **환승 칸·문 번호**: 국토교통부 「철도역 빠른 환승 정보」(공공데이터포털 15151816, 전국 1052건)를 `data/official/`에 두고, 모형 계산값과 비교해 일치/불일치를 표시한다. 공식값이 정답이고 모형은 "왜 그 칸인지"를 보여주는 설명 장치다.
- **출구별 빠른하차**: 서울교통공사 빠른하차정보 API(공공데이터포털 15143840)가 있으나 인증키가 필요해 아직 안 붙였다. 지금은 모형 계산값이며 "현장 확인 필요"로 표시된다.
- **역 구조**: 서울교통공사 사이버스테이션 역 안내도(`tools/fetch_plans.py`로 받음). 안내도 위쪽 단면도에서 층 구성과 계단 위치를 읽는다.

## 역 등급

| 등급 | 뜻 | 지금 |
|---|---|---|
| A | 환승역. 안내도와 공식 환승값으로 좌표를 잡은 모형 | 건대입구 (공식 환승값 8개 모두 일치, `tools/build_konkuk.py`) |
| C | 단일 노선 역. 단면도에서 읽은 파라미터로 자동 생성 | 면목 |

역을 추가하는 순서는 [docs/authoring.md](docs/authoring.md).

## 구조

```
index.html          뷰어
editor.html         안내도 위에서 좌표를 찍는 편집기
src/                route(다익스트라) · render(three.js) · describe(안내 문장) · camera · main
data/index.json     역 목록
data/venues/        역별 JSON (좌표·연결·확인/추정)
data/params/        자동 생성 역의 파라미터
data/official/      공식 빠른환승 CSV·JSON
data/stations-index.json   서울교통공사 역 코드 색인 (512역)
data/plans/         안내도 이미지 (git 제외)
tools/              gen_simple.py · validate.py · fetch_plans.py
```

## 로컬에서 열기

`file://`로 열면 JSON을 못 읽는다.

```bash
python -m http.server 8765
```

후 http://localhost:8765/

## 검사

```bash
python tools/gen_simple.py data/params/*.json
python tools/validate.py
```

연결 끊김, 층을 걸어서 넘는 오류, 도달 불가, 공식 빠른환승 값과의 불일치를 찾아낸다. Pages 배포 전에 Actions에서도 돈다.

## 출처

- 국토교통부 철도역 빠른 환승 정보 (이용허락범위 제한 없음)
- 서울교통공사 사이버스테이션 역 안내도 (이미지 저작권 서울교통공사, 저장소에 포함하지 않음)
