// 런 상태를 localStorage 에 둔다. 서버도 DB 도 로그인도 없다.
//
// 직렬화/역직렬화를 localStorage 접근과 갈라둔다. node --test 에는 localStorage 가 없어서
// 붙여두면 테스트를 못 한다. 껍데기 두 함수만 브라우저에 기댄다.

import { MAX_PLUS, START_CREDITS } from "./economy.ts";
import { type Owned } from "./vault.ts";

/** 형태를 바꾸면 올린다. 안 맞는 저장값은 버리고 새로 시작한다. */
const VERSION = 1;

export type Run = {
  v: number;
  /** "kbo-2026" 같은 시즌 키. 시즌마다 런이 따로 굴러간다. */
  season: string;
  credits: number;
  vault: Owned[];
  /** 이 런에서 도달한 최고 카드. 강화 중에 터져도 기록은 남는다. */
  best: { id: string; plus: number } | null;
  over: boolean;
};

export const runKey = (season: string) => `cardgacha:run:${season}`;

export function newRun(season: string): Run {
  return { v: VERSION, season, credits: START_CREDITS, vault: [], best: null, over: false };
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
  if (r.best !== null && !isOwned(r.best)) return null;
  if (typeof r.over !== "boolean") return null;
  return { v: r.v, season: r.season, credits: r.credits as number, vault: r.vault, best: r.best, over: r.over };
}

/** 브라우저에서만 동작한다. 서버 렌더 중에는 null 을 준다. */
export function loadRun(season: string): Run | null {
  if (typeof localStorage === "undefined") return null;
  return parseRun(localStorage.getItem(runKey(season)));
}

export function saveRun(run: Run): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(runKey(run.season), serializeRun(run));
}

export function clearRun(season: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(runKey(season));
}
