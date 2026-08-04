// 종목 공용 카드/등급/뽑기 로직. 종목 전용 부분(선수 데이터 수집, rating 계산, 표시 문구)은
// app/_sports/*.ts 로 뺀다.

export type TierKey = "LEGEND" | "EPIC" | "RARE" | "UNCOMMON" | "COMMON";

/**
 * 역할군 내 상위 누적 비율(pct)까지 해당 등급. rate는 뽑기 확률(%, 합계 100), score는 게임 점수.
 *
 * pct와 rate는 함께 움직여야 한다. rate는 등급이 나올 확률이고 그 안에서는 균등하게 고르므로,
 * 카드 한 장이 나올 확률은 rate/인원이다. pct만 늘리면 그 등급 인원이 불어나 장당 확률이 떨어지고,
 * 레어가 에픽보다 귀해지는 역전이 생긴다. 지금 값은 EPL/KBO 양쪽 풀에서 장당 확률이
 * 레전드 < 에픽 < 레어 < 언커먼 < 커먼 순서를 유지하도록 맞춘 것이다.
 */
export const TIERS: readonly { key: TierKey; label: string; pct: number; rate: number; score: number }[] = [
  { key: "LEGEND", label: "레전드", pct: 0.03, rate: 1, score: 100 },
  { key: "EPIC", label: "에픽", pct: 0.1, rate: 4, score: 45 },
  { key: "RARE", label: "레어", pct: 0.35, rate: 18, score: 18 },
  { key: "UNCOMMON", label: "언커먼", pct: 0.65, rate: 25, score: 7 },
  { key: "COMMON", label: "커먼", pct: 1, rate: 52, score: 2 },
];

export type Card = {
  id: string;
  name: string;
  team: string;
  teamId: string;
  teamLogo: string;
  photo: string;
  pos: string;
  back: string;
  role: string;
  rating: number;
  tier: TierKey;
  headline: string;
  stats: { k: string; v: string }[];
};

/** 종목별로 game.tsx/card.tsx 에 필요한 표시 정보. */
export type SportConfig = {
  key: "kbo" | "epl";
  title: string; // 종목명 + "카드깡". seasonLabel과 조립해 "2026 KBO 카드깡"처럼 쓴다.
  seasonLabel: string; // "2026" | "25/26"
  emblem: string; // "⚾" | "⚽"
  packSub: string; // 팩 워드마크 아래 작은 글자. "2026 KBO" | "25/26 EPL"
  teamColor: Record<string, string>; // teamId → hex
  miniStatKeys: (role: string) => [string, string]; // mini 카드 대표 스탯 2개의 k
  guide: { pool: string; tier: string }; // (?) 툴팁 문구 2단락
};

/** COMMON=1 ... LEGEND=5 */
export function tierRankOf(tier: TierKey): number {
  return TIERS.length - TIERS.findIndex((t) => t.key === tier);
}

const SCORE_BY_TIER = Object.fromEntries(TIERS.map((t) => [t.key, t.score])) as Record<TierKey, number>;

/** 등급 점수. 게임 점수 합산과 대결 승패 판정에 같이 쓴다. */
export function scoreOf(tier: TierKey): number {
  return SCORE_BY_TIER[tier];
}

export function groupByTier(pool: Card[]): Record<TierKey, Card[]> {
  const out = Object.fromEntries(TIERS.map((t) => [t.key, [] as Card[]])) as Record<TierKey, Card[]>;
  for (const c of pool) out[c.tier].push(c);
  return out;
}

/** 등급을 확률로 먼저 굴리고, 그 등급 안에서 균등하게 한 명 뽑는다. 빈 등급이면 아래 등급으로 흘린다. */
export function drawOne(byTier: Record<TierKey, Card[]>, rnd: () => number = Math.random): Card {
  let roll = rnd() * TIERS.reduce((s, t) => s + t.rate, 0);
  for (const t of TIERS) {
    roll -= t.rate;
    const bucket = byTier[t.key];
    if (roll < 0 && bucket.length) return bucket[Math.floor(rnd() * bucket.length) % bucket.length];
  }
  for (const t of [...TIERS].reverse()) {
    const bucket = byTier[t.key];
    if (bucket.length) return bucket[Math.floor(rnd() * bucket.length) % bucket.length];
  }
  throw new Error("카드 풀이 비어 있어요");
}

/** n장을 중복 없이 뽑는다. 장당 20회 재시도하고, 그래도 겹치면 남은 풀에서 아무거나 채운다. */
export function drawPack(byTier: Record<TierKey, Card[]>, n: number, rnd: () => number = Math.random): Card[] {
  const all = Object.values(byTier).flat();
  const used = new Set<string>();
  const picked: Card[] = [];
  for (let i = 0; i < n && used.size < all.length; i++) {
    let card = drawOne(byTier, rnd);
    for (let attempt = 0; used.has(card.id) && attempt < 20; attempt++) card = drawOne(byTier, rnd);
    if (used.has(card.id)) card = all.find((c) => !used.has(c.id))!;
    used.add(card.id);
    picked.push(card);
  }
  return picked;
}

/** rating 내림차순으로 정렬해 역할군 내 순위 비율로 등급을 매긴다. cards는 이미 한 역할군이어야 한다. */
export function assignTiers(cards: Omit<Card, "tier">[]): Card[] {
  const sorted = [...cards].sort((a, b) => b.rating - a.rating);
  const n = sorted.length;
  return sorted.map((c, i) => {
    const p = (i + 1) / n;
    // 34명 미만이면 1위의 백분위(1/n)가 이미 3%를 넘어 레전드가 한 명도 안 나온다.
    // 골키퍼(22명)나 공격수(29명)처럼 작은 역할군이 통째로 레전드를 잃으므로 1위는 항상 레전드로 둔다.
    const tier: TierKey = i === 0 ? "LEGEND" : (TIERS.find((t) => p <= t.pct) ?? TIERS[TIERS.length - 1]).key;
    return { ...c, tier };
  });
}
