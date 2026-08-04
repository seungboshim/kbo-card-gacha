// 프리미어리그 25/26 시즌 선수 성적. Naver 스포츠 기록 API (비공식, 무인증)에서 시즌 누적 기록을 받아온다.
// KBO 어댑터와 같은 호스트/헤더.
//
// 알려진 한계: pageSize=500이 하드 상한이고 페이징이 없다. 501 이상을 주면 빈 배열이 오고,
// page/offset/teamId 파라미터는 전부 무시된다. 응답은 한글 이름 가나다순이라 "조렐 하토"에서 잘리고
// 그 뒤 선수(주앙 페드루, 코디 학포, 플로리안 비르츠, 후벵 디아스, 크리스티안 로메로, 콜 파머 등)가
// 통째로 빠진다. 실측으로 FotMob 포지션별 상위 13명 중 19%가 이 이유로 카드에 안 나온다.
//
// 우회로를 찾다 막힌 것들:
//   - /teams/{id}/players, /squads/{id} 등 팀별 경로는 헤더를 뭘 붙여도 403. 게이트웨이가 허용 목록에
//     없는 경로를 통째로 막는다(존재하지 않을 경로도 404가 아니라 403이 온다).
//   - 시즌을 바꿔도 500 제한은 같다. 2023/24~2026/27 네 시즌 전부 정확히 500명이고, 명단이 달라서
//     잘리는 지점만 옮겨간다(26/27은 "타일러 아담스"까지 와서 로메로가 들어오는 대신 살라가 빠진다).
//   - 시간이 지나도 안 늘어난다. 같은 시즌이면 늘 같은 500명이다.
// 전체를 받으려면 데이터 소스를 바꿔야 한다.

import { assignTiers, type Card, type SportConfig } from "../_game/deck.ts";

const SEASON_CODE = "lji9"; // 2025/26 시즌
const PLAYERS_URL = `https://api-gw.sports.naver.com/statistics/categories/epl/seasons/${SEASON_CODE}/players?pageSize=500`;

type Position = "GK" | "DF" | "MF" | "FW";

const ROLE_LABEL: Record<Position, string> = { GK: "골키퍼", DF: "수비수", MF: "미드필더", FW: "공격수" };
// 최소 출전(분). 필드 플레이어는 1500분(= 약 17경기 풀타임)으로 잡는다. 누적 지표라 출전이 적은
// 선수가 섞이면 순위가 흐려지지만, 더 올리면 풀이 줄어 등급 정원까지 같이 줄어든다. 1800분으로 하면
// 미드필더가 59→44명이 되면서 에픽 정원이 6→4명으로 깎여, 순위가 그대로인 라이스가 에픽에서 레어로
// 밀리고 셰르키(1786분)·로드리(1513분)·도쿠(1784분)는 카드 자체가 사라진다.
// 골키퍼는 22명뿐이고 커트를 올려도 상관이 안 변해서(전원 주전급) 낮게 둬 풀을 넓힌다.
const MIN_MINS: Record<Position, number> = { GK: 600, DF: 1500, MF: 1500, FW: 1500 };

// 구단 색: Naver teamId → 홈 유니폼 주색. 빨강/파랑/적갈색이 겹치는 팀은 색조를 조금씩 달리했다.
const TEAM_COLOR: Record<string, string> = {
  "1006": "#EF0107", // 아스널
  "11": "#6CABDD", // 맨체스터 시티
  "12": "#DA291C", // 맨체스터 유나이티드
  "2": "#670E36", // 애스턴 빌라
  "9": "#C8102E", // 리버풀
  "23": "#B50E12", // 본머스
  TTwjJb: "#E0521E", // 선덜랜드
  "6795": "#0057B8", // 브라이턴
  "48": "#C2185B", // 브렌트퍼드
  "4": "#034694", // 첼시
  "55": "#E5E7EB", // 풀럼
  "31": "#241F20", // 뉴캐슬 유나이티드
  "8": "#274488", // 에버턴
  Sa0VaD: "#FFCD00", // 리즈 유나이티드
  "5": "#1B458F", // 크리스털 팰리스
  "15": "#E2231A", // 노팅엄 포레스트
  "19": "#132257", // 토트넘 홋스퍼
  "43": "#8B2942", // 웨스트햄 유나이티드
  QqFyIw: "#5C2751", // 번리
  "44": "#FDB913", // 울버햄튼 원더러스
};

