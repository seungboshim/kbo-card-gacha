// node --test economy.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PACKS,
  BASE_VALUE,
  START_CREDITS,
  MAX_PLUS,
  cardValue,
  oddsAt,
  upgradeCost,
  guardFee,
  packExpectedValue,
  isBankrupt,
  cheapestPackPrice,
} from "./app/_solo/economy.ts";
import { TIERS } from "./app/_game/deck.ts";
import { toSlots, takeFrom, applyUpgrade, type Owned } from "./app/_solo/vault.ts";
import { newRun, parseRun, serializeRun, runKey } from "./app/_solo/storage.ts";

const TIER_KEYS = Object.keys(BASE_VALUE) as (keyof typeof BASE_VALUE)[];

test("팩 세 종의 확률표 합이 각각 100%", () => {
  for (const p of PACKS) {
    const sum = TIERS.reduce((s, t) => s + p.rates[t.key], 0);
    assert.equal(sum, 100, `${p.name} 확률 합이 ${sum}`);
  }
});

test("플래티넘 팩에는 커먼이 안 나온다", () => {
  assert.equal(PACKS[2].rates.COMMON, 0);
});

test("팩 엣지가 셋 다 플러스고, START_CREDITS 로는 플래티넘을 못 산다", () => {
  // 팩은 그대로 팔면 항상 손해다. 돈이 새는 곳을 팩 하나로 몰아야 강화가 만회 수단이 된다.
  // 플래티넘을 못 사는 시작 밑천도 그대로 지킨다 — 모아서 처음 사는 순간이 이 모드의
  // 첫 목표라는 성질은 재조정과 무관하게 유지한다.
  for (const p of PACKS) assert.ok(packExpectedValue(p) < p.price, `${p.name} 엣지가 마이너스`);
  const platinum = PACKS.find((p) => p.key === "platinum")!;
  assert.ok(START_CREDITS < platinum.price);
});

test("카드 가치는 등급과 강화 수치에 대해 단조 증가", () => {
  const order = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGEND"] as const;
  for (let i = 1; i < order.length; i++) {
    assert.ok(cardValue(order[i], 0) > cardValue(order[i - 1], 0));
  }
  for (let n = 1; n <= MAX_PLUS; n++) {
    assert.ok(cardValue("EPIC", n) > cardValue("EPIC", n - 1));
  }
  assert.equal(cardValue("EPIC", 0), BASE_VALUE.EPIC);
});

test("MULT: cardValue 는 모든 등급에서 강화할수록 오른다", () => {
  // 단계별로 배수가 다르니(STEP_GROWTH), 등급 하나만 보고 넘기면 특정 등급에서
  // 역전이 나도 못 잡는다.
  for (const tier of TIER_KEYS) {
    for (let n = 0; n < MAX_PLUS; n++) {
      assert.ok(cardValue(tier, n) < cardValue(tier, n + 1), `${tier} +${n} → +${n + 1} 이 안 오름`);
    }
  }
});

test("천장 밖 강화 수치를 넣어도 NaN 이 안 나온다", () => {
  // cardValue 가 배열에서 값을 읽으므로, 자르지 않으면 범위 밖에서 undefined 를
  // 곱해 NaN 이 번진다.
  assert.ok(Number.isFinite(cardValue("RARE", MAX_PLUS + 5)));
  assert.ok(Number.isFinite(cardValue("RARE", -1)));
});

test("언커먼 +13 이 레전드 +0 보다 비싸다", () => {
  // 낮은 등급이라도 끝까지 밀면 값나가야 한다는 요구다. 실측: 언커먼 +13 = 2,121,
  // 레전드 +0 = 2,000.
  assert.ok(cardValue("UNCOMMON", 13) > cardValue("LEGEND", 0));
});

test("레전드 최고 강화가 55,000 아래에서 멎는다", () => {
  // 파괴율을 크게 낮추면서 STEP_GROWTH 도 함께 낮춰(도박 1.30~1.38, 트로피 1.33)
  // 고강화 곡선이 폭주하지 않게 잡았다. 실측 50,023.
  const max = cardValue("LEGEND", MAX_PLUS);
  assert.ok(max < 55000, `레전드 +${MAX_PLUS} 가치가 ${max}`);
});

test("강화 확률 셋의 합이 각 단계에서 100%", () => {
  for (let n = 0; n < MAX_PLUS; n++) {
    const o = oddsAt(n, false);
    assert.equal(o.success + o.keep + o.destroy, 100, `+${n} 합이 안 맞음`);
  }
});

