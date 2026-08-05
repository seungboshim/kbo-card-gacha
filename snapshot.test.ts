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
