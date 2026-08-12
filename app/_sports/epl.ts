// 프리미어리그 25/26 시즌 선수 성적. FotMob 통계 CDN(data.fotmob.com)에서 받아온다.
//
// 네이버에서 옮겨온 이유: 네이버 기록 API 는 pageSize=500 이 하드 상한이고 페이징이 없다.
// 응답이 한글 이름 가나다순이라 "조" 뒤 선수가 통째로 잘려서, 콜 파머·비르츠·후벵 디아스·
// 로메로·카세미루 같은 상위권이 카드에 아예 안 나왔다(포지션별 상위 13명 중 19% 손실).
// page/offset/teamId 파라미터도, 팀별 경로도(403) 통하지 않아 우회로가 없었다.
//
// FotMob 쪽은 스탯 종류마다 파일이 하나씩이고 컷이 없다. 대신 여러 파일을 선수 ID 로 조인해야
// 카드 한 장이 완성된다. 평점(rating)을 직접 주므로 활약도를 우리가 합성하지 않는다.

import { TIERS, assignTiers, type Card, type SportConfig } from "../_game/deck.ts";
import { KOREAN_NAME } from "./epl-names.ts";

// 시즌마다 바뀐다. data.fotmob.com/stats/47/season/{SEASON_ID}/topstats.json 의 경로는
// www.fotmob.com/api/data/leagues?id=47 응답의 stats.seasonStatLinks 에서 찾을 수 있다.
const LEAGUE_ID = 47;
const SEASON_ID = 27110; // 2025/2026
const BASE = `https://data.fotmob.com/stats/${LEAGUE_ID}/season/${SEASON_ID}`;

/** 최소 출전(분). 1500분 = 약 17경기 풀타임. 더 올리면 풀이 줄어 등급 정원까지 같이 깎인다. */
const MIN_MINS = 1500;

/**
 * 등급을 가를 때 골+도움에 얹는 가중치. 카드에 찍히는 평점은 원본 그대로 두고 순위에만 쓴다.
 *
 * FotMob 평점은 포지션 기대치 대비 상대평가라, 골을 많이 넣어도 그 포지션에서 기대되는 다른
 * 일(도움·기회창출)을 못 하면 낮게 나온다. 주니오르 크루피가 33경기 13골 0도움인데 공격형MF
 * 25명 중 17위로 커먼이었다.
 *
 * 0.01은 골+도움 10당 0.1점이다. 평점 폭이 1.8(6.2~8.03)이라 순위를 뒤집을 정도는 아니고
 * 비슷한 평점끼리의 앞뒤를 공격 기여로 가르는 무게다. 0.02를 넘기면 골+도움이 9뿐인
 * 데클란 라이스가 레전드에서 밀리고, 0.05면 레전드가 윙어·스트라이커로 쏠린다.
 */
const GOAL_BONUS = 0.01;

/**
 * 레전드로 올라가려면 넘어야 하는 출전(분). 평점은 90분당 평균이라 적게 뛴 선수도 높게 나온다.
 * 로드리가 1513분(21경기)만 뛰고 7.51로 전체 6위였는데, 38경기를 버틴 선수와 같은 줄에
 * 세우기엔 표본이 얇다. 2000분 = 약 22경기.
 */
const LEGEND_MIN_MINS = 2000;

type Role = "골키퍼" | "센터백" | "풀백" | "미드필더" | "공격형MF" | "윙어" | "스트라이커";

// 카드에 찍히는 포지션 이름. 등급은 role 로 가르고 화면에는 pos 를 쓴다(Card 가 둘을 따로 들고 있다).
// 공격형MF 는 미드필더와 따로 줄을 세워야 브루노와 라이스가 각각 1위가 되지만,
// 카드에서까지 "공격형MF"로 부르면 두 이름이 나란히 보여 산만하다. 표기만 합친다.
const POS_LABEL: Record<Role, string> = {
  골키퍼: "골키퍼",
  센터백: "센터백",
  풀백: "풀백",
  미드필더: "미드필더",
  공격형MF: "미드필더",
  윙어: "윙어",
  스트라이커: "스트라이커",
};

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

// mini 카드에 남길 대표 스탯 2개. statsOf 가 만드는 라벨과 글자까지 같아야 찾을 수 있다.
/**
 * 레전드 후보에게만 얹는 등번호와 큰 사진. FotMob 평점 목록은 등번호를 주지 않고,
 * 선수 사진도 얼굴만 잘린 작은 정사각형이라(10KB 안팎) 레전드 카드의 큰 레이아웃에서 허전하다.
 * 네이버 쪽 상반신 사진(80KB 안팎)과 등번호를 대신 쓴다.
 *
 * **최종 등급이 레전드인 카드에만 쓴다.** 여기 이름이 있어도 에픽으로 내려가면
 * FotMob 얼굴 사진으로 되돌린다(computeEplPool 끝의 heroOnlyForLegend). 예전엔 등급과
 * 무관하게 붙였는데, 상반신 사진은 레전드 카드의 큰 레이아웃에 맞춰 고른 것이라 작은
 * 카드에서는 얼굴이 작게 박혀 옆의 다른 에픽들과 따로 놀았다.
 *
 * 등급이 정해지기 전에는 누가 레전드인지 모르므로, 여기서는 일단 붙여두고 등급 배정이
 * 끝난 뒤에 걷어낸다.
 */