test("보호권을 켜면 파괴가 0 이 되고 그만큼 실패로 넘어간다", () => {
  for (let n = 0; n < MAX_PLUS; n++) {
    const off = oddsAt(n, false);
    const on = oddsAt(n, true);
    assert.equal(on.destroy, 0);
    assert.equal(on.success, off.success);
    assert.equal(on.keep, off.keep + off.destroy);
    assert.equal(on.success + on.keep, 100);
  }
});

test("성공률은 단계가 오를수록 안 오르고 파괴율은 안 내린다", () => {
  for (let n = 1; n < MAX_PLUS; n++) {
    assert.ok(oddsAt(n, false).success <= oddsAt(n - 1, false).success);
    assert.ok(oddsAt(n, false).destroy >= oddsAt(n - 1, false).destroy);
  }
});

test("천장을 넘으면 강화할 수 없다", () => {
  assert.equal(oddsAt(MAX_PLUS, false).success, 0);
});

test("파괴는 +6 부터 시작한다", () => {
  // +0~+5 는 돈만 잃고 카드는 안 사라진다. +6 부터가 카드 목숨을 거는 구간이다.
  for (let n = 0; n < 6; n++) assert.equal(oddsAt(n, false).destroy, 0, `+${n} 에 파괴가 있다`);
  for (let n = 6; n < MAX_PLUS; n++) assert.ok(oddsAt(n, false).destroy > 0, `+${n} 에 파괴가 없다`);
});

test("보호권+강화비 합이 어느 단계에서도 카드 가치를 넘지 않는다", () => {
  // 카드보다 보호권이 비싸면 아무도 안 쓴다. 설계에서 한 번 밟은 함정이다.
  for (const tier of ["COMMON", "RARE", "LEGEND"] as const) {
    for (let n = 0; n < MAX_PLUS; n++) {
      const total = upgradeCost(tier, n) + guardFee(tier, n);
      assert.ok(total < cardValue(tier, n), `${tier} +${n}: 총 ${total} vs 가치 ${cardValue(tier, n)}`);
    }
  }
});

test("강화비: 안전 구간(+0~+5)은 가치의 5%, 다만 가치상승을 넘지 않는다", () => {
  // "강화는 쉽게쉽게, 그렇다고 가치가 넘 높지는 않게"라는 요구로 9%에서 5%로 더 낮췄다.
  for (const tier of TIER_KEYS) {
    for (let n = 0; n <= 5; n++) {
      const gain = cardValue(tier, n + 1) - cardValue(tier, n);
      const want = Math.min(Math.ceil(cardValue(tier, n) * 0.05), gain - 1);
      assert.equal(upgradeCost(tier, n), want, `${tier} +${n}`);
    }
  }
});

test("강화비: 도박·트로피 구간(+6~+14)은 기본가 대비 단계마다 3.5%p 씩 오른다", () => {
  // +6 은 기본가의 12%, +14 는 40% 다. 예전엔 12% 고정이었다 — 파괴율을 크게 낮춘
  // 만큼 강화비를 누진시켜야 트로피 구간이 계속 "미친 짓"으로 남는다.
  for (const tier of TIER_KEYS) {
    for (let n = 6; n < MAX_PLUS; n++) {
      const want = Math.ceil(BASE_VALUE[tier] * (0.12 + 0.035 * (n - 6)));
      assert.equal(upgradeCost(tier, n), want, `${tier} +${n}`);
    }
  }
});

/**
 * 강화 한 단계의 기대손익(정수 기준). +n → +n+1 시도 한 번의 기댓값이다.
 *
 * 기대손익 = 성공률×(다음가치 − 지금가치) − 파괴율×지금가치 − 강화비.
 * cardValue·upgradeCost 가 실제로 돌려주는 정수로 재야 반올림에서 뒤집히는 단계가
 * 없는지도 같이 확인된다.
 */
function stepProfit(tier: keyof typeof BASE_VALUE, n: number): number {
  const o = oddsAt(n, false);
  const gain = (o.success / 100) * (cardValue(tier, n + 1) - cardValue(tier, n));
  const loss = (o.destroy / 100) * cardValue(tier, n) + upgradeCost(tier, n);
  return gain - loss;
}

