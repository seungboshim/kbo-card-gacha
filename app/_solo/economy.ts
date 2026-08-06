// 혼자서 모드의 숫자. 전부 여기 모아서 플레이해보고 조이기 쉽게 둔다.
//
// 이 판(강화를 위험 없는 노동에서 도박으로 바꾼 개편, "B안")의 근거와 200만 판
// 시뮬레이션은 docs/economy/2026-08-rebalance-24x.md 에 있다. 채택하지 않은 A안
// (42.30배·기본가 유지)은 docs/economy/2026-08-rebalance.md 다. 두 안 다 읽을 값이
// 있지만 수치는 24x 안(B안)만 따른다.
//
// 개요와 화면 설계는 docs/superpowers/specs/2026-08-05-solo-mode-design.md 의
// "경제 수치" 절에도 있다.

import { TIERS, type Rates, type TierKey } from "../_game/deck.ts";

export const START_CREDITS = 2000;

/**
 * 강화 0 기준 판매가.
 *
 * 등급 간격은 기하평균 약 2.86배다. 예전처럼 3.2배를 유지하려 하면, 15강으로 등급
 * 3칸을 만드는 데 필요한 배수(3.2³ ≈ 32.8배)가 겹쳐 레전드 +15가 98,304까지
 * 뛴다("고강화 곡선이 너무 커지면 안 된다"는 요구를 어긴다). 그래서 간격을 2.86배로
 * 살짝 좁히고, 대신 강화 쪽 총배수를 24.48배로 올렸다(STEP_GROWTH 참고).
 *
 * 레전드 2,000은 시작 크레딧(START_CREDITS)과 정확히 같다. 기본가를 낮춰도 레전드
 * 한 장의 판매가가 한 판 밑천 전체와 같으니, 뽑는 순간의 보상은 여전히 크다.
 */
export const BASE_VALUE: Record<TierKey, number> = {
  COMMON: 30,
  UNCOMMON: 90,
  RARE: 250,
  EPIC: 700,
  LEGEND: 2000,
};

/** 강화 천장. */
export const MAX_PLUS = 15;

/**
 * 강화 한 단계를 성공했을 때 가치에 곱하는 배수. +0→+1 부터 +14→+15 까지 열다섯 개다.
 *
 * 이전 곡선(1.30→1.07)은 체감이었다. 배수가 큰 자리가 하필 파괴 위험이 0인 초반이라
 * "전부 +6까지 올려서 팔기"가 위험 없는 확정 이익 루프였다 — 강화가 도박이 아니라
 * 반복 클릭 노동이 된 원인이다. 이번엔 반대로 **점증**시켜 큰 배수를 파괴가 걸리는
 * 후반 구간으로 옮긴다. 그래야 위험과 보상이 같은 방향을 본다.
 *
 * 누적 배수 24.4788배는 등급 3.05칸(기하평균 2.86배 기준 log(24.4788)/log(2.86)).
 * 그래서 언커먼 +15(2,203)가 갓 뽑은 레전드 +0(2,000)을 넘는다 — 열다섯 번 강화한
 * 카드가 등급 하나를 이겨야 "만렙"이 의미 있다는 요구가 여기서 성립한다.
 */
const STEP_GROWTH: readonly number[] = [
  1.1, 1.11, 1.12, 1.13, 1.14, 1.16, 1.2, 1.23, 1.26, 1.29, 1.32, 1.35, 1.38, 1.41, 1.44,
];

/** MULT[n] = +n 카드의 기본가 대비 배수. STEP_GROWTH 의 누적곱이다. */
const MULT: readonly number[] = STEP_GROWTH.reduce<number[]>(
  (acc, g) => [...acc, acc[acc.length - 1] * g],
  [1],
);

export type Pack = {
  key: string;
  name: string;
  price: number;
  size: number;
  rates: Rates;
  /** 상점에 적을 한 줄. */
  blurb: string;
};

/**
 * 팩 세 종.
 *
 * 셋 다 그대로 팔면 손해다(일반 8.65%, 고급 4.41%, 플래티넘 3.21%). 비쌀수록 엣지가
 * 낮은 건 의도다 — 비싼 팩을 사는 것 자체가 보상이어야 한다.
 *
 * 셋은 전략적 선택지가 아니라 자금 구간별 진행 사다리다. 플래티넘을 살 수 있으면
 * 다른 팩을 고를 경제적 이유가 없다. 놓친 게 아니라 알고 두는 구조다 — 팩마다 서로
 * 다른 장점(엣지 대 변동성 같은)을 주는 건 다음 개편 몫으로 미룬다.
 *
 * START_CREDITS(2000)로는 플래티넘(2400)을 못 산다. 모아서 처음 사는 순간이 이 모드의
 * 첫 목표다.
 */
export const PACKS: readonly Pack[] = [
  {
    key: "normal",
    name: "일반 선수팩",
    price: 400,
    size: 3,
    rates: { LEGEND: 1, EPIC: 3, RARE: 16, UNCOMMON: 28, COMMON: 52 },
    blurb: "부담 없이 한 봉. 레전드 3%",
  },
  {
    key: "good",
    name: "고급 선수팩",
    price: 1100,
    size: 5,
    rates: { LEGEND: 3, EPIC: 6, RARE: 24, UNCOMMON: 47, COMMON: 20 },
    blurb: "커먼 비율을 20%까지 낮췄어요. 레전드 14%",
  },
  {
    key: "platinum",
    name: "플래티넘 선수팩",
    price: 2400,
    size: 5,
    rates: { LEGEND: 9, EPIC: 23, RARE: 39, UNCOMMON: 29, COMMON: 0 },
    blurb: "커먼이 안 나와요. 레전드 선수 등장 38%!",
  },
];

