// 혼자서 모드의 숫자. 전부 여기 모아서 플레이해보고 조이기 쉽게 둔다.
//
// **2026-08 팀 우선 재조정.** 주인이 엔드 컨텐츠를 강화에서 팀(스쿼드) 맞추기로
// 옮겼다("이 게임의 엔드 컨텐츠는 강화가 아니라 팀 맞추기다"). 강화는 관문이 아니라
// 통로여야 하는데, 그 전 곡선은 강화가 돈과 카드를 다 잡아먹어 스쿼드까지 못 가게
// 막았다. 이번 개편은 난이도를 낮추고(파괴율을 크게 내리고, 강화비를 완화하고)
// 성취감은 계속 옅게 남기는 방향으로 값을 다시 짰다. 근거와 검증은
// docs/economy/2026-08-team-first-rebalance.md 에 있다.
//
// 이전 개편사(위험 없는 노동 → 도박으로 뒤집은 B안, 그 뒤 플레이테스트 재조율)는
// docs/economy/2026-08-rebalance-24x.md 와 2026-08-playtest-retune.md 에 남아 있다.
// 이번 개편으로 그 값들은 전부 대체됐다.
//
// 개요와 화면 설계는 docs/superpowers/specs/2026-08-05-solo-mode-design.md 의
// "경제 수치" 절에도 있다.

import { TIERS, type Rates, type TierKey } from "../_game/deck.ts";

/**
 * 시작 크레딧.
 *
 * 4,000. 일반팩(600) 6~7번, 고급팩(1,650) 2번을 살 수 있고 플래티넘(5,400)은 아직
 * 못 산다 — 모아서 처음 사는 순간이 이 모드의 첫 목표라는 성질은 그대로 둔다.
 */
export const START_CREDITS = 4000;

/**
 * 강화 0 기준 판매가.
 *
 * 팀 맞추기가 목표가 됐으므로 등급별 기본가 자체를 올려, 카드 한 장 한 장이 스쿼드
 * 자리를 채우는 재료로서 갖는 값이 두드러지게 했다. 등급 간격은 대략 2.53~2.67배다.
 */
export const BASE_VALUE: Record<TierKey, number> = {
  COMMON: 50,
  UNCOMMON: 150,
  RARE: 400,
  EPIC: 950,
  LEGEND: 2000,
};

/** 강화 천장. */
export const MAX_PLUS = 15;

/**
 * 강화 한 단계를 성공했을 때 가치에 곱하는 배수. +0→+1 부터 +14→+15 까지 열다섯 개다.
 *
 * 세 구간은 그대로 유지한다 — **+0~+5(안전)** 는 배수를 낮춰 반복 클릭이 이득이 되지
 * 않게 하고, **+6~+10(도박)** 은 배수를 크게 줘서 카드 목숨을 건 보람이 나오게 하고,
 * **+11~+14(트로피)** 는 다시 눌러 고강화 곡선이 폭주하지 않게 막는다.
 *
 * 안전 구간(1.09~1.14)은 이전과 같다. 도박 구간을 1.35~1.55 에서 1.30~1.38 로,
 * 트로피 구간을 1.20 에서 1.33 으로 조정했다 — 파괴율을 크게 낮춘 대신(아래 ODDS
 * 참고) 배수도 함께 낮춰야 레전드 +15 가 5만대에서 멎는다(실측 50,023).
 */
const STEP_GROWTH: readonly number[] = [
  1.09, 1.09, 1.1, 1.11, 1.12, 1.14, // +0~+5   안전 구간
  1.3, 1.32, 1.34, 1.36, 1.38, // +6~+10  도박 구간
  1.33, 1.33, 1.33, 1.33, // +11~+14 트로피 구간
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
  /**
   * 상점에 적을 한 줄. `{legend}` 를 쓰면 그 자리에 legendChance() 값이 들어간다.
   * 숫자를 문구에 손으로 박으면 확률표를 고칠 때 문구만 낡아서 거짓말이 된다.
   */
  blurb: string;
};

/**
 * 팩 세 종. 장당 확률(rates)은 그대로 두고 가격만 새 기본가·시작 크레딧에 맞춰
 * 다시 잡았다. 일반(600)·고급(1,650)·플래티넘(5,400) 순으로 자금 구간별 진행
 * 사다리를 만든다 — 셋은 전략적 선택지가 아니라 살 수 있는 만큼 사는 순서다.
 *
 * START_CREDITS(4,000)로는 플래티넘(5,400)을 못 산다. 모아서 처음 사는 순간이 이
 * 모드의 첫 목표다.
 */
