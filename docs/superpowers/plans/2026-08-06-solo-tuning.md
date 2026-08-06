# 혼자서 모드 조율 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제로 플레이해보고 나온 지적을 반영한다. 강화가 +5~6 에서 막혀 재미가 안 나고, 화면 곳곳에 군더더기 문구가 있다.

**Architecture:** 규칙은 `app/_solo/economy.ts` 상수만 갈아끼우면 되고, 화면은 이미 파일별로 갈려 있어 각자 손보면 된다.

**Tech Stack:** Next.js 16, React 19, Tailwind v4. 새 의존성 없음.

**설계 문서:** `docs/superpowers/specs/2026-08-05-solo-mode-design.md`

---

## 왜 바꾸나

플레이해보니 +5→+6 이 성공 25% 에 파괴 25% 라 **두 번에 한 번은 카드가 사라진다.** 돈이
있어도 못 올라가서 강화의 재미가 초반에 끊긴다.

그리고 지금 곡선에는 못 보던 구멍이 있다. 강화비가 가치의 30% 인데 성공하면 가치가 60%
오르므로 **낮은 단계 강화의 기대 손익이 플러스다**(+1 에서 +780, +2 에서 +864, +3 에서 +384).
카드를 사서 +3 까지 올려 파는 게 이득이라 도박이 아니라 농사가 된다.

---

### Task 1: 강화 곡선과 가치 증가율

**Files:** `app/_solo/economy.ts`, `economy.test.ts`

세 가지를 같이 바꾼다. 따로 바꾸면 경제가 깨진다.

- **천장 10 → 15**
- **파괴를 +7 부터 시작**. +0~+6 은 돈만 잃고 카드는 안 사라진다
- **가치 증가율 1.6 → 1.3**

증가율을 같이 낮추는 이유가 둘이다. 1.6 배로 15단계면 레전드가 346만이 되어 숫자가
망가진다. 그리고 파괴를 없앤 구간에서 성공 시 60% 가 오르면 강화가 돈벌이가 된다.
1.3 배면 성공해도 30% 오르는데 비용이 30% 라 **모든 단계의 기대 손익이 음수**가 된다.

- [ ] **Step 1: 상수를 바꾼다**

`app/_solo/economy.ts`:

```ts
/** 강화 한 단계마다 가치가 곱해지는 배수. */
export const GROWTH = 1.3;

/** 강화 천장. */
export const MAX_PLUS = 15;
```

`ODDS` 를 통째로 바꾼다.

```ts
/**
 * 강화 한 번 시도의 [성공, 파괴] 확률(%). 나머지가 실패(단계 유지)다.
 *
 * **파괴는 +7 부터 시작한다.** 그 아래는 돈만 잃고 카드는 안 사라진다. 긴장이
 * "살아남을까"에서 "감당할 수 있나"로 옮겨가고, +7 이 진짜 도박의 시작선이 된다.
 * 색 밴드가 바뀌는 자리와도 겹쳐서 색 자체가 경고가 된다.
 *
 * 파괴가 +0 부터 있던 예전 곡선은 +5→+6 이 성공 25% 파괴 25% 라, 돈이 있어도 두 번에
 * 한 번은 카드를 잃어 강화의 재미가 초반에 끊겼다.
 */
const ODDS: readonly (readonly [number, number])[] = [
  [98, 0],
  [95, 0],
  [90, 0],
  [84, 0],
  [76, 0],
  [66, 0],
  [55, 0],
  [45, 8],
  [36, 14],
  [28, 20],
  [21, 26],
  [15, 32],
  [10, 38],
  [6, 44],
  [3, 50],
];
```

`GROWTH` 주석에 근거를 적는다.

```ts
/**
 * 강화 한 단계마다 가치가 곱해지는 배수.
 *
 * 1.6 이었다가 낮췄다. 천장을 15 로 늘리면서 1.6 을 쓰면 레전드가 346만이 되고,
 * 강화비(가치의 30%)보다 성공 시 상승분(60%)이 커서 낮은 단계 강화가 돈벌이가 된다.
 * 1.3 이면 상승분과 비용이 같아 모든 단계의 기대 손익이 음수가 된다. 강화로는
 * 절대 돈을 못 번다.
 */
export const GROWTH = 1.3;
```

- [ ] **Step 2: 곡선을 검산한다**

Run:

