// 2026 KBO 선수 성적. Naver 스포츠 기록 API (비공식, 무인증)에서 시즌 누적 기록을 받아온다.
// KBO 공식 사이트는 ASP.NET 포스트백이라 규정타석/규정이닝 상위 30명만 GET으로 긁힌다.
// ponytail: Naver 쪽이 타자 329명 + 투수 277명을 WAR/wRC+ 포함해서 JSON으로 주므로 스크래핑 안 함.

const BASE = "https://api-gw.sports.naver.com/statistics/categories/kbo/seasons";

export const SEASON = 2026;

export type Role = "타자" | "선발" | "불펜";
export type TierKey = "LEGEND" | "EPIC" | "RARE" | "UNCOMMON" | "COMMON";

/** 역할군 내 상위 누적 비율(pct)까지 해당 등급. rate는 뽑기 확률(%, 합계 100), score는 게임 점수. */
export const TIERS: readonly { key: TierKey; label: string; pct: number; rate: number; score: number }[] = [
  { key: "LEGEND", label: "레전드", pct: 0.03, rate: 1, score: 100 },
  { key: "EPIC", label: "에픽", pct: 0.1, rate: 4, score: 45 },
  { key: "RARE", label: "레어", pct: 0.25, rate: 12, score: 18 },
  { key: "UNCOMMON", label: "언커먼", pct: 0.55, rate: 30, score: 7 },
  { key: "COMMON", label: "커먼", pct: 1, rate: 53, score: 2 },
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
  role: Role;
  war: number;
  tier: TierKey;
  headline: string;
  stats: { k: string; v: string }[];
};

/** COMMON=1 ... LEGEND=5 */
export function tierRankOf(tier: TierKey): number {
  return TIERS.length - TIERS.findIndex((t) => t.key === tier);
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

/** "105 2/3", "0 1/3", "12", "" 같은 이닝 문자열을 실수로 바꾼다. */
export function parseInnings(raw: unknown): number {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d+)(?:\s+(\d)\/3)?$/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 3 : 0);
}

/** war 내림차순으로 정렬해 역할군 내 순위 비율로 등급을 매긴다. cards는 이미 한 역할군이어야 한다. */
export function assignTiers(cards: Omit<Card, "tier">[]): Card[] {
  const sorted = [...cards].sort((a, b) => b.war - a.war);
  const n = sorted.length;
  return sorted.map((c, i) => {
    const p = (i + 1) / n;
    const tier = (TIERS.find((t) => p <= t.pct) ?? TIERS[TIERS.length - 1]).key;
    return { ...c, tier };
  });
}

type Row = Record<string, unknown>;

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

// 타율/출루율/장타율/OPS: 앞의 0을 뗀 .351 형태. 값 없으면 -
function avg(x: unknown): string {
  const n = num(x);
  return n === null ? "-" : n.toFixed(3).replace(/^0/, "");
}

// 소수점 n자리. 값 없으면 -
function dec(x: unknown, n = 2): string {
  const v = num(x);
  return v === null ? "-" : v.toFixed(n);
}

// 정수 스탯. 필드 자체가 없으면 -, 0이면 0
function int(x: unknown): string {
  const v = num(x);
  return v === null ? "-" : String(Math.trunc(v));
}

function position(row: Row, fallback: string): string {
  try {
    const p = JSON.parse(String(row.profile ?? "{}")) as { position?: string };
    return p.position || fallback;
  } catch {
    return fallback;
  }
}

function baseCard(row: Row, role: Role, war: number): Omit<Card, "tier" | "headline" | "stats"> {
  return {
    id: `${role}-${row.playerId}`,
    name: String(row.playerName),
    team: String(row.teamName ?? ""),
    teamId: String(row.teamId ?? ""),
    teamLogo: String(row.teamImageUrl ?? ""),
    photo: String(row.playerImageUrl ?? ""),
    pos: position(row, role),
    back: row.backNumber ? `#${row.backNumber}` : "",
    role,
    war,
  };
}

function toHitter(row: Row): Omit<Card, "tier"> {
  const war = num(row.hitterWar) ?? 0;
  const games = num(row.hitterGameCount) ?? 0;
  return {
    ...baseCard(row, "타자", war),
    headline: `${games}경기 · 타율 ${avg(row.hitterHra)}`,
    stats: [
      { k: "타율", v: avg(row.hitterHra) },
      { k: "홈런", v: int(row.hitterHr) },
      { k: "타점", v: int(row.hitterRbi) },
      { k: "안타", v: int(row.hitterHit) },
      { k: "OPS", v: avg(row.hitterOps) },
      { k: "wRC+", v: dec(row.hitterWrcPlus, 1) },
      { k: "도루", v: int(row.hitterSb) },
      { k: "WAR", v: dec(war) },
    ],
  };
}

