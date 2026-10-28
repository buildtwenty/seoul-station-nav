// 공통 상수. 역 JSON의 뜻은 docs/authoring.md 참고.

// 연결 종류별 비용 가중치 (거리 × 가중치 + 고정값)
export const COST = {
  walk: { w: 1.0, fixed: 0 },
  plat: { w: 1.0, fixed: 0 },      // 승강장 위를 걷기
  esc: { w: 1.1, fixed: 0 },
  elevator: { w: 1.3, fixed: 20 },  // 대기 시간을 거리로 환산
  mix: { w: 1.4, fixed: 0 },       // 계단인지 에스컬레이터인지 미확인
  stair: { w: 1.6, fixed: 0 },
  gate: { w: 1.0, fixed: 6 },
};

// 층을 넘을 수 있는 연결 종류
export const VERTICAL = new Set(['stair', 'esc', 'elevator', 'mix']);

export const TYPE_KO = {
  esc: '에스컬레이터',
  stair: '계단',
  mix: '계단·에스컬레이터 미확인',
  elevator: '엘리베이터',
};

export const HOW_KO = {
  esc: '에스컬레이터로',
  stair: '계단으로',
  mix: '계단 또는 에스컬레이터로',
  elevator: '엘리베이터로',
};

export const DOORS_PER_CAR = 4;
export const DEFAULT_Y_SCALE = 2.4;