```bash
node --input-type=module -e '
import { oddsAt, cardValue, upgradeCost, guardFee, MAX_PLUS, GROWTH } from "./app/_solo/economy.ts";
console.log("증가율", GROWTH, "· 천장", MAX_PLUS);
console.log("단계  성공 실패 파괴  돌파율  누적   레전드가치    강화비   1회 기대손익");
let reach = 1;
for (let n = 0; n < MAX_PLUS; n++) {
  const o = oddsAt(n, false);
  const pass = o.success / (o.success + o.destroy);
  reach *= pass;
  const v = cardValue("LEGEND", n), next = cardValue("LEGEND", n + 1), c = upgradeCost("LEGEND", n);
  const ev = (o.success / 100) * (next - v) - (o.destroy / 100) * v - c;
  console.log(`+${String(n+1).padEnd(3)} ${String(o.success).padStart(4)}%${String(o.keep).padStart(4)}%${String(o.destroy).padStart(4)}%`
    + ` ${(pass*100).toFixed(1).padStart(6)}% ${(reach*100).toFixed(2).padStart(6)}%`
    + ` ${v.toLocaleString().padStart(11)} ${c.toLocaleString().padStart(9)} ${Math.round(ev).toLocaleString().padStart(12)}`);
}
'
```

Expected: +7 누적 100%, +8 약 85%, +10 약 36%, +15 약 0.01%. **기대 손익 칸이 전부 음수여야 한다.** 하나라도 양수면 그 단계가 돈벌이 수단이 되므로 멈추고 보고한다.

- [ ] **Step 3: 테스트를 새 값에 맞춘다**

`economy.test.ts` 의 기존 강화 테스트가 `MAX_PLUS` 를 쓰고 있으므로 대부분 그대로 통과한다. 다음 두 가지를 더한다.

```ts
test("파괴는 +7 부터 시작한다", () => {
  // +0~+6 은 돈만 잃고 카드는 안 사라진다. 여기가 "감당할 수 있나"의 구간이고
  // +7 부터가 "살아남을까"의 구간이다.
  for (let n = 0; n < 7; n++) assert.equal(oddsAt(n, false).destroy, 0, `+${n} 에 파괴가 있다`);
  for (let n = 7; n < MAX_PLUS; n++) assert.ok(oddsAt(n, false).destroy > 0, `+${n} 에 파괴가 없다`);
});

test("강화는 어느 단계에서도 돈벌이가 아니다", () => {
  // 성공 시 상승분보다 비용이 커야 도박이지 농사가 아니다.
  // 예전 곡선은 낮은 단계에서 기대 손익이 플러스라 +3 까지 올려 파는 게 이득이었다.
  for (const tier of ["COMMON", "RARE", "LEGEND"] as const) {
    for (let n = 0; n < MAX_PLUS; n++) {
      const o = oddsAt(n, false);
      const gain = (o.success / 100) * (cardValue(tier, n + 1) - cardValue(tier, n));
      const loss = (o.destroy / 100) * cardValue(tier, n) + upgradeCost(tier, n);
      assert.ok(gain <= loss, `${tier} +${n}: 기대 이득 ${gain} > 손실 ${loss}`);
    }
  }
});
```

- [ ] **Step 4: 검증과 커밋**

Run: `npm test && npm run lint && npx tsc --noEmit`

```bash
git add app/_solo/economy.ts economy.test.ts
git commit -m "강화를 15단계로 늘리고 파괴를 +7 부터 시작한다"
```

---

### Task 2: 강화 칩 색을 단계별로

**Files:** `app/_game/card.tsx`

지금 칩이 카드 등급색을 따라간다. 강화 단계를 따라가게 바꾼다. 3씩 다섯 밴드다.

| 밴드 | 색 | |
|---|---|---|
| +1~3 | 동색 | 몸풀기 |
| +4~6 | 은색 | 여기까지 안전 |
| +7~9 | 금색 | 파괴 시작 |
| +10~12 | 청록 | 드물다 |
| +13~15 | 무지개 | 신화 |

- [ ] **Step 1: 밴드 표를 만든다**

`card.tsx` 안, `STYLE` 근처에 둔다.