export const PACKS: readonly Pack[] = [
  {
    key: "normal",
    name: "일반 선수팩",
    price: 600,
    size: 3,
    rates: { LEGEND: 1, EPIC: 3, RARE: 16, UNCOMMON: 28, COMMON: 52 },
    blurb: "별거 없는 일반 선수팩입니다.",
  },
  {
    key: "good",
    name: "고급 선수팩",
    price: 1650,
    size: 5,
    rates: { LEGEND: 3, EPIC: 6, RARE: 24, UNCOMMON: 47, COMMON: 20 },
    blurb: "고급진… 선수팩입니다",
  },
  {
    key: "platinum",
    name: "플래티넘 선수팩",
    price: 5400,
    size: 8,
    rates: { LEGEND: 9, EPIC: 23, RARE: 39, UNCOMMON: 29, COMMON: 0 },
    blurb: "레전드 등장 {legend}! 국장보다 돈벌기 쉽다!",
  },
];

export const cheapestPackPrice = () => Math.min(...PACKS.map((p) => p.price));

/**
 * 한 봉에서 레전드가 **적어도 한 장** 나올 확률(%, 정수).
 *
 * 장당 확률(플래티넘 9%)을 그대로 적으면 실제 체감보다 훨씬 인색해 보인다. 여덟 장을
 * 한 번에 뜯으니 사람이 궁금한 건 "이 봉에서 레전드를 볼까"지 장당 확률이 아니다.
 */
export function legendChance(pack: Pack): number {
  return Math.round((1 - (1 - pack.rates.LEGEND / 100) ** pack.size) * 100);
}

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
 * 강화 세 구간 규칙. 나중에 숫자(STEP_GROWTH·ODDS·guardFee)를 만질 사람은 이걸
 * 먼저 읽어야 한다.
 *
 * - **+0~+5 안전 구간**: 파괴가 없다. 기대손익은 절대액이 하찮은 수준으로 묶인다
 *   (아무도 그걸로 벌지 않을 만큼).
 * - **+6~+10 도박 구간**: 파괴가 있고, 기대손익은 양수다. 카드 목숨을 걸어야
 *   나오는 이득이라 "강화장사"라 부른다. 구간 초입(+6)이 가치 대비 비율로 가장
 *   많이 남는다 — 파괴율이 갓 생겨 낮은데 배수는 이미 크기 때문이다.
 * - **+11~+14 트로피 구간**: 기대손익이 음수다. 돈으로는 손해가 뻔한 구간이고,
 *   여기까지 미는 건 돈이 아니라 숫자(강화 표시) 자체를 보려는 것이다.
 *
 * **파괴율을 낮춘 이유.** "11강부터 고작 1원만 벌린다"는 피드백은 트로피 구간의
 * 높은 파괴율(옛 35~55%)이 보호료를 가치상승 코앞까지 밀어붙인 결과였다. 파괴가
 * 크면 보호료도 커지고, capToGain 이 그걸 가치상승 바로 아래로 깎아내리니 "이겨도
 * 남는 게 없는" 화면이 나왔다. 파괴율을 전 구간에서 낮추고(+6~+14: 3~15%) 남는
 * 몫이 가치상승의 20% 밑으로 안 떨어지게 못박았다(economy.test.ts).
 */

/**
 * 강화 한 번 시도의 [성공, 파괴] 확률(%). 나머지가 실패(단계 유지)다.
 *
 * **파괴는 +6부터** 시작한다. 누적배수가 2배 안팎인 지점과 맞춰, 그 앞은 돈만 잃고
 * 카드는 안 사라지는 안전 구간, +6부터는 카드 목숨을 거는 구간으로 가른다.
 *
 * 파괴율을 도박 구간 3~7%, 트로피 구간 9~15% 로 크게 낮췄다(이전 6~11%, 35~55%).
 * "파괴도 계속되고 그래서 팀을 못 맞추지 않게" 하라는 요구가 근거다 — 스쿼드를
 * 채우려면 카드가 살아남아야 한다. 성공률도 전 구간에서 높였다(도박 구간
 * 40~64%, 트로피 구간 20~34%).
 */
