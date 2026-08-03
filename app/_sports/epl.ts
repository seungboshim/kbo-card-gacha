// 프리미어리그 25/26 시즌 선수 성적. Naver 스포츠 기록 API (비공식, 무인증)에서 시즌 누적 기록을 받아온다.
// KBO 어댑터와 같은 호스트/헤더. page 파라미터는 안 먹혀서 pageSize=500(전체 고유 선수 수) 한 번만 부른다.

import { assignTiers, type Card, type SportConfig } from "../_game/deck.ts";

const SEASON_CODE = "lji9"; // 2025/26 시즌
const PLAYERS_URL = `https://api-gw.sports.naver.com/statistics/categories/epl/seasons/${SEASON_CODE}/players?pageSize=500`;

type Position = "GK" | "DF" | "MF" | "FW";

const ROLE_LABEL: Record<Position, string> = { GK: "골키퍼", DF: "수비수", MF: "미드필더", FW: "공격수" };
// 최소 출전(분). 골키퍼는 낮게 잡아 풀을 넓힌다.
const MIN_MINS: Record<Position, number> = { GK: 600, DF: 900, MF: 900, FW: 900 };

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
  miniStatKeys: (role) => (role === "공격수" ? ["골", "평점"] : role === "미드필더" ? ["도움", "평점"] : ["클린시트", "평점"]),
  guide: {
    pool: "25/26 시즌 기록 중 최소 출전을 넘긴 선수만 나와요. 골키퍼 600분, 그 외 포지션 900분.",
    tier: "포지션(골키퍼·수비수·미드필더·공격수) 안에서 활약도 순위로 갈라요. 그래서 수비형 골키퍼도 레전드가 될 수 있어요.",
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

/** 포지션별 활약도. 역할군 내 백분위에만 쓰이므로 단위가 달라도 된다. 누적 지표(90분당 X — 소표본에서 무너진다). */
function ratingOf(row: Row, pos: Position): number {
  const cs = num(row.cleanSheets) ?? 0;
  const saves = num(row.saves) ?? 0;
  const tackles = num(row.accurateTackles) ?? 0;
  const inter = num(row.interceptions) ?? 0;
  const clear = num(row.clearances) ?? 0;
  const goals = num(row.goals) ?? 0;
  const assists = num(row.assists) ?? 0;
  const kp = num(row.keyPasses) ?? 0;
  switch (pos) {
    case "GK":
      return cs + 0.05 * saves;
    case "DF":
      return 1.5 * cs + 0.1 * (tackles + inter + clear) + goals + assists;
    case "MF":
      return goals + assists + 0.15 * kp;
    case "FW":
      return goals + 0.7 * assists;
  }
}

function headlineOf(row: Row, pos: Position): string {
  const games = num(row.matchesPlayed) ?? 0;
  if (pos === "GK" || pos === "DF") return `${games}경기 · 클린시트 ${num(row.cleanSheets) ?? 0}`;
  return `${games}경기 · ${num(row.goals) ?? 0}골 ${num(row.assists) ?? 0}도움`;
}

function statsOf(row: Row, pos: Position, rating: number): { k: string; v: string }[] {
  const idx = { k: "평점", v: rating.toFixed(1) };
  switch (pos) {
    case "GK":
      return [
        { k: "경기", v: int(row.matchesPlayed) },
        { k: "클린시트", v: int(row.cleanSheets) },
        { k: "세이브", v: int(row.saves) },
        { k: "실점", v: int(row.goalsConceded) },
        { k: "박스내세이브", v: int(row.insideBoxSaves) },
        { k: "출전분", v: int(row.minsPlayed) },
        { k: "경고", v: int(row.yellowCards) },
        idx,
      ];
    case "DF":
      return [
        { k: "경기", v: int(row.matchesPlayed) },
        { k: "클린시트", v: int(row.cleanSheets) },
        { k: "태클", v: int(row.accurateTackles) },
        { k: "인터셉트", v: int(row.interceptions) },
        { k: "클리어", v: int(row.clearances) },
        { k: "골", v: int(row.goals) },
        { k: "도움", v: int(row.assists) },
        idx,
      ];
    case "MF":
      return [
        { k: "경기", v: int(row.matchesPlayed) },
        { k: "골", v: int(row.goals) },
        { k: "도움", v: int(row.assists) },
        { k: "키패스", v: int(row.keyPasses) },
        { k: "xA", v: dec(row.expectedAssists) },
        { k: "태클", v: int(row.accurateTackles) },
        { k: "리커버리", v: int(row.recoveries) },
        idx,
      ];
    case "FW":
      return [
        { k: "경기", v: int(row.matchesPlayed) },
        { k: "골", v: int(row.goals) },
        { k: "도움", v: int(row.assists) },
        { k: "슛", v: int(row.shots) },
        { k: "유효슛", v: int(row.shotsOnTarget) },
        { k: "xG", v: dec(row.expectedGoals) },
        { k: "키패스", v: int(row.keyPasses) },
        idx,
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
    stats: statsOf(row, pos, rating),
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
  return [...assignTiers(byPos.GK), ...assignTiers(byPos.DF), ...assignTiers(byPos.MF), ...assignTiers(byPos.FW)];
}