export const cheapestPackPrice = () => Math.min(...PACKS.map((p) => p.price));

/** 팩 하나를 열어 전부 팔았을 때 받을 금액의 기댓값. 엣지를 재는 데 쓴다. */
export function packExpectedValue(pack: Pack): number {
  const perCard = TIERS.reduce((s, t) => s + (pack.rates[t.key] / 100) * BASE_VALUE[t.key], 0);
  return perCard * pack.size;
}

/** 카드 가치 = 기본가 × 그 단계까지의 누적 배수. 판매가이자 이 게임의 성과 점수다. */
export function cardValue(tier: TierKey, plus: number): number {
  // 표에서 읽으므로 범위를 벗어나면 undefined 가 되어 NaN 이 번져나간다(예전 GROWTH ** plus
  // 는 어떤 값이 와도 숫자였다). 저장값 검증처럼 천장 밖 plus 를 물어보는 자리가 있어 자른다.
  return Math.round(BASE_VALUE[tier] * MULT[Math.min(Math.max(plus, 0), MAX_PLUS)]);
}

/**
 * 강화 한 번 시도의 [성공, 파괴] 확률(%). 나머지가 실패(단계 유지)다.
 *
 * **파괴는 +6부터** 시작한다. 누적배수가 2배를 넘는 지점과 맞춰, 그 앞은 돈만 잃고
 * 카드는 안 사라지는 안전 구간, +6부터는 카드 목숨을 거는 구간으로 가른다.
 *
 * 파괴 확률은 4%로 완만하게 시작한다. 가파르게 시작하면 플레이어가 "밀까 뺄까"를
 * 스스로 고르기도 전에 주사위가 대신 골라버린다.
 */
const ODDS: readonly (readonly [number, number])[] = [
  [98, 0],
  [95, 0],
  [90, 0],
  [84, 0],
  [76, 0],
  [66, 0],
  [55, 4],
  [47, 7],
  [40, 11],
  [34, 16],
  [28, 22],
  [22, 29],
  [17, 36],
  [12, 43],
  [8, 50],
];

export type Odds = { success: number; keep: number; destroy: number };

/** guard 를 켜면 파괴 확률이 실패로 흡수된다. 성공률은 그대로다. */
export function oddsAt(plus: number, guard: boolean): Odds {
  const row = ODDS[plus];
  if (!row) return { success: 0, keep: 100, destroy: 0 };
  const [success, destroy] = row;
  const keep = 100 - success - destroy;
  return guard ? { success, keep: keep + destroy, destroy: 0 } : { success, keep, destroy };
}

/**
 * 강화비 = min(현재 카드 가치 × 11%, 기본가 × 20%) 를 올림한다.
 *
 * 두 겹이다. 앞 구간(가치의 11%)은 "+0~+5를 올려서 되판다"는 차익을 없애는 안전
 * 구간 벽이고, +6부터 걸리는 **기본가 20% 상한**은 강화비가 계속 가치에 비례해
 * 깊은 강화가 자금력 노동이 되는 걸 막는다. 상한이 없으면 레전드 후반 강화비가
 * 수천까지 올라 +15가 수학상으로만 존재하는 숫자가 된다.
 *
 * `round` 가 아니라 `ceil` 을 쓴다. 반올림하면 커먼 일부 단계에서 정수 기대손익이
 * 미세하게 양수로 뒤집힌다 — "모든 단계가 손해"라는 이 경제 전체의 핵심 성질은
 * 연속값이 아니라 실제로 지불하는 정수에서 지켜져야 한다.
 */
export function upgradeCost(tier: TierKey, plus: number): number {
  return Math.ceil(Math.min(cardValue(tier, plus) * 0.11, BASE_VALUE[tier] * 0.2));
}

/**
 * 보호료 = ceil(카드 가치 × 파괴율 × 1.05).
 *
 * 파괴로 잃을 기대 금액보다 딱 5% 비싸게 받는다. 예전 1.3배는 기대 파괴손실보다
 * 30% 비싸 수학적으로 항상 손해였다 — 그러면 토글이 있어도 아무도 안 켜는 장식이
 * 된다. 1.05배는 "조금 손해 보고 마음 편할래"가 실제로 성립하는 자리다. 1.0 아래로
 * 내리면 반대로 항상 켜는 게 이득이라 필수 토글이 되어버린다.
 */
export function guardFee(tier: TierKey, plus: number): number {
  return Math.ceil(cardValue(tier, plus) * (oddsAt(plus, false).destroy / 100) * 1.05);
}

/**
 * 파산. 제일 싼 팩도 못 사고 보관함도 비었을 때다.
 * 보관함에 카드가 남아 있으면 팔아서 계속할 수 있으니 아직 끝이 아니다.
 */
export function isBankrupt(credits: number, vaultSize: number): boolean {
  return credits < cheapestPackPrice() && vaultSize === 0;
}