const ODDS: readonly (readonly [number, number])[] = [
  [98, 0],
  [95, 0],
  [90, 0],
  [85, 0],
  [80, 0],
  [74, 0],
  [64, 3],
  [58, 4],
  [52, 5],
  [46, 6],
  [40, 7],
  [34, 9],
  [29, 11],
  [24, 13],
  [20, 15],
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
 * 한 단계 성공했을 때 오르는 값. 아래 두 상한의 기준이다.
 * 천장(MAX_PLUS)에서는 다음 단계가 없으므로 0 이다.
 */
const gainAt = (tier: TierKey, plus: number): number =>
  plus >= MAX_PLUS ? 0 : cardValue(tier, plus + 1) - cardValue(tier, plus);

/**
 * **성공하면 낸 돈보다 반드시 더 받는다.** 강화비도 보호료도 이 선을 못 넘는다.
 *
 * 이 규칙이 없으면 이겼는데도 손해인 화면이 나온다. 기대손익이 음수인 건 상관없다
 * — 그건 "여러 번 굴리면 밑진다"는 말이고, 이 규칙은 "한 번 이겼을 때 남는다"는
 * 말이다. 둘은 다르고, 뒤엣것이 없으면 이겨도 진 기분이 든다.
 */
const capToGain = (raw: number, tier: TierKey, plus: number, alreadyPaid = 0): number => {
  const room = gainAt(tier, plus) - alreadyPaid - 1;
  return Math.max(1, Math.min(raw, room));
};

/**
 * 강화비. 구간마다 다른 규칙을 쓴다.
 *
 * - **+0~+5 안전 구간**: `ceil(카드 가치 × 5%)`
 * - **+6~+14 도박·트로피 구간**: `ceil(기본가 × (12% + 3.5%×(단계−6)))`. +6 이면
 *   기본가의 12%, +14 면 40% 다.
 *
 * 안전 구간을 9%에서 5%로 더 내렸다. "강화는 쉽게쉽게, 그렇다고 가치가 넘 높지는
 * 않게"라는 요구를 안전 구간에서부터 반영한다.
 *
 * 도박·트로피 구간은 예전엔 12% 고정이었다. 지금은 단계가 오를수록 강화비도 같이
 * 오르게 바꿨다 — 파괴율이 낮아져 후반 단계까지 밀기가 쉬워진 만큼, 강화비를
 * 누진시켜 트로피 구간이 여전히 "미친 짓"으로 남게 한다. 고정값이면 파괴율만 낮춘
 * 개편 뒤에는 트로피 구간까지 돈으로 쉽게 밀리는 구간이 됐을 것이다.
 *
 * `round` 가 아니라 `ceil` 을 쓴다. 반올림은 작은 등급에서 기대손익을 양수 쪽으로
 * 밀어붙이는데, 커먼처럼 값이 작은 카드는 1 크레딧 차이의 비중이 크다.
 */
export function upgradeCost(tier: TierKey, plus: number): number {
  const raw =
    plus <= 5
      ? Math.ceil(cardValue(tier, plus) * 0.05) // 안전 구간: 가치 비율
      : Math.ceil(BASE_VALUE[tier] * (0.12 + 0.035 * (plus - 6))); // 도박·트로피 구간: 단계별 누진
  return capToGain(raw, tier, plus);
}

/**
 * 보호료. `ceil(카드 가치 × 파괴율 × 1.6)` (강화비에 더해서 낸다).
 *
 * **여기서 규칙 하나를 버렸다.** 예전엔 "보호를 켠 기대손익이 어디서도 양수면 안
 * 된다"(계수 2.2)를 지켰다. 파괴율이 6~55% 로 컸을 때는 계수를 높여야 그 규칙이
 * 성립했고, 높인 계수가 트로피 구간에서 폭발하는 걸 상한(capToGain)이 막는
 * 구조였다.
 *
 * 파괴율을 3~15% 로 크게 낮추자 이 규칙과 "성공하면 남는 몫이 넉넉하다"(가치상승의
 * 20% 이상, economy.test.ts)가 정면으로 부딪혔다. 계수를 옛 규칙이 성립할 만큼
 * 올리면 보호료가 남는 몫을 갉아먹어 20% 규칙이 깨지고, 20% 규칙을 지킬 만큼
 * 낮추면 파괴율이 낮은 구간(+6~+8)에서 보호가 무위험 이득이 되어 옛 규칙이
 * 깨진다. 파괴가 3~7% 로 작아진 이상 둘을 함께 지킬 계수가 없다.
 *
 * **그래서 약한 규칙만 남긴다: 보호를 켜면 안 켠 것보다 기대손익이 나쁘다.**
 * 계수가 1.0 을 넘으면 자동으로 성립한다 — 보호료가 기대 파괴손실(가치×파괴율)
 * 보다 항상 비싸므로, 보호가 깎아주는 손실보다 얹는 비용이 더 크다. 1.6 은 그
 * 여유를 확보하면서도 트로피 구간에서 상한에 자주 걸리지 않을 값으로 골랐다.
 * 보호는 여전히 값을 치르는 선택이지만, 이제 그 값이 감당할 만하다 — "카드가
 * 아깝다"는 이유만으로 켜도 되는 수준으로 낮춘 것이 이번 개편의 의도다.
 *
 * 상한(capToGain)은 그대로 유지한다. 트로피 구간에서 보호료가 가치상승을 넘어서는
 * 걸 막고, 강화비와 합쳐도 항상 가치상승의 80% 아래로 묶는다(economy.test.ts).
 */
export function guardFee(tier: TierKey, plus: number): number {
  const raw = Math.ceil(cardValue(tier, plus) * (oddsAt(plus, false).destroy / 100) * 1.6);
  return capToGain(raw, tier, plus, upgradeCost(tier, plus));
}

/**
 * 파산. 제일 싼 팩도 못 사고 보관함도 비었을 때다.
 * 보관함에 카드가 남아 있으면 팔아서 계속할 수 있으니 아직 끝이 아니다.
 */
export function isBankrupt(credits: number, vaultSize: number): boolean {
  return credits < cheapestPackPrice() && vaultSize === 0;
}
