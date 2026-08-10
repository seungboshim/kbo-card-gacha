// 런 상태를 localStorage 에 둔다. 서버도 DB 도 로그인도 없다.
//
// 직렬화/역직렬화를 localStorage 접근과 갈라둔다. node --test 에는 localStorage 가 없어서
// 붙여두면 테스트를 못 한다. 껍데기 두 함수만 브라우저에 기댄다.

import { MAX_PLUS, START_CREDITS } from "./economy.ts";
import { type Owned } from "./vault.ts";
import { BASEBALL_SLOTS, FORMATIONS, FORMATION_SLOTS, type Formation, type Squad } from "./squad.ts";

/** 형태를 바꾸면 올린다. 안 맞는 저장값은 버리고 새로 시작한다. */
const VERSION = 4;

/**
 * 야구인지 축구인지는 시즌 키 접두사로 가른다. season 은 항상 "kbo-2026" 처럼
 * "{종목}-{시즌id}" 모양이다(app/_sports/seasons.ts 의 seasonKey). 종목을 매개변수로
 * 따로 안 받는 이유: newRun·parseRun 은 이미 season 문자열(또는 그 안에 실린 것)을
 * 갖고 있으니 호출부가 아는 값을 또 넘기게 하지 않으려는 것이다. 시즌 id 에 하이픈이
 * 들어가는 종목이 생기면 이 파싱부터 고쳐야 한다.
 */
const isFootball = (season: string) => season.startsWith("epl-");

/**
 * 최고 기록 후보를 가치순·강화순 각 기준으로 몇 장까지 남길지(solo.tsx 의 mergeBest).
 * 두 기준 각 상위 BEST_KEEP 장의 합집합을 저장하므로 실제로는 최대 2배까지 쌓인다.
 * 결과 화면(result.tsx)은 그중 각 줄에 3장만 보여준다 — 저장은 넉넉히 두 기준 다
 * 챙기고, 화면은 한 줄에 다 들어오게 짧게 자른다.
 *
 * 저장 형태(Owned[])가 안 바뀌어 VERSION 은 그대로 둔다. 예전처럼 가치순 다섯 장만
 * 든 저장값이 섞여 들어오면 강화순 줄이 한동안 빈약하게 보일 수 있지만, 판이
 * 이어지면 mergeBest 가 새 카드를 더할 때마다 강화순 후보도 저절로 채워진다.
 */
export const BEST_KEEP = 5;

/**
 * 스쿼드 한 벌의 박제. Run.bestSquad 에 쓴다 - 스쿼드만 저장하면 슬롯 id 가 무슨
 * 자리인지 못 찾는다(슬롯 id 는 포메이션마다 다르게 짓는다, squad.ts). 그때의
 * 포메이션과 가치까지 통째로 같이 담아야 결산 화면이 그대로 그릴 수 있다.
 */
export type SquadRecord = {
  squad: Squad;
  /** 축구만 쓴다. 야구는 포메이션 개념이 없다. */
  formation?: Formation;
  value: number;
};

export type Run = {
  v: number;
  /** "kbo-2026" 같은 시즌 키. 시즌마다 런이 따로 굴러간다. */
  season: string;
  credits: number;
  vault: Owned[];
  /** 이 런에서 도달한 상위 기록. 가치 내림차순. 강화 중에 터져도 남는다. */
  best: Owned[];
  over: boolean;
  /** 슬롯 id → 꽂힌 카드. 전시용이라 경제(팩값·강화비·파산)엔 영향이 없다(squad.ts). */
  squad: Squad;
  /** 축구만 쓴다. 야구는 슬롯이 고정이라 포메이션 개념이 없다. */
  formation?: Formation;
  /**
   * 스쿼드 가치가 이 런에서 도달한 최고 기록. 결산 화면(result.tsx)은 지금 스쿼드가
   * 아니라 이걸 그린다. 판매·강화로 스쿼드가 줄어도 이 값은 안 바뀐다 - "그때
   * 그랬다"의 박제지 지금 상태의 거울이 아니다(solo.tsx 의 withSquadValue).
   */
  bestSquad: SquadRecord;
  /** 방금 전 스쿼드 가치. 다음 변동에서 오르고 내림을 재는 기준이다(squad-panel.tsx). */
  prevSquadValue: number;
};

