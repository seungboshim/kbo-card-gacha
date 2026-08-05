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
import { newRun, parseRun, serializeRun, runKey, type Run } from "./app/_solo/storage.ts";

test("팩 세 종의 확률표 합이 각각 100%", () => {
  for (const p of PACKS) {
    const sum = TIERS.reduce((s, t) => s + p.rates[t.key], 0);
    assert.equal(sum, 100, `${p.name} 확률 합이 ${sum}`);
  }
});

test("팩 엣지가 의도한 범위에 있다", () => {
  // 일반팩은 살짝 플레이어 유리(모으는 길), 플래티넘은 하우스가 가져간다.
  const edge = (p: (typeof PACKS)[number]) => (p.price - packExpectedValue(p)) / p.price;
  const [normal, good, platinum] = PACKS;
  assert.ok(edge(normal) < 0, `일반팩 엣지가 ${edge(normal)}`);
  assert.ok(Math.abs(edge(good)) < 0.03, `고급팩 엣지가 ${edge(good)}`);
  assert.ok(edge(platinum) > 0.02 && edge(platinum) < 0.08, `플래티넘 엣지가 ${edge(platinum)}`);
});

test("플래티넘 팩에는 커먼이 안 나온다", () => {
  assert.equal(PACKS[2].rates.COMMON, 0);
});

test("팩 가격이 100의 배수고 시작 크레딧보다 플래티넘이 비싸다", () => {
  for (const p of PACKS) assert.equal(p.price % 100, 0, `${p.name} 가격 ${p.price}`);
  assert.ok(PACKS[2].price > START_CREDITS);
  assert.ok(PACKS[0].price < START_CREDITS);
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

test("보호권 값이 어느 단계에서도 카드 가치를 넘지 않는다", () => {
  // 카드보다 보호권이 비싸면 아무도 안 쓴다. 설계에서 한 번 밟은 함정이다.
  for (const tier of ["COMMON", "RARE", "LEGEND"] as const) {
    for (let n = 0; n < MAX_PLUS; n++) {
      const total = upgradeCost(tier, n) + guardFee(tier, n);
      assert.ok(total < cardValue(tier, n), `${tier} +${n}: 총 ${total} vs 가치 ${cardValue(tier, n)}`);
    }
  }
});

test("강화비와 보호료는 카드가 비쌀수록 비싸다", () => {
  assert.ok(upgradeCost("LEGEND", 0) > upgradeCost("COMMON", 0));
  assert.ok(upgradeCost("EPIC", 5) > upgradeCost("EPIC", 0));
  // 보호료는 파괴율이 0에 가까운 첫 단계에서 거의 공짜다
  assert.ok(guardFee("EPIC", 0) < guardFee("EPIC", 5));
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
  assert.equal(r.best, null);
  assert.equal(r.over, false);
});

test("직렬화하고 되읽으면 같다", () => {
  const r = newRun("kbo-2026");
  r.credits = 1234;
  r.vault = [{ id: "타자-1", plus: 3 }];
  r.best = { id: "타자-1", plus: 3 };
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
  assert.equal(parseRun(JSON.stringify({ v: 1 })), null);
  assert.equal(parseRun(JSON.stringify({ v: 1, season: "kbo-2026", credits: "많음", vault: [], best: null, over: false })), null);
  assert.equal(parseRun(JSON.stringify({ v: 1, season: "kbo-2026", credits: 10, vault: "없음", best: null, over: false })), null);
});

test("runKey 는 시즌마다 다르다", () => {
  assert.notEqual(runKey("kbo-2026"), runKey("epl-2526"));
});
