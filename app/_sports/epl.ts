// 프리미어리그 25/26 시즌 선수 성적. FotMob 통계 CDN(data.fotmob.com)에서 받아온다.
//
// 네이버에서 옮겨온 이유: 네이버 기록 API 는 pageSize=500 이 하드 상한이고 페이징이 없다.
// 응답이 한글 이름 가나다순이라 "조" 뒤 선수가 통째로 잘려서, 콜 파머·비르츠·후벵 디아스·
// 로메로·카세미루 같은 상위권이 카드에 아예 안 나왔다(포지션별 상위 13명 중 19% 손실).
// page/offset/teamId 파라미터도, 팀별 경로도(403) 통하지 않아 우회로가 없었다.
//
// FotMob 쪽은 스탯 종류마다 파일이 하나씩이고 컷이 없다. 대신 여러 파일을 선수 ID 로 조인해야
// 카드 한 장이 완성된다. 평점(rating)을 직접 주므로 활약도를 우리가 합성하지 않는다.

import { assignTiers, type Card, type SportConfig } from "../_game/deck.ts";
import { KOREAN_NAME } from "./epl-names.ts";

// 시즌마다 바뀐다. data.fotmob.com/stats/47/season/{SEASON_ID}/topstats.json 의 경로는
// www.fotmob.com/api/data/leagues?id=47 응답의 stats.seasonStatLinks 에서 찾을 수 있다.
const LEAGUE_ID = 47;
const SEASON_ID = 27110; // 2025/2026
const BASE = `https://data.fotmob.com/stats/${LEAGUE_ID}/season/${SEASON_ID}`;

/** 최소 출전(분). 1500분 = 약 17경기 풀타임. 더 올리면 풀이 줄어 등급 정원까지 같이 깎인다. */
const MIN_MINS = 1500;

type Role = "골키퍼" | "센터백" | "풀백" | "미드필더" | "공격형MF" | "윙어" | "스트라이커";

/**
 * FotMob 포지션 코드 → 역할군. 코드는 응답의 Positions 배열 첫 값을 쓴다(주 포지션).
 * 실측으로 확인한 대응이다. 11=돈나룸마·라야, 34=살리바·후벵 디아스, 38=트뤼페르·칼라피오리,
 * 66=라이스·앤더슨, 85=브루노·소보슬러이, 83/87=사카·도쿠, 115=홀란·주앙 페드루.
 * 이 구분은 FotMob 사이트의 포지션 탭과 정확히 일치한다.
 */
const ROLE_BY_CODE: Record<number, Role> = {
  11: "골키퍼",
  32: "풀백", 38: "풀백", 62: "풀백", 68: "풀백", 71: "풀백",
  33: "센터백", 34: "센터백", 35: "센터백", 36: "센터백", 37: "센터백",
  64: "미드필더", 65: "미드필더", 66: "미드필더", 73: "미드필더", 75: "미드필더", 76: "미드필더", 77: "미드필더",
  84: "공격형MF", 85: "공격형MF", 86: "공격형MF",
  83: "윙어", 87: "윙어", 103: "윙어", 107: "윙어",
  104: "스트라이커", 105: "스트라이커", 106: "스트라이커", 115: "스트라이커",
};

// 구단 색: 카드 내부 배경에 은은하게 깔아 팀을 구분한다. FotMob 도 TeamColor 를 주지만
// 풀럼이 #000000 으로 오는 등 어두운 배경에 안 맞는 값이 섞여 있어 검증된 값을 그대로 쓴다.
const TEAM_COLOR: Record<string, string> = {
  "9825": "#EF0107", // 아스널
  "8456": "#6CABDD", // 맨체스터 시티
  "10260": "#DA291C", // 맨체스터 유나이티드
  "10252": "#670E36", // 애스턴 빌라
  "8650": "#C8102E", // 리버풀
  "8678": "#B50E12", // 본머스
  "8472": "#E0521E", // 선덜랜드
  "10204": "#0057B8", // 브라이턴 앤 호브
  "9937": "#C2185B", // 브렌트퍼드
  "8455": "#034694", // 첼시
  "9879": "#E5E7EB", // 풀럼
  "10261": "#241F20", // 뉴캐슬 유나이티드
  "8668": "#274488", // 에버턴
  "8463": "#FFCD00", // 리즈 유나이티드
  "9826": "#1B458F", // 크리스털 팰리스
  "10203": "#E2231A", // 노팅엄 포레스트
  "8586": "#132257", // 토트넘 홋스퍼
  "8654": "#8B2942", // 웨스트햄 유나이티드
  "8191": "#5C2751", // 번리
  "8602": "#FDB913", // 울버햄튼 원더러스
};