function toPitcher(row: Row, role: "선발" | "불펜", ip: number): Omit<Card, "tier"> {
  const war = num(row.pitcherWar) ?? 0;
  const games = num(row.pitcherGameCount) ?? 0;
  const save = num(row.pitcherSave) ?? 0;
  const hold = num(row.pitcherHold) ?? 0;
  const era = ip > 0 ? dec(row.pitcherEra) : "-";
  const whip = ip > 0 ? dec(row.pitcherWhip) : "-";
  const inning = String(row.pitcherInning || "-");
  const winLose = `${int(row.pitcherWin)}-${int(row.pitcherLose)}`;

  const headline =
    role === "불펜"
      ? save > 0
        ? `${games}경기 · ${save}세이브`
        : hold > 0
          ? `${games}경기 · ${hold}홀드`
          : `${games}경기 · 평균자책 ${era}`
      : `${games}경기 · 평균자책 ${era}`;

  const stats =
    role === "선발"
      ? [
          { k: "ERA", v: era },
          { k: "승-패", v: winLose },
          { k: "이닝", v: inning },
          { k: "탈삼진", v: int(row.pitcherKk) },
          { k: "WHIP", v: whip },
          { k: "QS", v: int(row.pitcherQs) },
          // Naver 투수 응답에 피안타율이 없다. 9이닝당 탈삼진으로 대체.
          { k: "K/9", v: dec(row.pitcherInningKk, 1) },
          { k: "WAR", v: dec(war) },
        ]
      : [
          { k: "ERA", v: era },
          { k: "세이브", v: int(row.pitcherSave) },
          { k: "홀드", v: int(row.pitcherHold) },
          { k: "이닝", v: inning },
          { k: "탈삼진", v: int(row.pitcherKk) },
          { k: "WHIP", v: whip },
          { k: "승-패", v: winLose },
          { k: "WAR", v: dec(war) },
        ];

  return { ...baseCard(row, role, war), headline, stats };
}

async function fetchStats(playerType: "HITTER" | "PITCHER"): Promise<Row[]> {
  const res = await fetch(`${BASE}/${SEASON}/players?playerType=${playerType}&pageSize=500`, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://m.sports.naver.com/" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Naver 기록 API ${playerType} 응답 ${res.status}`);
  const json = (await res.json()) as { result?: { seasonPlayerStats?: Row[] } };
  const rows = json.result?.seasonPlayerStats;
  if (!Array.isArray(rows)) throw new Error(`Naver 기록 API ${playerType} 응답 형식이 바뀌었어요`);
  return rows.filter((r) => r && r.playerId && r.playerName);
}

export async function getPool(): Promise<Card[]> {
  const [hitterRows, pitcherRows] = await Promise.all([fetchStats("HITTER"), fetchStats("PITCHER")]);

  // 타자: 최소 출전 기준 PA >= 50 (응답에 PA 필드가 없어 타수+볼넷+몸에맞는공으로 계산)
  const hitters = hitterRows
    .filter((r) => (num(r.hitterAb) ?? 0) + (num(r.hitterBb) ?? 0) + (num(r.hitterHp) ?? 0) >= 50)
    .map(toHitter);

  // 투수: 경기당 이닝 3 이상이면 선발, 미만이면 불펜. 최소 이닝은 선발 20 / 불펜 15.
  const starters: Omit<Card, "tier">[] = [];
  const relievers: Omit<Card, "tier">[] = [];
  for (const row of pitcherRows) {
    const ip = parseInnings(row.pitcherInning);
    const games = num(row.pitcherGameCount) ?? 0;
    const ipPerGame = games > 0 ? ip / games : 0;
    const role: "선발" | "불펜" = ipPerGame >= 3 ? "선발" : "불펜";
    const minIp = role === "선발" ? 20 : 15;
    if (ip >= minIp) (role === "선발" ? starters : relievers).push(toPitcher(row, role, ip));
  }

  // 등급은 역할군(타자/선발/불펜) 내 WAR 백분위로 각각 매긴다.
  const pool = [...assignTiers(hitters), ...assignTiers(starters), ...assignTiers(relievers)];
  if (!pool.length) throw new Error(`${SEASON} 시즌 선수 기록이 비어 있어요`);
  return pool;
}