export const EPL: SportConfig = {
  key: "epl",
  title: "프리미어리그 카드깡",
  seasonLabel: "25/26",
  emblem: "⚽",
  packSub: "25/26 EPL",
  teamColor: TEAM_COLOR,
  miniStatKeys: (role) =>
    role === "공격수" ? ["골", "도움"] : role === "미드필더" ? ["도움", "키패스"] : role === "수비수" ? ["클린시트", "태클"] : ["클린시트", "세이브"],
  guide: {
    pool: "25/26 시즌 기록 중 최소 출전을 넘긴 선수만 나와요. 골키퍼 600분, 그 외 포지션 1500분.",
    tier: "포지션(골키퍼·수비수·미드필더·공격수) 안에서 활약도 순위로 갈라요. 그래서 골키퍼도 레전드가 될 수 있어요. 활약도는 골·도움·클린시트·패스 정확도 같은 기록으로 계산해요(공식 평점이 아니에요).",
  },
};

type Row = Record<string, unknown>;

// teamEmblemUrl은 선수마다 팀이 뒤섞여 온다(실측: 20팀 중 16팀이 팀당 파일명이 2~4종류로 섞여 있었다).
// teamId는 팀당 하나이고 /teams 목록과도 일치해 이걸로 직접 조립한다. teamId는 숫자거나(대부분) 영문자
// 문자열(번리 QqFyIw, 리즈 유나이티드 Sa0VaD, 선덜랜드 TTwjJb)이라 숫자로 파싱하지 않고 그대로 쓴다.
function teamLogoOf(teamId: string): string {
  return teamId ? `https://sports-phinf.pstatic.net/team/wfootball/default/${teamId}.png?type=f92_88` : "";
}

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

// 정수 스탯. 필드 자체가 없으면 -, 0이면 0
function int(x: unknown): string {
  const v = num(x);
  return v === null ? "-" : String(Math.trunc(v));
}

// 소수점 n자리. 값 없으면 -
function dec(x: unknown, n = 1): string {
  const v = num(x);
  return v === null ? "-" : v.toFixed(n);
}

/**
 * 포지션별 활약도. 등급을 가르는 역할군 내 순위에만 쓰이고 화면에는 안 나온다.
 * 그래서 역할마다 단위가 달라도 된다.
 *
 * 계수는 FotMob 포지션별 평점을 정답지로 두고 맞췄다(제약 랜덤서치 + 3-fold 교차검증).
 * 지금 커트(1500분)에서 순위상관이 공격수 0.09→0.62, 미드필더 0.34→0.58, 수비수 0.30→0.64로 올랐다.
 * 교차검증 test 상관은 0.79 / 0.64 / 0.49라 전체 최적값보다는 낮게 봐야 한다.
 *
 * 한계: Naver 는 선수 평점을 주지 않아(indexScore 가 500명 전부 빈다) 클래식 스탯으로 근사한다.
 * 드리블·크로스 기록이 없어 골 적은 윙어를 못 잡고(제레미 도쿠, 아마드 디알로가 하위권),
 * FotMob 이 나누는 풀백/중앙수비수와 스트라이커/윙어를 우리는 DF/FW 하나로 묶는다.
 */