const TEAM_KR: Record<string, string> = {
  "9825": "아스널", "8456": "맨체스터 시티", "10260": "맨체스터 유나이티드", "10252": "애스턴 빌라",
  "8650": "리버풀", "8678": "본머스", "8472": "선덜랜드", "10204": "브라이턴 앤 호브",
  "9937": "브렌트퍼드", "8455": "첼시", "9879": "풀럼", "10261": "뉴캐슬 유나이티드",
  "8668": "에버턴", "8463": "리즈 유나이티드", "9826": "크리스털 팰리스", "10203": "노팅엄 포레스트",
  "8586": "토트넘 홋스퍼", "8654": "웨스트햄 유나이티드", "8191": "번리", "8602": "울버햄튼 원더러스",
};

const MINI_STATS: Record<Role, [string, string]> = {
  골키퍼: ["클린시트", "선방률"],
  센터백: ["태클", "클리어"],
  풀백: ["도움", "기회창출"],
  미드필더: ["기회창출", "태클"],
  공격형MF: ["골", "도움"],
  윙어: ["골", "드리블"],
  스트라이커: ["골", "xG"],
};

export const EPL: SportConfig = {
  key: "epl",
  title: "프리미어리그 카드깡",
  seasonLabel: "25/26",
  emblem: "⚽",
  packSub: "25/26 EPL",
  teamColor: TEAM_COLOR,
  miniStatKeys: (role) => MINI_STATS[role as Role] ?? ["골", "도움"],
  guide: {
    pool: `25/26 시즌 기록 중 ${MIN_MINS}분 이상 뛴 선수만 나와요.`,
    tier: "포지션(골키퍼·센터백·풀백·미드필더·공격형MF·윙어·스트라이커) 안에서 FotMob 평점 순위로 갈라요. 그래서 골키퍼도 풀백도 레전드가 될 수 있어요. 평점은 우리가 만든 값이 아니라 FotMob 이 매긴 실제 평점이에요.",
  },
};

/** 스탯 파일 한 줄. StatValue 는 스탯마다 누적이거나 90분당이고, SubStatValue 는 부제에 해당하는 값이다. */
export type StatRow = {
  ParticiantId: number;
  ParticipantName: string;
  TeamId: number;
  TeamName: string;
  StatValue: number;
  SubStatValue?: number;
  MinutesPlayed: number;
  MatchesPlayed: number;
  Positions?: number[];
};

/** 스탯 이름 → (선수 ID → 값). rating 을 뼈대로 두고 나머지를 조인한다. */
export type StatMaps = Record<string, Map<number, StatRow>>;

// 카드 8칸과 등급에 필요한 파일만 받는다. 이름은 topstats.json 의 StatName 그대로다.
const STAT_FILES = [
  "goals", // 누적 골 (SubStat: 페널티 골)
  "goal_assist", // 누적 도움 (SubStat: xA)
  "expected_goals", // 누적 xG
  "expected_goalsontarget", // 누적 xGOT
  "total_att_assist", // 누적 기회 창출
  "big_chance_created", // 누적 결정적 기회 창출
  "big_chance_missed", // 누적 결정적 기회 놓침
  "accurate_pass", // 90분당 정확 패스 (SubStat: 패스 성공률 %)
  "won_contest", // 90분당 성공 드리블 (SubStat: 성공률 %)
  "total_tackle", // 90분당 태클
  "interception", // 90분당 인터셉트
  "effective_clearance", // 90분당 클리어
  "outfielder_block", // 90분당 블록
  "ball_recovery", // 90분당 리커버리
  "ontarget_scoring_att", // 90분당 유효슛
  "clean_sheet", // 클린시트 (골키퍼만 채워진다)
  "_save_percentage", // 선방률 %
  "saves", // 90분당 세이브
  "_goals_prevented", // 실점 방지 (기대 실점 대비)
  "goals_conceded", // 90분당 실점
] as const;

