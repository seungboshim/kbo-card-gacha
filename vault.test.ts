// node --test vault.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { sortSlots, type Slot } from "./app/_solo/vault.ts";
import { cardValue } from "./app/_solo/economy.ts";
import type { Card, TierKey } from "./app/_game/deck.ts";

// 정렬만 보면 되니 등급・id 말고는 다 더미 값이다.
const card = (id: string, tier: TierKey): Card => ({
  id,
  name: id,
  team: "T",
  teamId: "t",
  teamLogo: "",
  photo: "",
  pos: "",
  back: "",
  role: "",
  rating: 0,
  tier,
  headline: "",
  stats: [],
});
const mapOf = (cards: Card[]): Map<string, Card> => new Map(cards.map((c) => [c.id, c]));
const slot = (id: string, plus: number, count = 1): Slot => ({ id, plus, count });

test("획득순은 입력 순서를 그대로 돌려준다", () => {
  const byId = mapOf([card("a", "COMMON"), card("b", "LEGEND"), card("c", "RARE")]);
  const slots = [slot("b", 0), slot("a", 0), slot("c", 3)];
  const sorted = sortSlots(slots, "acquired", byId);
  assert.deepEqual(sorted.map((s) => s.id), ["b", "a", "c"]);
});

test("등급순은 레전드가 커먼보다 앞이다", () => {
  const byId = mapOf([card("common", "COMMON"), card("legend", "LEGEND")]);
  const slots = [slot("common", 0), slot("legend", 0)];
  const sorted = sortSlots(slots, "tier", byId);
  assert.deepEqual(sorted.map((s) => s.id), ["legend", "common"]);
});

test("등급이 같으면 가치가 높은 쪽이 앞이다", () => {
  // 같은 선수 id 라도 강화 수치가 다르면 다른 칸이니, 같은 등급 두 칸을 만들려고
  // id 를 다르게 둔다(칸 자체는 어차피 id+plus 로 갈린다).
  const byId = mapOf([card("rareLow", "RARE"), card("rareHigh", "RARE")]);
  const slots = [slot("rareLow", 0), slot("rareHigh", 5)];
  const sorted = sortSlots(slots, "tier", byId);
  assert.deepEqual(sorted.map((s) => s.id), ["rareHigh", "rareLow"]);
});

test("가치순은 등급이 낮아도 고강화면 앞설 수 있다", () => {
  // 전제부터 확인한다: RARE+10 이 EPIC+0 보다 실제로 비싸야 이 테스트가 말이 된다.
  assert.ok(cardValue("RARE", 10) > cardValue("EPIC", 0), "예제 전제가 깨졌다 - RARE+10 이 EPIC+0 보다 안 비싸다");
  const byId = mapOf([card("rare10", "RARE"), card("epic0", "EPIC")]);
  const slots = [slot("epic0", 0), slot("rare10", 10)];
  const sorted = sortSlots(slots, "value", byId);
  assert.deepEqual(sorted.map((s) => s.id), ["rare10", "epic0"]);
});

test("강화순은 강화 수치 내림차순이다", () => {
  const byId = mapOf([card("a", "RARE"), card("b", "RARE"), card("c", "RARE")]);
  const slots = [slot("a", 2), slot("b", 7), slot("c", 0)];
  const sorted = sortSlots(slots, "plus", byId);
  assert.deepEqual(sorted.map((s) => s.id), ["b", "a", "c"]);
});

test("원본 배열을 안 건드린다", () => {
  const byId = mapOf([card("a", "COMMON"), card("b", "LEGEND")]);
  const slots = [slot("a", 0), slot("b", 0)];
  const before = slots.map((s) => s.id);
  sortSlots(slots, "value", byId);
  assert.deepEqual(slots.map((s) => s.id), before, "정렬 호출이 입력 배열 순서를 바꿨다");
});

test("풀에 없는 id 가 섞여 있어도 안 터지고, 결과 길이가 입력과 같다", () => {
  const byId = mapOf([card("a", "RARE")]);
  const slots = [slot("a", 3), slot("방출된선수", 5)];
  for (const by of ["tier", "value", "plus"] as const) {
    const sorted = sortSlots(slots, by, byId);
    assert.equal(sorted.length, slots.length, `by=${by}`);
  }
});
