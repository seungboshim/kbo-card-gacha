// 혼자서 모드의 숫자. 전부 여기 모아서 플레이해보고 조이기 쉽게 둔다.
// 근거와 검증 결과는 docs/superpowers/specs/2026-08-05-solo-mode-design.md 의 "경제 수치" 절에 있다.

import { TIERS, type Rates, type TierKey } from "../_game/deck.ts";

export const START_CREDITS = 2000;

/**
 * 강화 0 기준 판매가.
 *
 * 등급 점수(TIERS.score)를 그대로 안 쓰는 이유: 점수 비율(레전드가 에픽의 2.2배)로 두면
 * 플래티넘 팩 값의 절반이 레전드 한 장이 되어, 팩 값을 맞추려면 레전드가 70% 확률로
 * 나와야 한다. 그러면 "레전드 포함"이 광고가 아니라 보장이 된다. 3.75배로 벌렸다.
 */
export const BASE_VALUE: Record<TierKey, number> = {
  COMMON: 20,
  UNCOMMON: 80,
  RARE: 250,
  EPIC: 800,
  LEGEND: 3000,
};

/** 강화 천장. */
export const MAX_PLUS = 15;

/**
 * 강화 한 단계를 성공했을 때 가치에 곱하는 배수. +0→+1 부터 +14→+15 까지 열다섯 개다.
 *
 * 고정 배수 하나로는 안 됐다. 성공 한 번의 보상을 키우려고 배수를 올리면 복리로 곱해져
 * 레전드 최고 강화가 몇십만이 되고, 끝을 눌러 배수를 낮추면 초반 한 번의 성공이 시시해진다.
 * 초반을 1.30 으로 크게 잡고 뒤로 갈수록 1.07 까지 좁혀 둘을 같이 만족시킨다.
 *
 * 줄이는 폭은 +9→+10 까지 0.02 씩, 그 뒤로는 0.01 씩이다. 뒤로 갈수록 완만해져야
 * 레전드 +15 가 3만 언저리에서 멎는다(고정 1.3 이면 15만, 고정 1.6 이면 346만이었다).
 */
const STEP_GROWTH: readonly number[] = [
  1.3, 1.28, 1.26, 1.24, 1.22, 1.2, 1.18, 1.16, 1.14, 1.12, 1.11, 1.1, 1.09, 1.08, 1.07,
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
 * 셋 다 그대로 팔면 손해다(일반 18.6%, 고급 14.9%, 플래티넘 12.7%). 돈이 새는 곳을 팩
 * 하나로 몰아야 강화가 만회 수단이 될 수 있다. 반대로 두면(팩이 이득이면) 강화가 유일한
 * 소각구가 되어 뭘 해도 줄어드는 느낌이 난다.
 *
 * 엣지가 비싼 팩일수록 낮은 건 의도다. 비싼 팩을 사는 게 보상이어야 한다.
 *
 * START_CREDITS(2000)로는 플래티넘(3300)을 못 산다. 모아서 처음 사는 순간이 이 모드의
 * 첫 목표다.
 */
export const PACKS: readonly Pack[] = [
  {
    key: "normal",
    name: "일반 선수팩",
    price: 500,
    size: 3,
    rates: { LEGEND: 1, EPIC: 4, RARE: 17, UNCOMMON: 26, COMMON: 52 },
    blurb: "부담 없이 한 봉. 레전드 3%",
  },
  {
    key: "good",
    name: "고급 선수팩",
    price: 1400,
    size: 5,
    rates: { LEGEND: 2, EPIC: 9, RARE: 26, UNCOMMON: 48, COMMON: 15 },
    blurb: "커먼 비율을 15%까지 낮췄어요. 레전드 10%",
  },
  {
    key: "platinum",
    name: "플래티넘 선수팩",
    price: 3300,
    size: 5,
    rates: { LEGEND: 9, EPIC: 23, RARE: 40, UNCOMMON: 28, COMMON: 0 },
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
 * **파괴는 +7 부터 시작한다.** 그 아래는 돈만 잃고 카드는 안 사라진다. 긴장이
 * "살아남을까"에서 "감당할 수 있나"로 옮겨가고, +7 이 진짜 도박의 시작선이 된다.
 * 색 밴드가 바뀌는 자리와도 겹쳐서 색 자체가 경고가 된다.
 *
 * 파괴가 +0 부터 있던 예전 곡선은 +5→+6 이 성공 25% 파괴 25% 라, 돈이 있어도 두 번에
 * 한 번은 카드를 잃어 강화의 재미가 초반에 끊겼다.
 */
const ODDS: readonly (readonly [number, number])[] = [
  [98, 0],
  [95, 0],
  [90, 0],
  [84, 0],
  [76, 0],
  [66, 0],
  [55, 0],
  [45, 8],
  [36, 14],
  [28, 20],
  [21, 26],
  [15, 32],
  [10, 38],
  [6, 44],
  [3, 50],
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
 * 강화 비용 = 현재 카드 가치의 13%.
 *
 * 30% 였을 때는 모든 단계의 기대 손익이 음수라 강화로 절대 돈을 못 벌었다. 그게
 * "강화장사가 안 된다"의 원인이었다. 13% 는 기대 손익이 +5→+6 에서 정확히 0 을 지나도록
 * 잡은 값이다. 그 앞은 남고 뒤는 밑진다 — 강화장사의 천장이 +6 이라는 규칙이 숫자에서
 * 저절로 나온다. 파괴가 시작되는 +7 과 그 자리가 겹친다. "여기부터 도박"이 확률·손익·
 * 색 밴드에서 같은 곳을 가리킨다.
 */
const UPGRADE_COST_RATIO = 0.13;

export function upgradeCost(tier: TierKey, plus: number): number {
  return Math.round(cardValue(tier, plus) * UPGRADE_COST_RATIO);
}

/**
 * 보호료 = 카드 가치 × 파괴율 × 1.3. 파괴로 잃을 기대 금액보다 30% 비싸게 받는다.
 *
 * 강화비의 배수로 매기는 안은 버렸다. 강화비 비율(UPGRADE_COST_RATIO)에 배수를 곱하는
 * 방식은 비율이 오르면 보호권이 카드보다 비싸질 수 있다. 카드 가치에서 바로 재는 지금
 * 방식은 그 위험이 없다.
 */
export function guardFee(tier: TierKey, plus: number): number {
  return Math.round(cardValue(tier, plus) * (oddsAt(plus, false).destroy / 100) * 1.3);
}

/**
 * 파산. 제일 싼 팩도 못 사고 보관함도 비었을 때다.
 * 보관함에 카드가 남아 있으면 팔아서 계속할 수 있으니 아직 끝이 아니다.
 */
export function isBankrupt(credits: number, vaultSize: number): boolean {
  return credits < cheapestPackPrice() && vaultSize === 0;
}