const HERO: Record<string, { back?: string; photo: string }> = {
  "Gianluigi Donnarumma": { back: "#25", photo: "548577" },
  "Marc Guéhi": { back: "#15", photo: "936120" },
  "Matheus Nunes": { back: "#27", photo: "1560920" },
  "Declan Rice": { back: "#41", photo: "574392" },
  "Bruno Fernandes": { back: "#8", photo: "523155" },
  "Bukayo Saka": { back: "#7", photo: "1479630" },
  "Erling Haaland": { back: "#9", photo: "991181" },
  "Bruno Guimarães": { back: "#39", photo: "1141016" },
  // 앤더슨은 네이버가 등번호를 0으로 주고 FotMob 스쿼드에도 없어 직접 적었다.
  "Elliot Anderson": { back: "#8", photo: "1635776" },
  "Rodri": { back: "#16", photo: "844073" },
  "Dominik Szoboszlai": { back: "#8", photo: "1064588" },
};

const MINI_STATS: Record<Role, [string, string]> = {
  골키퍼: ["클린시트", "선방률"],
  센터백: ["태클/90", "클리어/90"],
  풀백: ["도움", "기회창출"],
  미드필더: ["기회창출", "태클/90"],
  공격형MF: ["골", "도움"],
  윙어: ["골", "드리블/90"],
  스트라이커: ["골", "xG"],
};