test("비용이 가치상승보다 적다: 다섯 등급 × 열다섯 단계, 무보호와 보호 둘 다", () => {
  // 이겼는데도 손해인 화면이 나오면 안 된다. 기대손익이 음수인 것과는 다른
  // 이야기다 — 그건 "여러 번 굴리면 밑진다"이고 이건 "한 번 이기면 남는다"다.
  //
  // 보호 쪽은 파괴가 있는 칸(+6~+14)만 잰다. UI 도 canGuard = destroy > 0 일 때만
  // 토글을 보여준다(upgrade-overlay.tsx) — 파괴가 0 인 칸의 guardFee 는 capToGain
  // 의 최소값(1)이 그대로 나오는 명목상의 수치라 "보호"라는 개념 자체가 없다.
  for (const tier of TIER_KEYS) {
    for (let n = 0; n < MAX_PLUS; n++) {
      const gain = cardValue(tier, n + 1) - cardValue(tier, n);
      const cost = upgradeCost(tier, n);
      assert.ok(cost < gain, `${tier} +${n}: 강화비 ${cost} 가 가치상승 ${gain} 이상이다`);
      if (oddsAt(n, false).destroy === 0) continue;
      const withGuard = cost + guardFee(tier, n);
      assert.ok(withGuard < gain, `${tier} +${n}: 보호권까지 ${withGuard} 가 가치상승 ${gain} 이상이다`);
    }
  }
});

test("보호를 켜면 안 켠 것보다 기대손익이 나쁘다 (파괴가 있는 모든 칸)", () => {
  // **여기서 규칙 하나를 버렸다.** 예전엔 "보호를 켠 기대손익이 어디서도 양수면
  // 안 된다"였다. 파괴율을 3~15%로 크게 낮추자 그 규칙과 "성공하면 남는 몫이
  // 가치상승의 20% 이상이다"(아래 테스트)가 정면으로 부딪혔다 — 계수를 옛 규칙이
  // 성립할 만큼 올리면 남는 몫이 깎이고, 20%를 지킬 만큼 낮추면 파괴율이 작은
  // 구간에서 보호가 무위험 이득이 된다. 파괴가 3~7%로 작아진 이상 둘을 함께
  // 지킬 계수가 없어 약한 규칙만 남긴다: 보호는 늘 안 켠 것보다 나쁘다(무위험
  // 루프가 될 수 없다는 뜻이지, 손해가 없다는 뜻은 아니다).
  for (const tier of TIER_KEYS) {
    for (let n = 6; n < MAX_PLUS; n++) {
      const off = oddsAt(n, false);
      const now = cardValue(tier, n);
      const gain = (off.success / 100) * (cardValue(tier, n + 1) - now);
      const noGuard = gain - (off.destroy / 100) * now - upgradeCost(tier, n);
      const withGuard = gain - upgradeCost(tier, n) - guardFee(tier, n);
      assert.ok(withGuard < noGuard, `${tier} +${n}: 보호(${withGuard.toFixed(1)}) 가 무보호(${noGuard.toFixed(1)}) 보다 낫다`);
    }
  }
});

test("성공하면 남는 몫이 가치상승의 20% 이상이다 (파괴가 있는 모든 칸)", () => {
  // "11강부터 고작 1원만 벌린다"던 옛 곡선을 막는 테스트다. 보호까지 켜고 이겨도
  // 남는 게 하찮으면 안 된다 — 트로피 구간(+11~+14)이 특히 위험한 자리였다.
  for (const tier of TIER_KEYS) {
    for (let n = 6; n < MAX_PLUS; n++) {
      const gain = cardValue(tier, n + 1) - cardValue(tier, n);
      const margin = gain - upgradeCost(tier, n) - guardFee(tier, n);
      assert.ok(margin >= gain * 0.2, `${tier} +${n}: 남는 몫 ${margin} 이 가치상승의 20%(${(gain * 0.2).toFixed(1)}) 보다 적다`);
    }
  }
});

test("안전·도박 구간(+0~+10)은 기대손익 양수, 트로피 구간(+11~+14)은 음수", () => {
  // 다섯 등급 전부에서 지켜야 한다. 실측(레어): +0 +3.8%, +6 +9.7%, +10 +3.7%,
  // +11 −1.5%, +14 −10.5%.
  for (const tier of TIER_KEYS) {
    for (let n = 0; n <= 10; n++) {
      assert.ok(stepProfit(tier, n) > 0, `${tier} +${n}(안전·도박): 기대손익이 양수가 아니다`);
    }
    for (let n = 11; n < MAX_PLUS; n++) {
      assert.ok(stepProfit(tier, n) < 0, `${tier} +${n}(트로피): 기대손익이 음수가 아니다`);
    }
  }
});

