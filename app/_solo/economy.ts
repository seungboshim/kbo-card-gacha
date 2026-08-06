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

/**
 * 강화 한 단계마다 가치가 곱해지는 배수.
 *
 * 1.6 이었다가 낮췄다. 천장을 15 로 늘리면서 1.6 을 쓰면 레전드가 346만이 되고,
 * 강화비(가치의 30%)보다 성공 시 상승분(60%)이 커서 낮은 단계 강화가 돈벌이가 된다.
 * 1.3 이면 상승분과 비용이 같아 모든 단계의 기대 손익이 음수가 된다. 강화로는
 * 절대 돈을 못 번다.
 */
export const GROWTH = 1.3;

/** 강화 천장. */
export const MAX_PLUS = 15;

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
 * 일반팩만 엣지가 마이너스인 건 의도다. 하우스 엣지가 있으면 보유액이 계속 깎여서
 * "모아서 고급팩 산다"가 운에만 달리게 된다. 느리지만 확실히 모으는 길을 열어두고,
 * 하우스는 플래티넘과 강화에서만 가져간다.
 */
export const PACKS: readonly Pack[] = [
  {
    key: "normal",
    name: "일반 선수팩",
    price: 400,
    size: 3,
    rates: { LEGEND: 1, EPIC: 4, RARE: 17, UNCOMMON: 26, COMMON: 52 },
    blurb: "부담 없이 한 봉. 레전드 3%",
  },
  {
    key: "good",
    name: "고급 선수팩",
    price: 1200,
    size: 5,
    rates: { LEGEND: 2, EPIC: 9, RARE: 26, UNCOMMON: 48, COMMON: 15 },
    blurb: "커먼 비율을 15%까지 낮췄어요. 레전드 10%",
  },
  {
    key: "platinum",
    name: "플래티넘 선수팩",
    price: 3000,
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

/** 카드 가치 = 기본가 × GROWTH^강화수치. 판매가이자 이 런의 성과 점수다. */
export function cardValue(tier: TierKey, plus: number): number {
  return Math.round(BASE_VALUE[tier] * GROWTH ** plus);
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
 * 강화 비용 = 현재 카드 가치의 30%.
 *
 * 기본가에 선형으로 두는 안도 해봤지만 버렸다. 고강화로 갈수록 카드 가치 대비 강화비가
 * 40% 에서 3% 로 떨어져 상대적으로 공짜가 된다. 비율을 20% 로 낮추면 +5 까지 올려 파는 게
 * 돈벌이가 되어 경제가 폭주한다(시뮬레이션에서 팩 3,097회, 보유액 46만). 30% 가 선이다.
 */
export function upgradeCost(tier: TierKey, plus: number): number {
  return Math.round(cardValue(tier, plus) * 0.3);
}

/**
 * 보호료 = 카드 가치 × 파괴율 × 1.3. 파괴로 잃을 기대 금액보다 30% 비싸게 받는다.
 *
 * 강화비의 배수로 매기는 안은 버렸다. 강화비가 이미 카드 가치의 30% 라 거기에 배수를
 * 곱하면 보호권이 카드보다 비싸진다. 그러면 장치가 죽는다.
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