export const EPL: SportConfig = {
  key: "epl",
  title: "프리미어리그 squad gacha",
  seasonLabel: "25/26",
  packSub: "25/26 EPL",
  teamColor: TEAM_COLOR,
  miniStatKeys: (role) => MINI_STATS[role as Role] ?? ["골", "도움"],
  guide: {
    pool: `25/26 시즌 기록 중 ${MIN_MINS}분 이상 뛴 선수만 나와요.`,
    tier: `레전드는 포지션을 가리지 않고 전체에서 상위 3%만 나와요(${LEGEND_MIN_MINS}분 이상 뛴 선수 중에서). 에픽 아래는 포지션(골키퍼·센터백·풀백·미드필더·윙어·스트라이커) 안에서 갈라서, 골키퍼도 풀백도 에픽이 될 수 있어요. 순위는 FotMob 이 매긴 실제 평점에 골·도움을 조금 얹어 정해요.`,
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
    // 이제 스냅샷 스크립트만 이 함수를 부른다. 순수 Node 에서는 next 옵션이 무시되지만,
    // 앱이 다시 직접 호출하게 될 때를 위해 남겨둔다.
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

// FotMob 은 스탯마다 단위가 다르다. 골·도움·xG 는 시즌 누적인데 태클·인터셉트·드리블은 90분당이라
// 라벨 없이 나란히 두면 27골과 태클 1.8이 같은 단위처럼 읽힌다. 90분당인 칸만 "/90"을 붙여 가른다.
const P90 = (k: string) => `${k}/90`;

function statsOf(role: Role, get: (f: string) => StatRow | undefined, rating: StatRow): { k: string; v: string }[] {
  const v = (f: string) => get(f)?.StatValue;
  const sub = (f: string) => get(f)?.SubStatValue;
  const games = { k: "경기", v: int(rating.MatchesPlayed) };
  const score = { k: "평점", v: rating.StatValue.toFixed(2) };
  const tackle = { k: P90("태클"), v: dec(v("total_tackle")) };
  const inter = { k: P90("인터셉트"), v: dec(v("interception")) };
  const dribble = { k: P90("드리블"), v: dec(v("won_contest")) };
  const passPct = { k: "패스성공", v: pct(sub("accurate_pass")) };
  const goals = { k: "골", v: int(v("goals")) };
  const assists = { k: "도움", v: int(v("goal_assist")) };
  const chances = { k: "기회창출", v: int(v("total_att_assist")) };
  switch (role) {
    case "골키퍼":
      return [
        games,
        { k: "클린시트", v: int(v("clean_sheet")) },
        { k: "선방률", v: pct(v("_save_percentage")) },
        { k: P90("세이브"), v: dec(v("saves")) },
        { k: "실점방지", v: diff(v("_goals_prevented")) },
        { k: P90("실점"), v: dec(v("goals_conceded"), 2) },
        { k: "출전분", v: int(rating.MinutesPlayed) },
        score,
      ];
    case "센터백":
      return [
        games,
        tackle,
        inter,
        { k: P90("클리어"), v: dec(v("effective_clearance")) },
        { k: P90("블록"), v: dec(v("outfielder_block")) },
        passPct,
        { k: P90("리커버리"), v: dec(v("ball_recovery")) },
        score,
      ];
    case "풀백":
      return [games, assists, chances, dribble, tackle, inter, passPct, score];
    case "미드필더":
      return [games, goals, assists, chances, passPct, tackle, inter, score];
    case "공격형MF":
      return [
        games,
        goals,
        assists,
        { k: "xA", v: dec(sub("goal_assist")) },
        { k: "결정적기회", v: int(v("big_chance_created")) },
        dribble,
        passPct,
        score,
      ];
    case "윙어":
      return [
        games,
        goals,
        assists,
        dribble,
        chances,
        { k: "xG", v: dec(v("expected_goals")) },
        { k: "xA", v: dec(sub("goal_assist")) },
        score,
      ];
    case "스트라이커":
      return [
        games,
        goals,
        assists,
        { k: "xG", v: dec(v("expected_goals")) },
        { k: "xGOT", v: dec(v("expected_goalsontarget")) },
        { k: P90("유효슛"), v: dec(v("ontarget_scoring_att")) },
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
  // 레전드 컷에 쓸 출전 시간. Card 에는 안 실리는 값이라 여기서 따로 들고 간다.
  const minsById = new Map<string, number>();
  for (const r of ratingList) {
    if (!r || r.ParticiantId == null || !r.ParticipantName) continue;
    if ((num(r.MinutesPlayed) ?? 0) < minMins) continue;
    const role = ROLE_BY_CODE[r.Positions?.[0] ?? -1];
    if (!role) continue;
    const get = (f: string) => stats[f]?.get(r.ParticiantId);
    const teamId = String(r.TeamId ?? "");
    const hero = HERO[r.ParticipantName];
    minsById.set(String(r.ParticiantId), num(r.MinutesPlayed) ?? 0);
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push({
      id: String(r.ParticiantId),
      name: KOREAN_NAME[r.ParticipantName] ?? r.ParticipantName,
      team: TEAM_KR[teamId] ?? r.TeamName ?? "",
      teamId,
      teamLogo: teamId ? `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png` : "",
      photo: hero
        ? `https://sports-phinf.pstatic.net/player/wfootball/default/${hero.photo}.png`
        : `https://images.fotmob.com/image_resources/playerimages/${r.ParticiantId}.png`,
      pos: POS_LABEL[role],
      back: hero?.back ?? "",
      role,
      // 등급과 대결 판정에 쓰는 값. 카드 8칸의 "평점" 칸은 보정 없는 원본을 보여준다.
      rating: r.StatValue + GOAL_BONUS * ((get("goals")?.StatValue ?? 0) + (get("goal_assist")?.StatValue ?? 0)),
      subName: r.ParticipantName,
      headline: headlineOf(role, get, r),
      stats: statsOf(role, get, r),
    });
  }
  return heroOnlyForLegend(
    promoteGlobalLegends([...byRole.values()].flatMap((cards) => assignTiers(cards)), minsById),
  );
}

/** HERO 사진의 FotMob 대체본. id 로만 만들어지므로 몇 번을 돌려도 결과가 같다. */
const facePhoto = (id: string) => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;

/**
 * 상반신 사진(HERO)은 레전드에만 남기고 나머지는 FotMob 얼굴 사진으로 되돌린다.
 *
 * 등급 배정이 다 끝난 뒤에 돌려야 한다. promoteGlobalLegends 가 역할군 1위를 에픽으로
 * 내리기도 해서, 그 전에 판단하면 방금 내려간 선수가 상반신 사진을 그대로 들고 간다.
 */
function heroOnlyForLegend(cards: Card[]): Card[] {
  return cards.map((c) => (c.tier === "LEGEND" ? c : { ...c, photo: facePhoto(c.id) }));
}

/**
 * 레전드만 역할군을 걷어내고 전체 평점 상위 3%로 다시 정한다.
 *
 * FotMob 평점은 포지션이 달라도 같은 척도라(6.2~8.03) 전체 비교가 성립한다. 역할군마다 1위를
 * 레전드로 두면 센터백 1위(7.37)가 미드필더 4위(7.51)보다 높은 등급을 받아 뒤집힌다.
 * KBO 는 이렇게 못 한다. WAR 은 타자 6.01 / 선발 3.89 / 불펜 2.02 로 척도가 달라서
 * 전체로 줄세우면 상위권이 통째로 타자가 되고 마무리투수는 영영 레전드가 안 된다.
 *
 * 에픽 아래는 역할군별 순위를 그대로 둔다. 그래야 골키퍼·센터백에서도 상위 등급이 나온다.
 * 역할군 1위였다가 전체 컷에 못 든 선수는 에픽으로 내린다.
 */
function promoteGlobalLegends(cards: Card[], minsById: Map<string, number>): Card[] {
  const cut = Math.max(1, Math.floor(cards.length * TIERS[0].pct));
  const legendIds = new Set(
    [...cards]
      .filter((c) => (minsById.get(c.id) ?? 0) >= LEGEND_MIN_MINS)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, cut)
      .map((c) => c.id),
  );
  return cards.map((c) =>
    legendIds.has(c.id) ? { ...c, tier: "LEGEND" as const } : c.tier === "LEGEND" ? { ...c, tier: "EPIC" as const } : c,
  );
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
