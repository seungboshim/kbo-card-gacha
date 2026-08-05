// 2026 KBO 선수 성적. Naver 스포츠 기록 API (비공식, 무인증)에서 시즌 누적 기록을 받아온다.
// KBO 공식 사이트는 ASP.NET 포스트백이라 규정타석/규정이닝 상위 30명만 GET으로 긁힌다.
// ponytail: Naver 쪽이 타자 329명 + 투수 277명을 WAR/wRC+ 포함해서 JSON으로 주므로 스크래핑 안 함.

import { assignTiers, type Card, type SportConfig } from "../_game/deck.ts";

const BASE = "https://api-gw.sports.naver.com/statistics/categories/kbo/seasons";

const SEASON = 2026;

type Role = "타자" | "선발" | "불펜";

// 구단 색: 카드 내부 배경에 은은하게 깔아 팀을 구분한다. 없는 teamId는 중립 회색(card.tsx에서 처리).
const TEAM_COLOR: Record<string, string> = {
  LG: "#C30452",
  KT: "#EB1E25",
  SS: "#074CA1",
  OB: "#131230",
  HT: "#EA0029",
  HH: "#FF6600",
  NC: "#315288",
  LT: "#041E42",
  SK: "#CE0E2D",
  WO: "#570514",
};

export const KBO: SportConfig = {
  key: "kbo",
  title: "KBO 카드깡",
  seasonLabel: String(SEASON),
  packSub: `${SEASON} KBO`,
  teamColor: TEAM_COLOR,
  miniStatKeys: (role) => (role === "타자" ? ["타율", "WAR"] : ["ERA", "WAR"]),
  guide: {
    pool: `${SEASON} 시즌 기록 중 타자는 124타석, 선발은 31이닝, 불펜은 21이닝 이상 뛴 선수만 나와요.`,
    tier: "역할군(타자·선발·불펜) 안에서 순위로 갈라요. 그래서 마무리투수도 레전드가 될 수 있어요. 투수는 WAR 그대로, 타자는 WAR과 타격 성적을 반씩 봐요.",
  },
};

// 최소 출전 기준. 2026-08-05 시점의 팀 경기수 103 에 예전 비율(타자 1.2타석/경기,
// 선발 0.3이닝, 불펜 0.2이닝)을 곱해 나온 값으로 굳혔다. 경기수 상위 분포가
// 103·101·101·101·100 이라 최다 출전이 이상치가 아닌 것도 확인했다.
//
// 비례식으로 두면 시즌이 갈수록 커트가 올라가서, 보관함에 담아둔 선수가 다음에 열었을 때
// 풀에서 빠질 수 있다. 누적 기록은 줄지 않으므로 고정해두면 한 번 들어온 선수는
// 부상으로 시즌을 접어도 계속 남는다.
const MIN_PA = 124;
const MIN_IP = { 선발: 31, 불펜: 21 } as const;

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

function baseCard(row: Row, role: Role, rating: number): Omit<Card, "tier" | "headline" | "stats"> {
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
    rating,
  };
}

/** 타석. 응답에 PA 필드가 없어 타수+볼넷+몸에맞는공으로 계산한다. */
export function plateApp(row: Row): number {
  return (num(row.hitterAb) ?? 0) + (num(row.hitterBb) ?? 0) + (num(row.hitterHp) ?? 0);
}

/** 최소 출전을 넘겼는지. ip 는 투수만 쓰고 타자일 때는 무시한다. */
export function meetsMinimum(row: Row, role: Role, ip: number): boolean {
  return role === "타자" ? plateApp(row) >= MIN_PA : ip >= MIN_IP[role];
}

/** 리그 평균 wOBA. 타석으로 가중해 구한다. */
export function leagueWoba(rows: Row[]): number {
  let weighted = 0;
  let total = 0;
  for (const row of rows) {
    const pa = plateApp(row);
    weighted += (num(row.hitterWoba) ?? 0) * pa;
    total += pa;
  }
  return total > 0 ? weighted / total : 0;
}