```tsx
/**
 * 강화 수치 칩의 색. 카드 등급이 아니라 강화 단계를 따라간다. 3칸씩 다섯 밴드다.
 *
 * 밴드 경계를 파괴가 시작되는 +7 에 맞췄다(금색부터). 색이 바뀌는 순간이 위험이
 * 시작되는 순간이라 색 자체가 경고가 된다.
 *
 * 금속 질감 그라디언트를 쓰는 이유: 등급 배지는 평면 색이라, 칩도 평면 색으로 두면
 * 에픽 노랑과 금색, 레전드 홀로와 무지개가 톤이 겹쳐 무엇이 등급이고 무엇이 강화인지
 * 안 갈린다.
 */
const PLUS_BAND: { upTo: number; cls: string }[] = [
  { upTo: 3, cls: "bg-gradient-to-b from-[#e0a878] to-[#a05a2c] text-[#3a1e0c]" },
  { upTo: 6, cls: "bg-gradient-to-b from-[#f0f0f5] to-[#9a9aa8] text-[#2a2a33]" },
  { upTo: 9, cls: "bg-gradient-to-b from-[#ffe680] to-[#d4a017] text-[#3d2c00]" },
  { upTo: 12, cls: "bg-gradient-to-b from-[#a5f3fc] to-[#0e7490] text-[#062b33]" },
  { upTo: 15, cls: "bg-[linear-gradient(115deg,#6ee7b7,#ffffff_30%,#d8b4fe_55%,#ffffff_75%,#7dd3fc)] text-[#1a1a2e]" },
];

const plusBand = (plus: number) =>
  (PLUS_BAND.find((b) => plus <= b.upTo) ?? PLUS_BAND[PLUS_BAND.length - 1]).cls;
```

- [ ] **Step 2: 칩 두 자리에 적용한다**

`PlayerCard` 안에 `+{plus}` 칩이 두 군데 있다(hero 레이아웃, 기본 레이아웃). 둘 다 등급색 `${s.label}` 대신 `${plusBand(plus)}` 를 쓰고, 배경 인라인 스타일과 `ring` 은 걷어낸다. 금속 그라디언트가 이미 배경이다.

- [ ] **Step 3: 눈으로 본다**

Run: `npm run dev -- -p 3100`

`localStorage` 에 각 밴드의 카드를 심어 다섯 색이 다 나오는지, 그리고 `mini` 크기에서 이름을 안 미는지 본다.

```js
localStorage.setItem("cardgacha:run:kbo-2026", JSON.stringify({
  v: 2, season: "kbo-2026", credits: 99999,
  vault: [2, 5, 8, 11, 14].map((plus, i) => ({ id: ["타자-79402","타자-75847","타자-53123","타자-56034","타자-63123"][i], plus })),
  best: [], over: false,
}));
```

**확인할 것:** 다섯 밴드가 서로 갈리는지. 금색 칩이 에픽 카드 위에서, 무지개 칩이 레전드 카드 위에서 등급 배지와 안 헷갈리는지. 헷갈리면 그대로 두지 말고 보고한다.

- [ ] **Step 4: 커밋**

```bash
git add app/_game/card.tsx
git commit -m "강화 칩 색을 등급이 아니라 강화 단계에 맞춘다"
```

---

### Task 3: 최고 기록을 다섯 장으로 (스키마 v2)

**Files:** `app/_solo/storage.ts`, `app/_solo/solo.tsx`, `app/_solo/result.tsx`, `economy.test.ts`

결과 화면을 한 장이 아니라 **도감**으로 만든다. 이번 런에서 도달한 상위 다섯 장을 가치
내림차순으로 늘어놓는다.

- [ ] **Step 1: 스키마를 올린다**

`storage.ts`:

```ts
/** 형태를 바꾸면 올린다. 안 맞는 저장값은 버리고 새로 시작한다. */
const VERSION = 2;

/** 결과 화면에 늘어놓을 최고 기록 수. */
export const BEST_KEEP = 5;

export type Run = {
  v: number;
  season: string;
  credits: number;
  vault: Owned[];
  /** 이 런에서 도달한 상위 기록. 가치 내림차순. 강화 중에 터져도 남는다. */
  best: Owned[];
  over: boolean;
};
```

`newRun` 의 `best` 를 `[]` 로, `parseRun` 의 검사를 배열로 바꾼다.

```ts
  if (!Array.isArray(r.best) || !r.best.every(isOwned)) return null;
```

버전을 2 로 올렸으므로 옛 저장값(`v: 1`)은 저절로 버려지고 새 런으로 시작한다. 개인
프로젝트라 마이그레이션은 안 쓴다.

- [ ] **Step 2: 기록 갱신을 배열로**

`solo.tsx` 의 `upgrade()` 안. 지금은 한 장을 비교해 갈아끼운다. 다섯 장을 유지하게 바꾼다.