test("기대손익률(가치 대비 %)의 최댓값은 +6이다", () => {
  // 도박 구간 초입이 제일 남는다 — 파괴율이 갓 생겨 낮은데(3%) 성공 배수는 이미
  // 크기(1.30) 때문이다. 뒤로 갈수록 파괴율이 성공 배수보다 빠르게 커져 비율이
  // 줄어든다(레어 기준 +6 9.7% → +10 3.7%).
  for (const tier of TIER_KEYS) {
    let bestRatio = -Infinity;
    let bestN = -1;
    for (let n = 0; n < MAX_PLUS; n++) {
      const ratio = stepProfit(tier, n) / cardValue(tier, n);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestN = n;
      }
    }
    assert.equal(bestN, 6, `${tier}: 최댓값이 +${bestN} 에 있다`);
  }
});

test("강화비와 보호료는 카드가 비쌀수록 비싸다", () => {
  assert.ok(upgradeCost("LEGEND", 0) > upgradeCost("COMMON", 0));
  assert.ok(upgradeCost("EPIC", 5) > upgradeCost("EPIC", 0));
  // 보호료는 파괴율이 0인 +0~+5 에서 사실상 공짜고, 파괴가 시작되는 +6 부터 갈수록 오른다.
  assert.ok(guardFee("EPIC", 0) < guardFee("EPIC", MAX_PLUS - 1));
});

test("파산 판정: 제일 싼 팩도 못 사고 보관함도 비었을 때만", () => {
  const cheap = cheapestPackPrice();
  assert.equal(isBankrupt(cheap, 0), false, "딱 살 수 있으면 아직 아니다");
  assert.equal(isBankrupt(cheap - 1, 0), true);
  assert.equal(isBankrupt(cheap - 1, 1), false, "팔 카드가 남았으면 아직 아니다");
  assert.equal(isBankrupt(0, 0), true);
});

const owned = (id: string, plus = 0): Owned => ({ id, plus });

test("같은 선수 + 같은 강화 수치를 한 칸으로 묶는다", () => {
  const slots = toSlots([owned("a"), owned("b"), owned("a")]);
  assert.equal(slots.length, 2);
  assert.equal(slots.find((s) => s.id === "a")!.count, 2);
  assert.equal(slots.find((s) => s.id === "b")!.count, 1);
});

test("같은 선수라도 강화 수치가 다르면 다른 칸", () => {
  const slots = toSlots([owned("a", 0), owned("a", 7), owned("a", 0)]);
  assert.equal(slots.length, 2);
  assert.equal(slots.find((s) => s.plus === 0)!.count, 2);
  assert.equal(slots.find((s) => s.plus === 7)!.count, 1);
});

test("빈 보관함은 빈 칸 목록", () => {
  assert.deepEqual(toSlots([]), []);
});

test("takeFrom: 칸에서 고른 장수만 뺀다", () => {
  const v = [owned("a"), owned("a"), owned("a"), owned("b")];
  const left = takeFrom(v, { id: "a", plus: 0 }, 2);
  assert.equal(left.length, 2);
  assert.equal(toSlots(left).find((s) => s.id === "a")!.count, 1);
});

test("takeFrom: 가진 것보다 많이 빼려 해도 있는 만큼만 빠진다", () => {
  const v = [owned("a"), owned("b")];
  const left = takeFrom(v, { id: "a", plus: 0 }, 99);
  assert.equal(left.length, 1);
  assert.equal(left[0].id, "b");
});

test("takeFrom: 강화 수치가 다른 같은 선수는 안 건드린다", () => {
  const v = [owned("a", 0), owned("a", 3)];
  const left = takeFrom(v, { id: "a", plus: 0 }, 1);
  assert.equal(left.length, 1);
  assert.equal(left[0].plus, 3);
});

test("applyUpgrade 성공: 한 장만 칸에서 빠져나와 다음 단계가 된다", () => {
  // 같은 칸에 세 장이 있어도 강화는 한 장에만 걸린다
  const v = [owned("a"), owned("a"), owned("a")];
  const next = applyUpgrade(v, { id: "a", plus: 0 }, "success");
  const slots = toSlots(next);
  assert.equal(next.length, 3, "장수는 그대로");
  assert.equal(slots.find((s) => s.plus === 0)!.count, 2);
  assert.equal(slots.find((s) => s.plus === 1)!.count, 1);
});

