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