```ts
      // 같은 카드가 여러 번 오르면 마지막 단계만 남긴다. 같은 선수의 +3 과 +5 가 둘 다
      // 도감에 뜨면 자리만 차지한다.
      const entry = { id: ref.id, plus: ref.plus + 1 };
      const worth = (o: Owned) => {
        const c = byId.get(o.id);
        return c ? cardValue(c.tier, o.plus) : 0;
      };
      const best =
        result === "success"
          ? [...r.best.filter((o) => o.id !== entry.id), entry]
              .sort((a, b) => worth(b) - worth(a))
              .slice(0, BEST_KEEP)
          : r.best;
```

- [ ] **Step 3: 결과 화면을 도감으로**

`result.tsx` 를 고쳐 `run.best` 배열을 늘어놓는다. 1위는 크게(`size="full"`), 나머지는
작게(`size="mini"`) 두면 순위가 눈에 들어온다. 각 카드 아래에 가치를 동전 아이콘과 함께
적는다. 비었으면 "강화에 성공한 적이 없어요".

풀에서 못 찾는 기록은 건너뛴다(방출·은퇴).

- [ ] **Step 4: 테스트를 고친다**

`economy.test.ts` 의 `parseRun` 테스트에서 `best: null` 을 쓰던 자리를 `best: []` 로 바꾸고, 배열 검사 테스트를 더한다.

```ts
test("best 가 배열이 아니면 버린다", () => {
  const bad = JSON.stringify({ ...newRun("kbo-2026"), best: { id: "a", plus: 1 } });
  assert.equal(parseRun(bad), null);
});
```

- [ ] **Step 5: 검증과 커밋**

Run: `npm test && npm run lint && npx tsc --noEmit`

```bash
git add app/_solo/storage.ts app/_solo/solo.tsx app/_solo/result.tsx economy.test.ts
git commit -m "결과 화면을 최고 기록 다섯 장 도감으로 바꾼다"
```

---

### Task 4: 크레딧 표기를 동전 아이콘으로 통일

**Files:** `app/_solo/*` 전부

지금은 "보유 12,480", "팔면 540 크레딧", "장당 80" 처럼 자리마다 문구가 다르다.
**"크레딧"이라는 글자를 다 걷어내고 동전 아이콘 하나로 통일한다.**

- [ ] **Step 1: 공용 조각을 만든다**

`app/_solo/coin.tsx`

```tsx
/**
 * 크레딧 금액. 단위를 글자 대신 동전으로 말한다.
 *
 * "크레딧"이라는 글자를 안 쓰는 이유: 자리마다 "보유 N", "팔면 N 크레딧", "장당 N" 처럼
 * 문구가 제각각이라 같은 값인데 다르게 읽혔다. 아이콘 하나로 두면 어디서든 같게 보인다.
 */
export function Coin({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <span aria-hidden="true">🪙</span>
      {amount.toLocaleString()}
      <span className="sr-only">크레딧</span>
    </span>
  );
}
```

`sr-only` 로 "크레딧"을 남기는 이유: 화면에서는 아이콘이 단위를 말하지만 스크린리더는
이모지를 못 읽거나 "동전"이라고만 읽는다.

- [ ] **Step 2: 모든 자리를 갈아끼운다**

- `solo.tsx` 헤더의 보유 크레딧
- `shop.tsx` 팩 가격
- `vault-grid.tsx` 카드 아래 값, 하단 바
- `sell-modal.tsx` 받을 금액
- `upgrade-overlay.tsx` 보유·강화비·보호료·버튼 안 금액, **그리고 강화 단계 아래 카드 가치**
- `result.tsx` 도감의 가치

`grep -rn "크레딧" app/_solo/` 로 남은 글자가 없는지 확인한다(`coin.tsx` 의 `sr-only` 제외).

- [ ] **Step 3: 커밋**

```bash
git add app/_solo/
git commit -m "크레딧 표기를 동전 아이콘으로 통일한다"
```

---

### Task 5: 하단 바와 판매 모달 정리

**Files:** `app/_solo/vault-grid.tsx`, `app/_solo/sell-modal.tsx`

- [ ] **Step 1: 하단 바를 버튼 두 개만 남긴다**

지금은 "팔면 540 크레딧" 문구 + 팔기 + 강화다. 문구를 걷어내고 **받을 금액을 팔기 버튼
안에** 넣는다. 아무것도 안 골랐을 때 "팔면 0" 이 뜨던 것도 사라진다.