async function fetchStat(name: string): Promise<[string, Map<number, StatRow>]> {
  const res = await fetch(`${BASE}/${name}.json`, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.fotmob.com/" },
    next: { revalidate: 3600 },
  });
  // 개별 스탯이 빠져도 카드의 다른 칸은 살아야 하므로 실패는 빈 맵으로 넘긴다.
  if (!res.ok) return [name, new Map()];
  const json = (await res.json()) as { TopLists?: { StatList?: StatRow[] }[] };
  const list = json.TopLists?.[0]?.StatList;
  if (!Array.isArray(list)) return [name, new Map()];
  return [name, new Map(list.map((r) => [r.ParticiantId, r]))];
}

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/** 정수. 값이 없으면 0으로 본다(그 스탯 파일에 없다 = 기록이 0이다). */
function int(x: number | undefined): string {
  return String(Math.round(x ?? 0));
}

/** 소수 n자리. */
function dec(x: number | undefined, n = 1): string {
  return (x ?? 0).toFixed(n);
}

/** 백분율. */
function pct(x: number | undefined): string {
  return `${Math.round(x ?? 0)}%`;
}

/** 기대 대비 얼마나 더/덜 했는지. 양수면 기대를 넘겼다는 뜻이라 부호를 붙인다. */
function diff(x: number | undefined, n = 1): string {
  const v = x ?? 0;
  return `${v >= 0 ? "+" : ""}${v.toFixed(n)}`;
}

function statsOf(role: Role, get: (f: string) => StatRow | undefined, rating: StatRow): { k: string; v: string }[] {
  const v = (f: string) => get(f)?.StatValue;
  const sub = (f: string) => get(f)?.SubStatValue;
  const games = { k: "경기", v: int(rating.MatchesPlayed) };
  const score = { k: "평점", v: rating.StatValue.toFixed(2) };
  switch (role) {
    case "골키퍼":
      return [
        games,
        { k: "클린시트", v: int(v("clean_sheet")) },
        { k: "선방률", v: pct(v("_save_percentage")) },
        { k: "세이브", v: dec(v("saves")) },
        { k: "실점방지", v: diff(v("_goals_prevented")) },
        { k: "실점", v: dec(v("goals_conceded"), 2) },
        { k: "출전분", v: int(rating.MinutesPlayed) },
        score,
      ];
    case "센터백":
      return [
        games,
        { k: "태클", v: dec(v("total_tackle")) },
        { k: "인터셉트", v: dec(v("interception")) },
        { k: "클리어", v: dec(v("effective_clearance")) },
        { k: "블록", v: dec(v("outfielder_block")) },
        { k: "패스성공", v: pct(sub("accurate_pass")) },
        { k: "리커버리", v: dec(v("ball_recovery")) },
        score,
      ];
    case "풀백":
      return [
        games,
        { k: "도움", v: int(v("goal_assist")) },
        { k: "기회창출", v: int(v("total_att_assist")) },
        { k: "드리블", v: dec(v("won_contest")) },
        { k: "태클", v: dec(v("total_tackle")) },
        { k: "인터셉트", v: dec(v("interception")) },
        { k: "패스성공", v: pct(sub("accurate_pass")) },
        score,
      ];
    case "미드필더":
      return [
        games,
        { k: "골", v: int(v("goals")) },
        { k: "도움", v: int(v("goal_assist")) },
        { k: "기회창출", v: int(v("total_att_assist")) },
        { k: "패스성공", v: pct(sub("accurate_pass")) },
        { k: "태클", v: dec(v("total_tackle")) },
        { k: "인터셉트", v: dec(v("interception")) },
        score,
      ];
    case "공격형MF":
      return [
        games,
        { k: "골", v: int(v("goals")) },
        { k: "도움", v: int(v("goal_assist")) },
        { k: "xA", v: dec(sub("goal_assist")) },
        { k: "결정적기회", v: int(v("big_chance_created")) },
        { k: "드리블", v: dec(v("won_contest")) },
        { k: "패스성공", v: pct(sub("accurate_pass")) },
        score,
      ];
    case "윙어":
      return [
        games,
        { k: "골", v: int(v("goals")) },
        { k: "도움", v: int(v("goal_assist")) },
        { k: "드리블", v: dec(v("won_contest")) },
        { k: "기회창출", v: int(v("total_att_assist")) },
        { k: "xG", v: dec(v("expected_goals")) },
        { k: "xA", v: dec(sub("goal_assist")) },
        score,
      ];
    case "스트라이커":
      return [
        games,
        { k: "골", v: int(v("goals")) },
        { k: "도움", v: int(v("goal_assist")) },
        { k: "xG", v: dec(v("expected_goals")) },
        { k: "xGOT", v: dec(v("expected_goalsontarget")) },
        { k: "유효슛", v: dec(v("ontarget_scoring_att")) },
        { k: "놓친기회", v: int(v("big_chance_missed")) },
        score,
      ];
  }
}