test("applyUpgrade 실패: 아무것도 안 바뀐다", () => {
  const v = [owned("a"), owned("a")];
  const next = applyUpgrade(v, { id: "a", plus: 0 }, "keep");
  assert.deepEqual(toSlots(next), toSlots(v));
});

test("applyUpgrade 파괴: 한 장만 사라진다", () => {
  const v = [owned("a"), owned("a"), owned("b")];
  const next = applyUpgrade(v, { id: "a", plus: 0 }, "destroy");
  assert.equal(next.length, 2);
  assert.equal(toSlots(next).find((s) => s.id === "a")!.count, 1);
});

test("applyUpgrade: 없는 칸을 강화하려 하면 그대로 둔다", () => {
  const v = [owned("a")];
  assert.deepEqual(applyUpgrade(v, { id: "없음", plus: 0 }, "success"), v);
});

test("newRun: 시작 크레딧과 빈 보관함", () => {
  const r = newRun("kbo-2026");
  assert.equal(r.season, "kbo-2026");
  assert.equal(r.credits, START_CREDITS);
  assert.deepEqual(r.vault, []);
  assert.deepEqual(r.best, []);
  assert.equal(r.over, false);
});

test("직렬화하고 되읽으면 같다", () => {
  const r = newRun("kbo-2026");
  r.credits = 1234;
  r.vault = [{ id: "타자-1", plus: 3 }];
  r.best = [{ id: "타자-1", plus: 3 }];
  assert.deepEqual(parseRun(serializeRun(r)), r);
});

test("없는 저장값은 null", () => {
  assert.equal(parseRun(null), null);
});

test("깨진 JSON 은 null", () => {
  assert.equal(parseRun("{"), null);
  assert.equal(parseRun(""), null);
});

test("스키마 버전이 다르면 버린다", () => {
  // 나중에 형태를 바꿀 때 옛 저장값을 조용히 버리고 새로 시작하게 한다.
  const old = JSON.stringify({ ...newRun("kbo-2026"), v: 0 });
  assert.equal(parseRun(old), null);
});

test("모양이 안 맞으면 버린다", () => {
  assert.equal(parseRun(JSON.stringify({ v: 2 })), null);
  assert.equal(parseRun(JSON.stringify({ v: 2, season: "kbo-2026", credits: "많음", vault: [], best: [], over: false })), null);
  assert.equal(parseRun(JSON.stringify({ v: 2, season: "kbo-2026", credits: 10, vault: "없음", best: [], over: false })), null);
});

test("best 가 배열이 아니면 버린다", () => {
  const bad = JSON.stringify({ ...newRun("kbo-2026"), best: { id: "a", plus: 1 } });
  assert.equal(parseRun(bad), null);
});

test("runKey 는 시즌마다 다르다", () => {
  assert.notEqual(runKey("kbo-2026"), runKey("epl-2526"));
});

test("음수 크레딧은 버린다", () => {
  const bad = JSON.stringify({ ...newRun("kbo-2026"), credits: -800 });
  assert.equal(parseRun(bad), null);
});

test("숫자가 아닌 크레딧은 버린다", () => {
  for (const credits of [Infinity, NaN, null]) {
    const bad = JSON.stringify({ ...newRun("kbo-2026"), credits });
    assert.equal(parseRun(bad), null, `credits=${credits}`);
  }
});

test("천장을 넘는 강화 수치는 버린다", () => {
  // plus 999 를 통과시키면 카드 값이 200자리 숫자로 그려진다.
  const bad = JSON.stringify({ ...newRun("kbo-2026"), vault: [{ id: "a", plus: MAX_PLUS + 1 }] });
  assert.equal(parseRun(bad), null);
});

test("음수·소수 강화 수치는 버린다", () => {
  for (const plus of [-1, 1.5]) {
    const bad = JSON.stringify({ ...newRun("kbo-2026"), vault: [{ id: "a", plus }] });
    assert.equal(parseRun(bad), null, `plus=${plus}`);
  }
});

test("최고 기록의 강화 수치도 같은 범위를 지켜야 한다", () => {
  const bad = JSON.stringify({ ...newRun("kbo-2026"), best: [{ id: "a", plus: MAX_PLUS + 5 }] });
  assert.equal(parseRun(bad), null);
});

test("천장에 딱 맞는 강화 수치는 통과한다", () => {
  const ok = JSON.stringify({ ...newRun("kbo-2026"), vault: [{ id: "a", plus: MAX_PLUS }] });
  assert.equal(parseRun(ok)?.vault[0].plus, MAX_PLUS);
});
