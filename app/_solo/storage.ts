// 런 상태를 localStorage 에 둔다. 서버도 DB 도 로그인도 없다.
//
// 직렬화/역직렬화를 localStorage 접근과 갈라둔다. node --test 에는 localStorage 가 없어서
// 붙여두면 테스트를 못 한다. 껍데기 두 함수만 브라우저에 기댄다.

import { MAX_PLUS, START_CREDITS } from "./economy.ts";
import { type Owned } from "./vault.ts";

/** 형태를 바꾸면 올린다. 안 맞는 저장값은 버리고 새로 시작한다. */
const VERSION = 2;

/** 결과 화면에 늘어놓을 최고 기록 수. */
export const BEST_KEEP = 5;

export type Run = {
  v: number;
  /** "kbo-2026" 같은 시즌 키. 시즌마다 런이 따로 굴러간다. */
  season: string;
  credits: number;
  vault: Owned[];
  /** 이 런에서 도달한 상위 기록. 가치 내림차순. 강화 중에 터져도 남는다. */
  best: Owned[];
  over: boolean;
};

export const runKey = (season: string) => `cardgacha:run:${season}`;

export function newRun(season: string): Run {
  return { v: VERSION, season, credits: START_CREDITS, vault: [], best: [], over: false };
}

export const serializeRun = (run: Run): string => JSON.stringify(run);

/**
 * 모양과 범위를 같이 본다.
 *
 * 범위까지 보는 이유: 타입만 맞으면 통과시키면 plus 999 짜리 저장값이 그대로 들어와
 * 카드 값이 200자리 숫자로 그려진다. 손으로 고친 저장값은 통째로 버리고 새로 시작하는
 * 편이 반쯤 망가진 런을 굴리는 것보다 낫다.
 */
const isOwned = (x: unknown): x is Owned => {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Owned;
  return (
    typeof o.id === "string" &&
    Number.isInteger(o.plus) &&
    o.plus >= 0 &&
    o.plus <= MAX_PLUS
  );
};

/** 저장값을 Run 으로 되읽는다. 버전이나 모양이 안 맞으면 null 이고, 부르는 쪽이 새 런을 만든다. */
export function parseRun(raw: string | null): Run | null {
  if (!raw) return null;
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof x !== "object" || x === null) return null;
  const r = x as Partial<Run>;
  if (r.v !== VERSION) return null;
  if (typeof r.season !== "string") return null;
  if (!Number.isFinite(r.credits) || (r.credits as number) < 0) return null;
  if (!Array.isArray(r.vault) || !r.vault.every(isOwned)) return null;
  if (!Array.isArray(r.best) || !r.best.every(isOwned)) return null;
  if (typeof r.over !== "boolean") return null;
  return { v: r.v, season: r.season, credits: r.credits as number, vault: r.vault, best: r.best, over: r.over };
}

/**
 * 세 껍데기 모두 try 로 감싼다. `typeof localStorage === "undefined"` 만으로는 안 된다.
 *
 * 사파리에서 "모든 쿠키 차단"을 켜두면 localStorage 객체는 멀쩡히 있는데 읽고 쓰는 순간
 * SecurityError 를 던진다. 시크릿 모드나 저장 용량이 찼을 때는 setItem 이 QuotaExceededError
 * 를 던진다. 안 막으면 그 예외가 렌더를 타고 올라가 화면 전체가 죽는다. 폰에서 아무것도
 * 안 눌리는 증상이 이거였다.
 *
 * 저장을 못 하면 조용히 넘긴다. 새로고침하면 판이 날아가지만, 못 쓰는 화면보다는 낫다.
 */
export function loadRun(season: string): Run | null {
  try {
    return parseRun(localStorage.getItem(runKey(season)));
  } catch {
    return null;
  }
}

export function saveRun(run: Run): void {
  try {
    localStorage.setItem(runKey(run.season), serializeRun(run));
  } catch {
    // 저장 불가. 이번 판은 메모리에서만 굴러간다.
  }
}

export function clearRun(season: string): void {
  try {
    localStorage.removeItem(runKey(season));
  } catch {
    // 지울 게 없거나 못 지운다. 어느 쪽이든 부르는 쪽이 새 판으로 넘어간다.
  }
}