function headlineOf(role: Role, get: (f: string) => StatRow | undefined, rating: StatRow): string {
  const games = rating.MatchesPlayed;
  // 평점은 스탯 8칸 마지막에 이미 있으니 헤드라인에서는 겹치지 않게 다른 걸 보여준다.
  if (role === "골키퍼") return `${games}경기 · 클린시트 ${int(get("clean_sheet")?.StatValue)}`;
  const goals = Math.round(get("goals")?.StatValue ?? 0);
  const assists = Math.round(get("goal_assist")?.StatValue ?? 0);
  return `${games}경기 · ${goals}골 ${assists}도움`;
}

/** fetch와 분리한 순수 계산부. 테스트에서 네트워크 없이 가짜 데이터로 검증한다. */
export function computeEplPool(ratingList: StatRow[], stats: StatMaps, minMins = MIN_MINS): Card[] {
  const byRole = new Map<Role, Omit<Card, "tier">[]>();
  for (const r of ratingList) {
    if (!r || r.ParticiantId == null || !r.ParticipantName) continue;
    if ((num(r.MinutesPlayed) ?? 0) < minMins) continue;
    const role = ROLE_BY_CODE[r.Positions?.[0] ?? -1];
    if (!role) continue;
    const get = (f: string) => stats[f]?.get(r.ParticiantId);
    const teamId = String(r.TeamId ?? "");
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push({
      id: String(r.ParticiantId),
      name: KOREAN_NAME[r.ParticipantName] ?? r.ParticipantName,
      team: TEAM_KR[teamId] ?? r.TeamName ?? "",
      teamId,
      teamLogo: teamId ? `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png` : "",
      photo: `https://images.fotmob.com/image_resources/playerimages/${r.ParticiantId}.png`,
      pos: role,
      back: "",
      role,
      rating: r.StatValue,
      headline: headlineOf(role, get, r),
      stats: statsOf(role, get, r),
    });
  }
  return [...byRole.values()].flatMap((cards) => assignTiers(cards));
}

export async function getEplPool(): Promise<Card[]> {
  const [ratingRes, ...statPairs] = await Promise.all([
    fetchStat("rating"),
    ...STAT_FILES.map((f) => fetchStat(f)),
  ]);
  const ratingList = [...ratingRes[1].values()];
  if (!ratingList.length) throw new Error("FotMob 평점 목록이 비어 있어요");
  const stats: StatMaps = Object.fromEntries(statPairs);

  const pool = computeEplPool(ratingList, stats);
  if (!pool.length) throw new Error("EPL 시즌 선수 기록이 비어 있어요");
  return pool;
}
