// node --test battle.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRound, battleEnd, frontOf, isFinalRound, resolveRound, stalemateLimit, survivorsOf } from "./app/_game/battle.ts";
import type { Card, TierKey } from "./app/_game/deck.ts";

const card = (id: string, tier: TierKey, rating = 0): Card => ({
  id,
  name: id,
  team: "",
  teamId: "",
  teamLogo: "",
  photo: "",
  pos: "",
  back: "",
  role: "",
  rating,
  tier,
  headline: "",
  stats: [],
});

// 결과 화면 스택과 같은 규칙: 배열 마지막이 맨 앞
const deck = (...tiers: TierKey[]) => tiers.map((t, i) => card(`${t}${i}`, t));

test("맨 앞 카드는 배열의 마지막", () => {
  const d = deck("COMMON", "LEGEND");
  assert.equal(frontOf(d)!.tier, "LEGEND");
  assert.equal(frontOf([]), undefined);
});

test("등급 점수가 가장 높은 카드만 살아남는다", () => {
  const r = resolveRound([deck("LEGEND"), deck("EPIC"), deck("COMMON")])!;
  assert.equal(r.winners.length, 1);
  assert.equal(r.winners[0].player, 0);
  assert.deepEqual(
    r.losers.map((l) => l.player),
    [1, 2],
  );
  assert.equal(r.draw, false);
});

test("최고 등급이 여러 장이면 그 판은 무승부고 그 카드들이 다 산다", () => {
  const r = resolveRound([deck("EPIC"), deck("COMMON"), deck("EPIC"), deck("RARE")])!;
  assert.equal(r.draw, true);
  assert.deepEqual(
    r.winners.map((w) => w.player),
    [0, 2],
  );
  assert.deepEqual(
    r.losers.map((l) => l.player),
    [1, 3],
  );
});

test("카드가 없는 플레이어는 판에 안 들어온다", () => {
  const r = resolveRound([[], deck("COMMON"), []])!;
  assert.deepEqual(
    r.entries.map((e) => e.player),
    [1],
  );
  assert.equal(r.losers.length, 0); // 혼자면 자기가 최고라 안 죽는다
});

test("패자 카드는 사라지고 승자 카드는 맨 뒤로 밀려난다", () => {
  // 0번은 [커먼, 레전드] → 맨 앞이 레전드. 1번은 [에픽] 하나
  const decks = [deck("COMMON", "LEGEND"), deck("EPIC")];
  const after = applyRound(decks, resolveRound(decks)!);
  // 승자(0번): 레전드가 맨 뒤(배열 앞)로, 커먼이 다시 맨 앞
  assert.deepEqual(
    after[0].map((c) => c.tier),
    ["LEGEND", "COMMON"],
  );
  assert.equal(frontOf(after[0])!.tier, "COMMON");
  // 패자(1번): 카드 사라짐
  assert.deepEqual(after[1], []);
});

test("무승부면 아무도 안 죽고 둘 다 맨 뒤로 밀려난다", () => {
  const decks = [deck("RARE", "EPIC"), deck("COMMON", "EPIC")];
  const r = resolveRound(decks)!;
  const after = applyRound(decks, r);
  assert.equal(r.draw, true);
  assert.equal(after[0].length, 2);
  assert.equal(after[1].length, 2);
  assert.equal(frontOf(after[0])!.tier, "RARE"); // 한 바퀴 돌아 다음 카드가 앞으로
  assert.equal(frontOf(after[1])!.tier, "COMMON");
});

test("한 명만 카드가 남으면 그 사람 우승", () => {
  const end = battleEnd([deck("LEGEND"), []], 0, 5);
  assert.deepEqual(end, { finished: true, champions: [0], stalemate: false });
});

test("파괴 없는 판이 한 바퀴 이어지면 교착으로 공동 우승", () => {
  const decks = [deck("EPIC"), deck("EPIC")];
  const limit = stalemateLimit(decks);
  assert.equal(limit, 1);
  assert.deepEqual(battleEnd(decks, 0, limit), { finished: false, champions: [], stalemate: false });
  assert.deepEqual(battleEnd(decks, 1, limit), { finished: true, champions: [0, 1], stalemate: true });
});

test("전원 같은 등급이면 덱이 줄지 않는다 (교착 조건이 필요한 이유)", () => {
  let decks = [deck("COMMON", "COMMON"), deck("COMMON", "COMMON")];
  for (let i = 0; i < 4; i++) {
    const r = resolveRound(decks)!;
    assert.equal(r.losers.length, 0);
    decks = applyRound(decks, r);
  }
  assert.deepEqual(decks.map((d) => d.length), [2, 2]);
  assert.deepEqual(survivorsOf(decks), [0, 1]);
});

test("등급이 섞이면 매 판 최소 한 장은 죽어 결국 끝난다", () => {
  let decks = [deck("COMMON", "LEGEND"), deck("RARE", "EPIC"), deck("COMMON", "COMMON")];
  let quiet = 0;
  for (let guard = 0; guard < 50; guard++) {
    const limit = stalemateLimit(decks);
    const end = battleEnd(decks, quiet, limit);
    if (end.finished) {
      assert.equal(end.stalemate, false);
      assert.deepEqual(end.champions, [0]); // 레전드를 가진 0번이 남는다
      return;
    }
    const r = resolveRound(decks)!;
    quiet = r.losers.length === 0 ? quiet + 1 : 0;
    decks = applyRound(decks, r);
  }
  assert.fail("50판 안에 끝나지 않았다");
});

test("막배틀은 모두 1장 이하일 때만", () => {
  assert.equal(isFinalRound([deck("EPIC"), deck("EPIC")]), true);
  assert.equal(isFinalRound([deck("EPIC"), []]), true);
  assert.equal(isFinalRound([deck("EPIC", "RARE"), deck("EPIC")]), false);
});

test("평소엔 등급이 같으면 무승부로 남는다", () => {
  // 아직 2장씩 남았으니 막배틀이 아니다. rating 이 달라도 무승부여야 한다.
  const decks = [
    [card("a0", "RARE", 1), card("a1", "EPIC", 9)],
    [card("b0", "RARE", 1), card("b1", "EPIC", 2)],
  ];
  const r = resolveRound(decks)!;
  assert.equal(r.draw, true);
  assert.equal(r.winners.length, 2);
  assert.equal(r.losers.length, 0);
});

test("막배틀에서 등급이 같으면 활약도로 가른다", () => {
  const decks = [[card("a", "EPIC", 3.1)], [card("b", "EPIC", 7.4)], [card("c", "COMMON", 9.9)]];
  const r = resolveRound(decks)!;
  assert.equal(r.draw, false);
  assert.equal(r.winners.length, 1);
  assert.equal(r.winners[0].player, 1); // 등급 같은 둘 중 rating 7.4 가 이긴다
  assert.deepEqual(
    r.losers.map((l) => l.player).sort(),
    [0, 2], // 등급이 낮은 c 는 rating 이 가장 높아도 진다
  );
});

test("막배틀에서 등급도 활약도도 같으면 무승부로 끝난다", () => {
  const decks = [[card("a", "EPIC", 5)], [card("b", "EPIC", 5)]];
  const r = resolveRound(decks)!;
  assert.equal(r.draw, true);
  assert.equal(r.losers.length, 0);
});
