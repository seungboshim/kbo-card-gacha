# 데이터 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드 풀을 런타임 fetch 에서 저장소에 커밋된 JSON 으로 옮기고, 깃액션이 라이브 시즌을 매일 다시 구우며, 어제 대비 등급 변동을 데이터에 담는다.

**Architecture:** `scripts/snapshot.ts` 가 기존 `getKboPool()` / `getEplPool()` 을 그대로 호출해 완성된 `Card[]` 를 `data/<sport>-<season>.json` 에 쓴다. 쓰기 전에 기존 파일의 등급과 비교해 바뀐 카드에만 `prevTier` 를 박는다. 앱은 fetch 대신 이 JSON 을 읽는다. 깃액션이 매일 스크립트를 돌리고 변경분을 커밋하면 Vercel 이 재배포한다.

**Tech Stack:** Next.js 16, React 19, TypeScript. 테스트는 `node --test` (Node 24 타입 스트리핑). 새 의존성 없음.

이 계획이 끝나면 기존 카드깡 게임이 지금과 똑같이 동작하되 데이터 출처만 바뀐다. 라우팅과 혼자서 모드는 다음 계획에서 다룬다.

**설계 문서:** `docs/superpowers/specs/2026-08-05-solo-mode-design.md`

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `app/_sports/seasons.ts` | 시즌 매니페스트. 메타데이터만 담아 클라이언트에서 읽어도 안전하다 |
| `app/_sports/pools.ts` | 시즌 키 → JSON 로더. 서버 전용 |
| `scripts/prev-tier.ts` | 등급 변동 계산 순수 함수 |
| `scripts/snapshot.ts` | 스냅샷 실행부. 파일 읽기·쓰기와 시즌 순회 |
| `snapshot.test.ts` | `prev-tier.ts` 테스트 |
| `data/kbo-2026.json` | KBO 카드 풀 (스크립트 생성물) |
| `data/epl-2526.json` | EPL 카드 풀 (스크립트 생성물) |
| `.github/workflows/daily.yml` | 매일 스냅샷 갱신 |

**수정**

| 파일 | 무엇을 |
|---|---|
| `app/_game/deck.ts` | `Card` 에 `prevTier?: TierKey` 추가 |
| `app/_sports/kbo.ts` | 최소 출전 커트를 상수로 고정, `meetsMinimum` 을 export, 안내 문구 갱신 |
| `app/kbo/page.tsx` | fetch 대신 JSON 읽기 |
| `app/epl/page.tsx` | fetch 대신 JSON 읽기 |
| `deck.test.ts` | `meetsMinimum` 테스트 추가 |
| `package.json` | test 스크립트에 `snapshot.test.ts` 추가 |

`prev-tier.ts` 와 `snapshot.ts` 를 가르는 이유는, 실행부에 top-level await 가 들어가서 테스트가 import 하면 스크립트가 통째로 돌아버리기 때문이다. 순수 함수만 따로 두면 테스트가 네트워크와 파일시스템을 안 탄다.

---

### Task 1: KBO 최소 출전 커트를 상수로 고정

지금은 팀 경기수(응답의 최다 출전 경기수)에 비례해 커트가 매일 올라간다. 그러면 보관함에 담아둔 선수가 다음에 열었을 때 풀에서 빠질 수 있다. 2026-08-05 실측 기준(팀 경기수 103)으로 굳혀서 한 번 들어온 선수가 계속 남게 한다.

