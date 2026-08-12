// 시즌 목록. 메타데이터만 담아서 클라이언트 컴포넌트에서 읽어도 안전하게 둔다.
// JSON 로더는 app/_sports/pools.ts 에 따로 있다. 여기에 같이 두면 130KB 짜리 카드
// 데이터가 브라우저 번들에 딸려 들어갈 위험이 있다.

export type Season = {
  /** URL 세그먼트로 그대로 쓴다 */
  id: string;
  sport: "kbo" | "epl";
  /** 화면 표기 */
  label: string;
  /**
   * 깃액션이 매일 다시 굽는 대상인가. 시즌이 끝나면 손으로 false 로 바꾼다.
   * 1년에 두 번 있는 일이라 자동화하지 않는다.
   */
  live: boolean;
};

export const SEASONS: Season[] = [
  { id: "2026", sport: "kbo", label: "2026", live: true },
  { id: "2526", sport: "epl", label: "25/26", live: false },
];

/** data/<key>.json 과 pools.ts 의 키. */
export const seasonKey = (s: Pick<Season, "sport" | "id">) => `${s.sport}-${s.id}`;

/**
 * 화면에 쓰는 종목 표시 정보. SportConfig(kbo.ts/epl.ts)에도 비슷한 게 있지만 그쪽은
 * 함수 필드를 물고 있어 클라이언트로 못 넘어간다. 메인화면이 쓸 수 있게 여기 따로 둔다.
 */
export const SPORT: Record<Season["sport"], { name: string; emblem: string }> = {
  kbo: { name: "KBO", emblem: "⚾" },
  epl: { name: "프리미어리그", emblem: "⚽" },
};

export const SPORT_KEYS = Object.keys(SPORT) as Season["sport"][];

export const seasonsOf = (sport: Season["sport"]) => SEASONS.filter((s) => s.sport === sport);

/** 중간 선택 화면 없이 종목 URL로 들어왔을 때 보낼 대표 시즌. 라이브를 먼저 고른다. */
export const defaultSeasonOf = (sport: Season["sport"]) => {
  const seasons = seasonsOf(sport);
  return seasons.find((season) => season.live) ?? seasons.at(-1);
};

/** 라이브 시즌을 하나라도 가진 종목인가. 메인화면의 LIVE 배지가 이걸 따라간다. */
export const hasLive = (sport: Season["sport"]) => seasonsOf(sport).some((s) => s.live);