export const runKey = (season: string) => `cardgacha:run:${season}`;

export function newRun(season: string): Run {
  const football = isFootball(season);
  return {
    v: VERSION,
    season,
    credits: START_CREDITS,
    vault: [],
    best: [],
    over: false,
    squad: {},
    ...(football ? { formation: FORMATIONS[0] } : {}),
    bestSquad: { squad: {}, value: 0, ...(football ? { formation: FORMATIONS[0] } : {}) },
    prevSquadValue: 0,
  };
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

/**
 * 슬롯 id → Owned 모양과, 그 id 가 이 종목에 실제로 있는 슬롯인지를 함께 본다.
 * 모르는 슬롯 id(옛 포메이션이 걷어낸 자리 등)가 하나라도 섞여 있으면 통째로 버린다
 * - isOwned 가 plus 999 를 막는 것과 같은 이유다.
 */
const isValidSquad = (x: unknown, validIds: Set<string>): x is Squad =>
  typeof x === "object" && x !== null && Object.entries(x).every(([id, o]) => validIds.has(id) && isOwned(o));

/**
 * 시즌과 포메이션 후보로 유효한 슬롯 id 집합을 구한다. 축구인데 포메이션이 없거나
 * 모르는 값이면 null. top-level squad 검증과 bestSquad 검증이 같은 로직을 타서
 * 함수로 뽑았다 - bestSquad 는 지금과 다른 포메이션을 박제하고 있을 수 있다(그
 * 기록을 세운 뒤 유저가 포메이션을 바꿨을 수 있어서) 각자 따로 검증해야 한다.
 */
function resolveSlots(
  season: string,
  formationCandidate: unknown,
): { formation?: Formation; validIds: Set<string> } | null {
  if (isFootball(season)) {
    if (typeof formationCandidate !== "string" || !(FORMATIONS as readonly string[]).includes(formationCandidate)) {
      return null;
    }
    const formation = formationCandidate as Formation;
    return { formation, validIds: new Set(FORMATION_SLOTS[formation].map((s) => s.id)) };
  }
  return { validIds: new Set(BASEBALL_SLOTS.map((s) => s.id)) };
}

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

  // 축구는 포메이션을 먼저 확인해야 그 포메이션의 슬롯 id 로 스쿼드를 검증할 수 있다.
  // 야구는 슬롯이 고정이라 포메이션이 없다.
  const resolved = resolveSlots(r.season, r.formation);
  if (!resolved) return null;
  if (!isValidSquad(r.squad, resolved.validIds)) return null;

  if (!Number.isFinite(r.prevSquadValue) || (r.prevSquadValue as number) < 0) return null;

  // bestSquad 도 squad 와 똑같이(모르는 슬롯 id·모르는 포메이션이면 통째로 버리기) 본다.
  // 그때 박제한 포메이션이 지금 formation 과 다를 수 있어 따로 resolveSlots 를 부른다.
  if (typeof r.bestSquad !== "object" || r.bestSquad === null) return null;
  const bs = r.bestSquad as Partial<SquadRecord>;
  if (!Number.isFinite(bs.value) || (bs.value as number) < 0) return null;
  const bsResolved = resolveSlots(r.season, bs.formation);
  if (!bsResolved) return null;
  if (!isValidSquad(bs.squad, bsResolved.validIds)) return null;

  return {
    v: r.v,
    season: r.season,
    credits: r.credits as number,
    vault: r.vault,
    best: r.best,
    over: r.over,
    squad: r.squad,
    ...(resolved.formation ? { formation: resolved.formation } : {}),
    bestSquad: {
      squad: bs.squad as Squad,
      value: bs.value as number,
      ...(bsResolved.formation ? { formation: bsResolved.formation } : {}),
    },
    prevSquadValue: r.prevSquadValue as number,
  };
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