**Files:**
- Modify: `app/_sports/kbo.ts:36` (안내 문구), `app/_sports/kbo.ts:41-44` (상수), `app/_sports/kbo.ts:215-239` (`getKboPool`)
- Test: `deck.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`deck.test.ts` 의 import 줄(14번째 줄)을 이렇게 바꾼다.

```ts
import { parseInnings, meetsMinimum } from "./app/_sports/kbo.ts";
```

파일 맨 아래에 테스트를 더한다.

```ts
test("KBO 최소 출전: 타자는 124타석, 선발 31이닝, 불펜 21이닝으로 고정", () => {
  // 타자는 타수+볼넷+몸에맞는공으로 타석을 센다
  const hitter = (pa: number) => ({ hitterAb: pa, hitterBb: 0, hitterHp: 0 });
  assert.equal(meetsMinimum(hitter(124), "타자", 0), true);
  assert.equal(meetsMinimum(hitter(123), "타자", 0), false);

  // 투수는 이닝만 본다 (row 는 안 쓰지만 시그니처를 맞춘다)
  assert.equal(meetsMinimum({}, "선발", 31), true);
  assert.equal(meetsMinimum({}, "선발", 30.9), false);
  assert.equal(meetsMinimum({}, "불펜", 21), true);
  assert.equal(meetsMinimum({}, "불펜", 20.9), false);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test --test-name-pattern "최소 출전" deck.test.ts`
Expected: FAIL. `SyntaxError` 또는 `meetsMinimum is not a function` 계열 오류가 난다.

- [ ] **Step 3: 상수와 함수를 만든다**

`app/_sports/kbo.ts:41-44` 를 통째로 바꾼다.

```ts
// 최소 출전 기준. 2026-08-05 시점의 팀 경기수 103 에 예전 비율(타자 1.2타석/경기,
// 선발 0.3이닝, 불펜 0.2이닝)을 곱해 나온 값으로 굳혔다. 경기수 상위 분포가
// 103·101·101·101·100 이라 최다 출전이 이상치가 아닌 것도 확인했다.
//
// 비례식으로 두면 시즌이 갈수록 커트가 올라가서, 보관함에 담아둔 선수가 다음에 열었을 때
// 풀에서 빠질 수 있다. 누적 기록은 줄지 않으므로 고정해두면 한 번 들어온 선수는
// 부상으로 시즌을 접어도 계속 남는다.
const MIN_PA = 124;
const MIN_IP = { 선발: 31, 불펜: 21 } as const;
```

`plateApp` 정의(94-97번째 줄) **아래에** 함수를 더한다. `plateApp` 보다 먼저 두면 참조 순서가 꼬인다.

```ts
/** 최소 출전을 넘겼는지. ip 는 투수만 쓰고 타자일 때는 무시한다. */
export function meetsMinimum(row: Row, role: Role, ip: number): boolean {
  return role === "타자" ? plateApp(row) >= MIN_PA : ip >= MIN_IP[role];
}
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node --test --test-name-pattern "최소 출전" deck.test.ts`
Expected: PASS

- [ ] **Step 5: `getKboPool` 이 새 함수를 쓰게 바꾼다**

`app/_sports/kbo.ts` 의 `getKboPool` 안에서 `teamGames` 를 계산하는 줄과 그걸 쓰는 두 곳을 바꾼다.

이 세 줄을

```ts
  // 팀 경기수: 응답이 따로 주지 않아 최다 출전 경기수로 근사한다. 매 경기 나오는 선수가 팀마다 있다.
  // 시즌 시작 전이면 0이 되어 커트도 0이 된다(전원 통과).
  const teamGames = Math.max(0, ...hitterRows.map((r) => num(r.hitterGameCount) ?? 0));
  const lgWoba = leagueWoba(hitterRows);
```

이렇게 줄인다.

```ts
  const lgWoba = leagueWoba(hitterRows);
```

타자 커트를

```ts
  const hitters = hitterRows.filter((r) => plateApp(r) >= teamGames * MIN_PA_PER_GAME).map((r) => toHitter(r, lgWoba));
```

이렇게 바꾼다.

```ts
  const hitters = hitterRows.filter((r) => meetsMinimum(r, "타자", 0)).map((r) => toHitter(r, lgWoba));
```

투수 커트를

```ts
    if (ip >= teamGames * MIN_IP_PER_GAME[role]) (role === "선발" ? starters : relievers).push(toPitcher(row, role, ip));
```

이렇게 바꾼다.

```ts
    if (meetsMinimum(row, role, ip)) (role === "선발" ? starters : relievers).push(toPitcher(row, role, ip));
```

- [ ] **Step 6: 안내 문구를 사실에 맞춘다**

`app/_sports/kbo.ts:36` 의 `guide.pool` 을 바꾼다. 화면의 `(?)` 툴팁에 그대로 나가는 문장이라 커트가 바뀌면 같이 고쳐야 한다.

```ts
    pool: `${SEASON} 시즌 기록 중 타자는 124타석, 선발은 31이닝, 불펜은 21이닝 이상 뛴 선수만 나와요.`,
```

- [ ] **Step 7: 타입체크와 전체 테스트를 돌린다**

Run: `npm test && npx tsc --noEmit`
Expected: 테스트 전부 PASS, 타입 오류 없음. `MIN_PA_PER_GAME` / `MIN_IP_PER_GAME` / `teamGames` 가 남아 있으면 "선언했지만 안 쓴다" 오류가 난다. 남았으면 지운다.

- [ ] **Step 8: 커밋**

```bash
git add app/_sports/kbo.ts deck.test.ts
git commit -m "KBO 최소 출전 커트를 상수로 고정한다"
```

---

### Task 2: `Card` 에 `prevTier` 를 더하고 등급 변동을 계산한다

라이브 시즌은 매일 등급이 움직인다. 어제와 달라진 카드에만 `prevTier` 를 박아서 화면이 오른 건지 내린 건지 그릴 수 있게 한다.

**Files:**
- Modify: `app/_game/deck.ts:22-38` (`Card` 타입)
- Create: `scripts/prev-tier.ts`
- Create: `snapshot.test.ts`
- Modify: `package.json:8` (test 스크립트)

- [ ] **Step 1: `Card` 에 필드를 더한다**

`app/_game/deck.ts` 의 `Card` 타입에서 `tier: TierKey;` 바로 아래에 넣는다.

```ts
  tier: TierKey;
  /**
   * 직전 스냅샷의 등급. 등급이 실제로 바뀐 카드에만 들어간다(그대로면 아예 없다).
   * 라이브 시즌에서 어제 대비 올랐는지 내렸는지 화살표를 그리는 데 쓴다.
   */
  prevTier?: TierKey;
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`snapshot.test.ts` 를 새로 만든다.

```ts
// node --test snapshot.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { withPrevTier } from "./scripts/prev-tier.ts";
import type { Card, TierKey } from "./app/_game/deck.ts";

const card = (id: string, tier: TierKey, prevTier?: TierKey): Card => ({
  id,
  name: id,
  team: "",
  teamId: "",
  teamLogo: "",
  photo: "",
  pos: "",
  back: "",
  role: "",
  rating: 0,
  tier,
  ...(prevTier ? { prevTier } : {}),
  headline: "",
  stats: [],
});

test("등급이 바뀐 카드에만 prevTier 가 붙는다", () => {
  const before = [card("a", "RARE"), card("b", "EPIC")];
  const after = withPrevTier([card("a", "EPIC"), card("b", "EPIC")], before);
  assert.equal(after[0].prevTier, "RARE");
  assert.equal(after[1].prevTier, undefined);
});

test("내려간 등급도 그대로 기록한다", () => {
  const after = withPrevTier([card("a", "COMMON")], [card("a", "LEGEND")]);
  assert.equal(after[0].prevTier, "LEGEND");
});

test("어제 없던 카드는 prevTier 가 없다", () => {
  const after = withPrevTier([card("새로운", "RARE")], [card("a", "EPIC")]);
  assert.equal(after[0].prevTier, undefined);
});

test("직전 스냅샷의 prevTier 는 이어받지 않는다", () => {
  // 어제 EPIC→RARE 로 내려간 카드가 오늘도 RARE 면 변동이 없으므로 표시를 떼야 한다.
  const before = [card("a", "RARE", "EPIC")];
  const after = withPrevTier([card("a", "RARE")], before);
  assert.equal(after[0].prevTier, undefined);
});

test("이전 스냅샷이 비어 있으면 아무것도 안 붙는다", () => {
  const after = withPrevTier([card("a", "RARE"), card("b", "EPIC")], []);
  assert.equal(after[0].prevTier, undefined);
  assert.equal(after[1].prevTier, undefined);
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `node --test snapshot.test.ts`
Expected: FAIL. `Cannot find module './scripts/prev-tier.ts'`

- [ ] **Step 4: 최소 구현을 쓴다**

`scripts/prev-tier.ts` 를 만든다.

```ts
// 스냅샷을 새로 구울 때 어제 등급과 비교해 변동을 기록한다.
// 실행부(snapshot.ts)와 갈라둬서 테스트가 네트워크와 파일시스템을 안 타게 한다.

import type { Card } from "../app/_game/deck.ts";

/**
 * 등급이 바뀐 카드에만 prevTier 를 박아서 돌려준다.
 *
 * 비교 기준은 이전 스냅샷의 tier 이지 prevTier 가 아니다. 그래야 어제 내려간 카드가
 * 오늘 그대로일 때 표시가 떨어진다.
 */
export function withPrevTier(fresh: Card[], previous: Card[]): Card[] {
  const before = new Map(previous.map((c) => [c.id, c.tier]));
  return fresh.map((c) => {
    const was = before.get(c.id);
    return was && was !== c.tier ? { ...c, prevTier: was } : c;
  });
}
```

- [ ] **Step 5: 테스트 통과를 확인한다**

Run: `node --test snapshot.test.ts`
Expected: 5개 PASS

- [ ] **Step 6: test 스크립트에 파일을 더한다**

`package.json` 의 `scripts.test` 를 바꾼다.

```json
    "test": "node --test deck.test.ts battle.test.ts snapshot.test.ts"
```

- [ ] **Step 7: 전체 테스트를 돌린다**

Run: `npm test`
Expected: 세 파일 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add app/_game/deck.ts scripts/prev-tier.ts snapshot.test.ts package.json
git commit -m "등급 변동을 기록할 prevTier 를 더한다"
```

---

### Task 3: 시즌 매니페스트

시즌을 한 곳에서 관리한다. 앞으로 시즌을 추가하거나 라이브를 끄는 것이 이 배열 한 줄로 끝나야 한다.

**Files:**
- Create: `app/_sports/seasons.ts`

- [ ] **Step 1: 매니페스트를 쓴다**

```ts
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add app/_sports/seasons.ts
git commit -m "시즌 매니페스트를 만든다"
```

---

### Task 4: 스냅샷 스크립트

**Files:**
- Create: `scripts/snapshot.ts`

- [ ] **Step 1: 스크립트를 쓴다**

```ts
// 시즌 카드 풀을 구워 data/<key>.json 에 쓴다. 깃액션이 매일 돌린다.
//
// 라이브 시즌은 매번 덮어쓰고, 끝난 시즌은 파일이 없을 때만 굽는다. 그래서 처음 한 번
// 돌리면 두 시즌이 다 생기고, 이후로는 KBO 만 갱신된다. 플래그가 필요 없다.
//
// 실행: node scripts/snapshot.ts

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SEASONS, seasonKey, type Season } from "../app/_sports/seasons.ts";
import { getKboPool } from "../app/_sports/kbo.ts";
import { getEplPool } from "../app/_sports/epl.ts";
import { withPrevTier } from "./prev-tier.ts";
import type { Card } from "../app/_game/deck.ts";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");

const FETCHERS: Record<Season["sport"], () => Promise<Card[]>> = {
  kbo: getKboPool,
  epl: getEplPool,
};

/** 없으면 빈 배열. 첫 실행이거나 파일이 깨졌을 때도 그냥 새로 굽는다. */
async function readExisting(file: string): Promise<Card[] | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Card[];
  } catch {
    return null;
  }
}

await mkdir(DATA_DIR, { recursive: true });

for (const season of SEASONS) {
  const key = seasonKey(season);
  const file = path.join(DATA_DIR, `${key}.json`);
  const existing = await readExisting(file);

  if (!season.live && existing) {
    console.log(`${key}: 끝난 시즌이고 파일이 있어 건너뛴다`);
    continue;
  }

  const fresh = await FETCHERS[season.sport]();
  const pool = withPrevTier(fresh, existing ?? []);
  const moved = pool.filter((c) => c.prevTier).length;

  await writeFile(file, JSON.stringify(pool), "utf8");
  console.log(`${key}: 카드 ${pool.length}장, 등급 변동 ${moved}장 → ${path.relative(process.cwd(), file)}`);
}
```

- [ ] **Step 2: 실제로 돌려본다**

Run: `node scripts/snapshot.ts`
Expected: 이런 두 줄이 나온다. 첫 실행이라 등급 변동은 0장이다.

```
kbo-2026: 카드 269장, 등급 변동 0장 → data/kbo-2026.json
epl-2526: 카드 233장, 등급 변동 0장 → data/epl-2526.json
```

카드 수는 시즌이 진행되면 달라진다. 269 / 233 은 2026-08-05 실측값이라 근처면 정상이다. 네트워크 오류가 나면 잠시 뒤 다시 돌린다.

- [ ] **Step 3: 두 번 돌려서 건너뛰기가 되는지 본다**

Run: `node scripts/snapshot.ts`
Expected: EPL 줄이 `epl-2526: 끝난 시즌이고 파일이 있어 건너뛴다` 로 바뀐다. KBO 는 다시 굽는다.

- [ ] **Step 4: 파일 크기를 확인한다**

Run: `ls -la data/`
Expected: 두 파일 다 100~200KB 범위. 0바이트거나 1KB 미만이면 뭔가 잘못된 것이므로 멈추고 원인을 찾는다.

- [ ] **Step 5: 커밋**

데이터 파일은 다음 Task 에서 앱이 읽어야 하므로 같이 커밋한다.

```bash
git add scripts/snapshot.ts data/kbo-2026.json data/epl-2526.json
git commit -m "카드 풀을 저장소 JSON 으로 굽는 스냅샷 스크립트를 만든다"
```

---

### Task 5: 앱이 JSON 을 읽게 전환한다

**Files:**
- Create: `app/_sports/pools.ts`
- Modify: `app/kbo/page.tsx` (전체)
- Modify: `app/epl/page.tsx` (전체)

- [ ] **Step 1: 로더를 만든다**

`app/_sports/pools.ts`

```ts
// 시즌 키 → 카드 풀. 서버 전용이다. 클라이언트 컴포넌트에서 import 하면 카드 데이터가
// 통째로 브라우저 번들에 들어간다.
//
// 경로에 변수를 넣어 동적으로 import 하면 번들러가 data/ 폴더 전체를 끌어오므로
// 시즌마다 한 줄씩 명시한다. 시즌을 추가할 때 seasons.ts 와 여기 두 곳을 고친다.

import type { Card } from "../_game/deck";

// 반환 타입을 unknown 으로 받는 이유: tsconfig 의 resolveJsonModule 이 켜져 있어서
// JSON 을 import 하면 파일 내용 그대로의 리터럴 타입이 잡힌다. tier 가 TierKey 가 아니라
// string 으로 추론되므로 Card[] 로 바로 캐스팅하면 타입이 안 겹친다고 거부당한다.
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  "kbo-2026": () => import("../../data/kbo-2026.json"),
  "epl-2526": () => import("../../data/epl-2526.json"),
};

export async function loadPool(key: string): Promise<Card[]> {
  const load = LOADERS[key];
  if (!load) throw new Error(`알 수 없는 시즌: ${key}`);
  return (await load()).default as Card[];
}
```

- [ ] **Step 2: KBO 페이지를 바꾼다**

`app/kbo/page.tsx` 를 통째로 바꾼다. 카드가 빌드 시점에 정해지므로 `revalidate` 도, 실패 화면도 필요 없다. JSON 이 없으면 빌드가 깨져서 이전 배포가 그대로 살아 있는 편이 더 안전하다.

```tsx
import Game from "../_game/game";
import { loadPool } from "../_sports/pools";

// 탭 제목이 종목별로 갈리게 (레이아웃 기본값은 두 종목을 아우르는 이름이다)
export const metadata = { title: "KBO 카드깡 2026" };

export default async function Page() {
  const pool = await loadPool("kbo-2026");
  return <Game pool={pool} sport="kbo" />;
}
```

- [ ] **Step 3: EPL 페이지를 바꾼다**

`app/epl/page.tsx` 를 통째로 바꾼다.

```tsx
import Game from "../_game/game";
import { loadPool } from "../_sports/pools";

// 탭 제목이 종목별로 갈리게 (레이아웃 기본값은 두 종목을 아우르는 이름이다)
export const metadata = { title: "프리미어리그 카드깡 25/26" };

export default async function Page() {
  const pool = await loadPool("epl-2526");
  return <Game pool={pool} sport="epl" />;
}
```

- [ ] **Step 4: 빌드가 되는지, 정적으로 잡히는지 본다**

Run: `npm run build`
Expected: 빌드 성공. 출력의 라우트 목록에서 `/kbo` 와 `/epl` 이 정적(`○`)으로 잡힌다. 전에는 ISR 이었다. 정적으로 안 잡혀도 동작은 하지만, 그렇다면 어딘가 요청 시점 API 를 쓰고 있다는 뜻이므로 확인한다.

- [ ] **Step 5: 화면에서 확인한다**

Run: `npm run dev -- -p 3100`

브라우저로 `http://localhost:3100/kbo` 와 `http://localhost:3100/epl` 을 연다. 확인할 것:

- 카드팩 개봉이 전과 똑같이 동작한다
- 카드에 선수 사진과 팀 로고가 뜬다
- `(?)` 툴팁의 KBO 안내 문구가 "타자는 124타석, 선발은 31이닝, 불펜은 21이닝" 으로 바뀌어 있다

확인이 끝나면 개발 서버를 끈다.

- [ ] **Step 6: 전체 검증**

Run: `npm test && npm run lint && time npx tsc --noEmit`
Expected: 전부 통과.

`tsc` 시간을 재는 이유가 있다. `resolveJsonModule` 이 켜져 있어서 130KB 짜리 JSON 을
import 하면 TypeScript 가 파일 내용 전체를 리터럴 타입으로 잡는다. 카드 269장 × 스탯
8칸이라 타입체크가 눈에 띄게 느려질 수 있다. 20초를 넘기면 `import()` 대신 빌드 시점에
`fs.readFile` 로 읽는 방식으로 바꾼다. 두 페이지 다 정적 생성이라 파일 읽기가 빌드
때만 일어나므로 배포 산출물에는 영향이 없다.

- [ ] **Step 7: 커밋**

```bash
git add app/_sports/pools.ts app/kbo/page.tsx app/epl/page.tsx
git commit -m "앱이 카드 풀을 저장소 JSON 에서 읽게 바꾼다"
```

---

### Task 6: 깃액션으로 매일 갱신한다

**Files:**
- Create: `.github/workflows/daily.yml`

- [ ] **Step 1: 워크플로를 쓴다**

```yaml
name: 시즌 기록 갱신

on:
  # UTC 20:00 = KST 05:00. KBO 경기는 늦어도 자정 전에 끝나므로 그 뒤에 돈다.
  schedule:
    - cron: "0 20 * * *"
  # 손으로도 돌릴 수 있게
  workflow_dispatch:

jobs:
  snapshot:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      # 의존성 없이 도는 스크립트라 npm ci 가 필요 없다.
      - name: 스냅샷 굽기
        run: node scripts/snapshot.ts

      - name: 변경분 커밋
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/
          # 성적이 그대로면 변경분이 없다. 그때는 빈 커밋을 만들지 않고 넘어간다.
          git diff --staged --quiet && echo "변경 없음" && exit 0
          git commit -m "시즌 기록을 갱신한다"
          git push
```

- [ ] **Step 2: YAML 이 유효한지 본다**

Run: `node -e "const s=require('fs').readFileSync('.github/workflows/daily.yml','utf8'); if(s.includes('\t')) throw new Error('탭 문자가 있다'); console.log('줄 수', s.split('\n').length)"`
Expected: 오류 없이 줄 수가 찍힌다. YAML 은 탭을 못 쓴다.

- [ ] **Step 3: 커밋**

```bash
git add .github/workflows/daily.yml
git commit -m "깃액션이 시즌 기록을 매일 굽게 한다"
```

- [ ] **Step 4: 푸시하고 손으로 한 번 돌려본다**

푸시는 사용자가 원할 때만 한다. 푸시한 뒤 GitHub 저장소의 Actions 탭에서 "시즌 기록 갱신" 을 골라 `Run workflow` 를 누른다.

확인할 것:
- 잡이 초록으로 끝난다
- `data/kbo-2026.json` 을 고치는 커밋이 생기거나 "변경 없음" 이 찍힌다
- Vercel 이 그 커밋으로 재배포한다

권한 오류(`403`)가 나면 저장소 Settings → Actions → General → Workflow permissions 에서 "Read and write permissions" 를 켠다.

---

### Task 7: 문서를 갱신한다

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 명령어와 외부 데이터 절을 고친다**

`CLAUDE.md` 의 명령어 블록에 스냅샷 줄을 더한다.

```bash
node scripts/snapshot.ts   # 카드 풀을 data/*.json 으로 다시 굽는다 (깃액션이 매일 자동 실행)
```

"외부 데이터" 절을 통째로 바꾼다.

```markdown
### 외부 데이터

카드 풀은 런타임에 받지 않는다. `scripts/snapshot.ts` 가 완성된 `Card[]` 를
`data/<종목>-<시즌>.json` 으로 구워 저장소에 커밋하고, 앱은 `app/_sports/pools.ts` 로
그 JSON 만 읽는다. 갱신은 `.github/workflows/daily.yml` 이 매일 돌린다.

- 시즌 목록은 `app/_sports/seasons.ts` 다. 액션은 `live: true` 인 시즌만 다시 굽는다
- 시즌이 끝나면 `live: false` 로 바꾼다. 그러면 파일이 그 자리에 굳는다
- 시즌을 추가하면 `seasons.ts` 와 `pools.ts` 에 한 줄씩 더한다
- KBO: Naver 스포츠 기록 API(비공식·무인증). 시즌 상수는 `kbo.ts` 의 `SEASON`
- EPL: FotMob 통계 CDN. 시즌마다 `epl.ts` 의 `SEASON_ID` 를 갈아야 한다(찾는 법은 주석에)

선수 사진·팀 로고 호스트는 `next.config.ts` 의 `remotePatterns` 에 등록돼 있어야 뜬다.

등급이 어제 대비 바뀐 카드에는 `prevTier` 가 붙는다. 계산은 `scripts/prev-tier.ts` 다.
```

- [ ] **Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "데이터 파이프라인을 문서에 반영한다"
```

---

## 완료 기준

- [ ] `npm test` 통과 (`deck.test.ts`, `battle.test.ts`, `snapshot.test.ts`)
- [ ] `npm run lint` 통과
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과하고 `/kbo`, `/epl` 이 정적으로 잡힌다
- [ ] `node scripts/snapshot.ts` 를 두 번 돌리면 두 번째에 EPL 을 건너뛴다
- [ ] 브라우저에서 두 종목 다 카드팩 개봉이 전과 똑같이 동작한다

## 다음 계획

이 계획이 끝나면 라우팅 개편(메인화면 4칸, 시즌 선택 화면, `[sport]/solo|multi/[season]`)으로 넘어간다. 그때 `seasons.ts` 가 이미 있으므로 매니페스트를 그대로 쓴다.