function ratingOf(row: Row, pos: Position): number {
  const cs = num(row.cleanSheets) ?? 0;
  const saves = num(row.saves) ?? 0;
  const tackles = num(row.accurateTackles) ?? 0;
  const inter = num(row.interceptions) ?? 0;
  const clear = num(row.clearances) ?? 0;
  const recov = num(row.recoveries) ?? 0;
  const goals = num(row.goals) ?? 0;
  const assists = num(row.assists) ?? 0;
  const kp = num(row.keyPasses) ?? 0;
  const xa = num(row.expectedAssists) ?? 0;
  const xg = num(row.expectedGoals) ?? 0;
  const sot = num(row.shotsOnTarget) ?? 0;
  const passes = num(row.passes) ?? 0;
  const accurate = num(row.accuratePasses) ?? 0;
  // 패스 성공률. 볼을 지배하는 강팀 수비수·미드필더를 잡아내는 축이라 개수와 따로 넣는다.
  const passAcc = passes > 0 ? accurate / passes : 0;
  // 90분당 공격 포인트. FotMob 평점 자체가 90분당이라 누적 지표만으로는 안 맞는 부분을 메운다.
  const op90 = num(row.offencePointsPer90Min) ?? 0;
  switch (pos) {
    case "GK":
      return cs + 0.05 * saves;
    case "DF":
      // 태클·인터셉트·클리어는 계수가 거의 0으로 수렴했다. 팀 전술에 좌우돼서 평점을 설명하지 못한다.
      // 클리어 가중치를 크게 두면 걷어내기 바쁜 약팀 센터백이 위로 오고(살리바가 93명 중 14위였다),
      // 풀백은 통째로 밀린다(칼라피오리 63위). 클린시트·공격 기여·패스 정확도로 옮겨 둘 다 잡았다.
      return (
        1.5 * cs + 1.5 * (goals + assists) + 0.24 * xa + 0.06 * kp + 4 * passAcc + 0.012 * clear + 0.008 * (tackles + inter) + 0.001 * accurate + 0.004 * recov
      );
    case "MF":
      // 리커버리를 태클·인터셉트와 같은 계수로 묶으면 볼 회수량이 등급을 지배한다
      // (엘리엇 앤더슨이 리커버리 306으로 레전드였다). 떼어내 낮추고 패스 정확도를 넣었다.
      return 0.7 * goals + 0.9 * assists + 0.35 * xa + 0.024 * kp + 0.08 * (tackles + inter) + 0.02 * recov + 0.01 * accurate + 14.1 * passAcc + 4.2 * op90;
    case "FW":
      return goals + assists + 0.5 * xa + 0.1 * xg + 0.06 * kp + 0.04 * sot + 0.003 * accurate + 0.02 * recov + 0.04 * (tackles + inter) + op90;
  }
}

// 골키퍼 선방률(%). 세이브와 실점만 있어 유효슛 대비로 근사한다. 둘 다 0이면 표시할 게 없다.
function saveRate(row: Row): string {
  const saves = num(row.saves) ?? 0;
  const conceded = num(row.goalsConceded) ?? 0;
  const faced = saves + conceded;
  return faced > 0 ? `${((saves / faced) * 100).toFixed(0)}%` : "-";
}