강화 버튼의 "· 한 칸에서 한 장만" 문구도 걷어내고 **잠기기만 한다.** 왜 잠겼는지는
hover·focus 시 툴팁으로 알린다. `title` 속성이 아니라 직접 그린 툴팁을 쓴다(키보드
포커스에서도 떠야 한다).

- [ ] **Step 2: 판매 모달에 선수 사진**

지금 등급색 네모만 있는 자리에 선수 사진을 넣는다. `vault-grid.tsx` 의 확대 다이얼로그가
아니라 `sell-modal.tsx` 의 줄 썸네일이다. `next/image` 로 `card.photo` 를 쓰고, 사진이
없는 선수는 지금처럼 등급색 배경만 남긴다.

"장당 80" 문구는 걷어낸다. 줄에는 이름·등급·장수와 그 줄의 합계만 둔다.

- [ ] **Step 3: 눈으로 본다**

- 아무것도 안 골랐을 때 하단 바에 "0" 이 안 보인다
- 두 칸 이상 골랐을 때 강화 버튼이 잠기고, 마우스를 올리거나 Tab 으로 닿으면 툴팁이 뜬다
- 판매 모달 줄에 선수 사진이 보인다
- 사진 없는 선수도 줄이 안 깨진다

- [ ] **Step 4: 커밋**

```bash
git add app/_solo/vault-grid.tsx app/_solo/sell-modal.tsx
git commit -m "하단 바와 판매 모달의 군더더기를 걷어낸다"
```

---

### Task 6: 상세 카드에서도 팔고 강화하기

**Files:** `app/_solo/vault-grid.tsx`

지금 도감 조작으로 들어가는 길이 길게 누르기와 헤더 버튼 둘뿐이다. **카드를 한 번 눌러
뜨는 확대 화면에서도** 바로 팔고 강화할 수 있게 한다.

- [ ] **Step 1: 확대 다이얼로그에 조작을 더한다**

카드 아래에 수량 핸들(그 칸의 `0/N`)과 팔기·강화 버튼을 둔다. 도감 하단 바와 같은 규칙이다.

- 팔기: 고른 장수만큼 판다. 받을 금액은 버튼 안에
- 강화: 한 장일 때만 눌린다. 누르면 확대를 닫고 강화 오버레이를 연다

- [ ] **Step 2: 눈으로 본다**

- 평상시 카드를 눌러 확대하면 하단에 핸들과 버튼 두 개가 있다
- 거기서 판 장수가 정확히 빠지고 크레딧이 맞는다
- 거기서 강화를 누르면 확대가 닫히고 강화 오버레이가 열린다
- 고르기 모드에서는 확대가 안 열린다(짧게 누르면 선택이다)

- [ ] **Step 3: 커밋**

```bash
git add app/_solo/vault-grid.tsx
git commit -m "확대한 카드에서도 팔고 강화할 수 있게 한다"
```

---

### Task 7: 문서

**Files:** `docs/superpowers/specs/2026-08-05-solo-mode-design.md`, `CLAUDE.md`

- [ ] **Step 1: 설계 문서의 경제 수치를 새 값으로**

"강화 확률" 표, "강화 비용과 보호권" 표, "검증 결과" 를 새 곡선으로 바꾼다.
**왜 바꿨는지도 적는다.** 예전 곡선의 +5→+6 벽과, 낮은 단계 기대 손익이 플러스였던 구멍.

"화면" 절에 강화 칩 밴드 표와 확대 카드 조작을 더한다.

- [ ] **Step 2: 커밋**

```bash
git add docs/superpowers/specs/2026-08-05-solo-mode-design.md CLAUDE.md
git commit -m "조율 결과를 문서에 반영한다"
```

---

## 완료 기준

- [ ] `npm test` 통과. 새 테스트 둘(파괴 시작 단계, 기대 손익 음수)이 들어간다
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과
- [ ] 강화 곡선 검산에서 **모든 단계의 기대 손익이 음수**
- [ ] +7 누적 도달 100%, +8 약 85%
- [ ] 다섯 색 밴드가 서로 갈리고 등급 배지와 안 헷갈린다
- [ ] `grep -rn "크레딧" app/_solo/` 결과가 `coin.tsx` 의 `sr-only` 하나뿐
- [ ] 확대 카드에서 팔기·강화가 된다
- [ ] 결과 화면에 최고 기록 다섯 장이 가치 내림차순으로 뜬다