/**
 * 타격만 뽑아낸 WAR 근사. wOBA로 리그 평균 대비 득점 기여를 구하고 대체 수준을 더해 승수로 바꾼다.
 * (wOBA scale 1.2, 대체 수준 0.03런/타석, 득점당 10점)
 *
 * 응답에 수비 기록이 없어 hitterWar에서 수비를 뺄 수는 없다. 그래서 타격분을 따로 만들어 섞는다.
 * hitterWar만 쓰면 수비 좋은 중견수·유격수가 카드에 보이는 타격 기록과 어긋나게 높은 등급을 받는다
 * (김호령: 타율 .271 wRC+ 104인데 WAR 2.97로 에픽).
 *
 * 한계: 스탯티즈 oWAR과 달리 포지션 조정이 안 들어간다. 세부 포지션을 응답이 주지 않아서인데
 * (내야수/외야수/포수까지만 온다), 그만큼 유격수·2루수·포수가 낮게, 지명타자·1루수가 높게 잡힌다.
 * 실측 차이는 유격수 -1.4에서 지명타자 +0.7 사이. WAR을 절반 섞어 이 편향을 눌렀다.
 */
export function offensiveWar(row: Row, lgWoba: number): number {
  const pa = plateApp(row);
  const woba = num(row.hitterWoba) ?? lgWoba;
  return (((woba - lgWoba) / 1.2) * pa + 0.03 * pa) / 10;
}

function toHitter(row: Row, lgWoba: number): Omit<Card, "tier"> {
  const war = num(row.hitterWar) ?? 0;
  const games = num(row.hitterGameCount) ?? 0;
  const rating = 0.5 * offensiveWar(row, lgWoba) + 0.5 * war;
  return {
    ...baseCard(row, "타자", rating),
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
    // 이제 스냅샷 스크립트만 이 함수를 부른다. 순수 Node 에서는 next 옵션이 무시되지만,
    // 앱이 다시 직접 호출하게 될 때를 위해 남겨둔다.
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Naver 기록 API ${playerType} 응답 ${res.status}`);
  const json = (await res.json()) as { result?: { seasonPlayerStats?: Row[] } };
  const rows = json.result?.seasonPlayerStats;
  if (!Array.isArray(rows)) throw new Error(`Naver 기록 API ${playerType} 응답 형식이 바뀌었어요`);
  return rows.filter((r) => r && r.playerId && r.playerName);
}

/** "105 2/3", "0 1/3", "12", "" 같은 이닝 문자열을 실수로 바꾼다. */
export function parseInnings(raw: unknown): number {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d+)(?:\s+(\d)\/3)?$/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 3 : 0);
}

export async function getKboPool(): Promise<Card[]> {
  const [hitterRows, pitcherRows] = await Promise.all([fetchStats("HITTER"), fetchStats("PITCHER")]);

  const lgWoba = leagueWoba(hitterRows);

  const hitters = hitterRows.filter((r) => meetsMinimum(r, "타자", 0)).map((r) => toHitter(r, lgWoba));

  // 투수: 경기당 이닝 3 이상이면 선발, 미만이면 불펜.
  const starters: Omit<Card, "tier">[] = [];
  const relievers: Omit<Card, "tier">[] = [];
  for (const row of pitcherRows) {
    const ip = parseInnings(row.pitcherInning);
    const games = num(row.pitcherGameCount) ?? 0;
    const ipPerGame = games > 0 ? ip / games : 0;
    const role: "선발" | "불펜" = ipPerGame >= 3 ? "선발" : "불펜";
    if (meetsMinimum(row, role, ip)) (role === "선발" ? starters : relievers).push(toPitcher(row, role, ip));
  }

  // 등급은 역할군(타자/선발/불펜) 내 WAR 백분위로 각각 매긴다.
  const pool = [...assignTiers(hitters), ...assignTiers(starters), ...assignTiers(relievers)];
  if (!pool.length) throw new Error(`${SEASON} 시즌 선수 기록이 비어 있어요`);
  return pool;
}