// 기대 득점 대비 실제 득점. 양수면 기대보다 더 넣었다는 뜻.
function goalsOverXg(row: Row): string {
  const g = num(row.goals);
  const xg = num(row.expectedGoals);
  if (g === null || xg === null) return "-";
  const diff = g - xg;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}`;
}

function headlineOf(row: Row, pos: Position): string {
  const games = num(row.matchesPlayed) ?? 0;
  if (pos === "GK" || pos === "DF") return `${games}경기 · 클린시트 ${num(row.cleanSheets) ?? 0}`;
  return `${games}경기 · ${num(row.goals) ?? 0}골 ${num(row.assists) ?? 0}도움`;
}

// 8칸 전부 실제 기록이다. 활약도(rating)는 등급으로만 드러내고 숫자로는 안 보여준다.
// 우리가 합성한 값이라 "평점"처럼 읽히면 실제 평점으로 오해된다.
function statsOf(row: Row, pos: Position): { k: string; v: string }[] {
  switch (pos) {
    case "GK":
      return [
        { k: "경기", v: int(row.matchesPlayed) },
        { k: "클린시트", v: int(row.cleanSheets) },
        { k: "세이브", v: int(row.saves) },
        { k: "실점", v: int(row.goalsConceded) },
        { k: "선방률", v: saveRate(row) },
        { k: "박스내세이브", v: int(row.insideBoxSaves) },
        { k: "출전분", v: int(row.minsPlayed) },
        { k: "경고", v: int(row.yellowCards) },
      ];
    case "DF":
      return [
        { k: "경기", v: int(row.matchesPlayed) },
        { k: "클린시트", v: int(row.cleanSheets) },
        { k: "태클", v: int(row.accurateTackles) },
        { k: "인터셉트", v: int(row.interceptions) },
        { k: "클리어", v: int(row.clearances) },
        { k: "리커버리", v: int(row.recoveries) },
        { k: "골", v: int(row.goals) },
        { k: "도움", v: int(row.assists) },
      ];
    case "MF":
      return [
        { k: "경기", v: int(row.matchesPlayed) },
        { k: "골", v: int(row.goals) },
        { k: "도움", v: int(row.assists) },
        { k: "키패스", v: int(row.keyPasses) },
        { k: "xA", v: dec(row.expectedAssists) },
        { k: "태클", v: int(row.accurateTackles) },
        { k: "인터셉트", v: int(row.interceptions) },
        { k: "리커버리", v: int(row.recoveries) },
      ];
    case "FW":
      return [
        { k: "경기", v: int(row.matchesPlayed) },
        { k: "골", v: int(row.goals) },
        { k: "도움", v: int(row.assists) },
        { k: "슛", v: int(row.shots) },
        { k: "유효슛", v: int(row.shotsOnTarget) },
        { k: "xG", v: dec(row.expectedGoals) },
        { k: "xG차", v: goalsOverXg(row) },
        { k: "키패스", v: int(row.keyPasses) },
      ];
  }
}

function toCard(row: Row, pos: Position): Omit<Card, "tier"> {
  const rating = ratingOf(row, pos);
  const role = ROLE_LABEL[pos];
  const teamId = String(row.teamId ?? "");
  return {
    id: String(row.playerId),
    name: String(row.playerName),
    team: String(row.teamName ?? ""),
    teamId,
    teamLogo: teamLogoOf(teamId),
    photo: String(row.image ?? ""),
    pos: role,
    back: row.backNumber ? `#${row.backNumber}` : "",
    role,
    rating,
    headline: headlineOf(row, pos),
    stats: statsOf(row, pos),
  };
}

export async function getEplPool(): Promise<Card[]> {
  const res = await fetch(PLAYERS_URL, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://m.sports.naver.com/" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Naver 기록 API EPL 응답 ${res.status}`);
  const json = (await res.json()) as { result?: { seasonPlayerStats?: Row[] } };
  const rows = json.result?.seasonPlayerStats;
  if (!Array.isArray(rows)) throw new Error("Naver 기록 API EPL 응답 형식이 바뀌었어요");

  const pool = computeEplPool(rows);
  if (!pool.length) throw new Error("EPL 시즌 선수 기록이 비어 있어요");
  return pool;
}

/** fetch와 분리한 순수 계산부. 테스트에서 네트워크 없이 가짜 row로 검증한다. */
export function computeEplPool(rows: Row[]): Card[] {
  const byPos: Record<Position, Omit<Card, "tier">[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const row of rows) {
    if (!row || !row.playerId || !row.playerName) continue;
    const pos = row.position as Position;
    if (pos !== "GK" && pos !== "DF" && pos !== "MF" && pos !== "FW") continue;
    if ((num(row.minsPlayed) ?? 0) < MIN_MINS[pos]) continue;
    byPos[pos].push(toCard(row, pos));
  }
  const positions: Position[] = ["GK", "DF", "MF", "FW"];
  return positions.flatMap((p) => assignTiers(byPos[p]));
}
