// node --test squad.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORMATIONS,
  FORMATION_SLOTS,
  BASEBALL_SLOTS,
  POSITION_BOOST,
  canPlace,
  squadValue,
  isDuplicate,
  pruneSquad,
  bumpPlus,
  carrySquad,
  type Squad,
} from "./app/_solo/squad.ts";
import { cardValue } from "./app/_solo/economy.ts";
import type { Card } from "./app/_game/deck.ts";

// vault.test.ts 의 card 헬퍼를 따르되, 배치 판정에 쓰는 role·pos 는 테스트마다 다르므로 옵션으로 받는다.
const card = (id: string, opts: Partial<Pick<Card, "role" | "pos" | "tier">> = {}): Card => ({
  id,
  name: id,
  team: "T",
  teamId: "t",
  teamLogo: "",
  photo: "",
  pos: opts.pos ?? "",
  back: "",
  role: opts.role ?? "",
  rating: 0,
  tier: opts.tier ?? "COMMON",
  headline: "",
  stats: [],
});

test("포메이션 다섯 개가 각각 슬롯 11개다", () => {
  for (const f of FORMATIONS) {
    assert.equal(FORMATION_SLOTS[f].length, 11, f);
  }
});

test("야구 슬롯이 19개고, 종류별 개수가 맞는다", () => {
  assert.equal(BASEBALL_SLOTS.length, 19);
  const count = (g: string) => BASEBALL_SLOTS.filter((s) => s.group === g).length;
  assert.equal(count("C"), 1);
  assert.equal(count("IF"), 4);
  assert.equal(count("OF"), 3);
  assert.equal(count("DH"), 1);
  assert.equal(count("SP"), 5);
  assert.equal(count("RP"), 4);
  assert.equal(count("CL"), 1);
});

test("축구: 골키퍼는 GK 슬롯에만 들어간다", () => {
  const gk = card("gk", { role: "골키퍼" });
  for (const s of FORMATION_SLOTS["4-3-3"]) {
    assert.equal(canPlace(gk, s), s.group === "GK", s.id);
  }
});

test("축구: 스트라이커는 FW 슬롯에 들어가고 DF 슬롯엔 안 들어간다", () => {
  const st = card("st", { role: "스트라이커" });
  const fwSlot = FORMATION_SLOTS["4-3-3"].find((s) => s.id === "ST")!;
  const dfSlot = FORMATION_SLOTS["4-3-3"].find((s) => s.group === "DF")!;
  assert.equal(canPlace(st, fwSlot), true);
  assert.equal(canPlace(st, dfSlot), false);
});

test("축구: 풀백이 센터백 슬롯에 들어가되 가치 배수는 안 받는다", () => {
  const fb = card("fb", { role: "풀백", tier: "RARE" });
  const cbSlot = FORMATION_SLOTS["4-3-3"].find((s) => s.id === "CB1")!;
  assert.equal(canPlace(fb, cbSlot), true); // 대분류(DF)는 맞는다

  const squad: Squad = { [cbSlot.id]: { id: "fb", plus: 0 } };
  const byId = new Map([["fb", fb]]);
  const value = squadValue(squad, FORMATION_SLOTS["4-3-3"], byId);
  assert.equal(value, cardValue("RARE", 0), "세부가 다르면 배수가 붙으면 안 된다");
});

test("야구: 외야수가 외야 슬롯에 들어가고 내야 슬롯엔 안 들어간다", () => {
  const of = card("of", { role: "타자", pos: "외야수" });
  const ofSlot = BASEBALL_SLOTS.find((s) => s.group === "OF")!;
  const ifSlot = BASEBALL_SLOTS.find((s) => s.group === "IF")!;
  assert.equal(canPlace(of, ofSlot), true);
  assert.equal(canPlace(of, ifSlot), false);
});

test("야구: 지명타자 슬롯엔 타자면 아무나 들어가지만 투수는 못 들어간다", () => {
  const dh = BASEBALL_SLOTS.find((s) => s.group === "DH")!;
  assert.equal(canPlace(card("c", { role: "타자", pos: "포수" }), dh), true);
  assert.equal(canPlace(card("i", { role: "타자", pos: "내야수" }), dh), true);
  assert.equal(canPlace(card("o", { role: "타자", pos: "외야수" }), dh), true);
  assert.equal(canPlace(card("sp", { role: "선발", pos: "투수" }), dh), false);
  assert.equal(canPlace(card("rp", { role: "불펜", pos: "투수" }), dh), false);
});

test("야구: 선발은 중계 슬롯에 못 들어가고, 불펜은 중계·마무리 둘 다 들어간다", () => {
  const rpSlot = BASEBALL_SLOTS.find((s) => s.group === "RP")!;
  const clSlot = BASEBALL_SLOTS.find((s) => s.group === "CL")!;
  const sp = card("sp", { role: "선발" });
  const rp = card("rp", { role: "불펜" });
  assert.equal(canPlace(sp, rpSlot), false);
  assert.equal(canPlace(rp, rpSlot), true);
  assert.equal(canPlace(rp, clSlot), true);
});

test("스쿼드 가치: 주 포지션이 슬롯과 정확히 맞으면 1.2배가 붙는다", () => {
  const cb = card("cb", { role: "센터백", tier: "RARE" });
  const cbSlot = FORMATION_SLOTS["4-3-3"].find((s) => s.id === "CB1")!;
  const squad: Squad = { [cbSlot.id]: { id: "cb", plus: 0 } };
  const byId = new Map([["cb", cb]]);
  const value = squadValue(squad, FORMATION_SLOTS["4-3-3"], byId);
  assert.equal(value, Math.round(cardValue("RARE", 0) * POSITION_BOOST));
});

test("빈 스쿼드의 가치는 0이다", () => {
  assert.equal(squadValue({}, FORMATION_SLOTS["4-3-3"], new Map()), 0);
});

test("같은 선수를 두 자리에 넣으려 하면 막힌다", () => {
  const squad: Squad = { CB1: { id: "cb", plus: 0 } };
  assert.equal(isDuplicate(squad, "CB2", "cb"), true, "다른 자리엔 이미 있는 선수라 막혀야 한다");
  assert.equal(isDuplicate(squad, "CB1", "cb"), false, "자기 자리를 갱신하는 건 중복이 아니다");
});

test("카드 걷어내기: 특정 카드를 빼면 그 슬롯만 비고 나머지는 그대로다", () => {
  const squad: Squad = { CB1: { id: "a", plus: 0 }, CB2: { id: "b", plus: 3 } };
  const vaultWithoutA = [{ id: "b", plus: 3 }]; // a 는 다 팔렸다
  const next = pruneSquad(squad, vaultWithoutA);
  assert.deepEqual(next, { CB2: { id: "b", plus: 3 } });
});

test("pruneSquad: 같은 카드가 여러 장 있을 때 일부만 팔렸으면 슬롯을 그대로 둔다", () => {
  // 보관함 칸(SlotRef)은 id+강화 수치가 같은 카드를 여러 장 묶은 것이다(vault.ts). 두 장
  // 중 한 장만 팔려도 같은 id+plus 카드가 vault 에 남아 있으니 마지막 한 장이 아니다.
  const squad: Squad = { CB1: { id: "a", plus: 5 } };
  const vault = [{ id: "a", plus: 5 }];
  assert.deepEqual(pruneSquad(squad, vault), squad);
});

test("bumpPlus: 강화 성공으로 오른 카드로 슬롯이 갱신된다", () => {
  const squad: Squad = { CB1: { id: "a", plus: 2 } };
  const next = bumpPlus(squad, { id: "a", plus: 2 });
  assert.deepEqual(next, { CB1: { id: "a", plus: 3 } });
});

test("포메이션을 바꾸면 새 포메이션에도 있는 자리만 남는다", () => {
  const byId = new Map<string, Card>([
    ["gk", card("gk", { role: "골키퍼" })],
    ["fb", card("fb", { role: "풀백" })],
    ["cb", card("cb", { role: "센터백" })],
    ["mf", card("mf", { role: "미드필더" })],
  ]);
  const squad: Squad = {
    GK: { id: "gk", plus: 0 },
    LB: { id: "fb", plus: 0 },
    CB1: { id: "cb", plus: 0 },
    CDM: { id: "mf", plus: 0 }, // 4-4-2 에는 없는 자리
  };
  const next = carrySquad(squad, FORMATION_SLOTS["4-4-2"], byId);
  assert.deepEqual(Object.keys(next).sort(), ["CB1", "GK", "LB"], "4백끼리는 뒷선이 그대로 남는다");
  assert.equal(next.CDM, undefined, "새 포메이션에 없는 자리는 비운다");
});

test("자리가 살아남아도 그 선수가 못 들어가면 비운다", () => {
  // 3백으로 가면 LB·CB1 이 사라지고 CBL·CBC·CBR 만 남는다. GK 자리는 두 포메이션에 다 있다.
  const byId = new Map<string, Card>([["mf", card("mf", { role: "미드필더" })]]);
  const squad: Squad = { GK: { id: "mf", plus: 0 } }; // 억지로 꽂힌 미드필더
  assert.deepEqual(carrySquad(squad, FORMATION_SLOTS["3-5-2"], byId), {}, "canPlace 를 다시 봐서 걷어낸다");
});

test("풀에 없는 선수는 포메이션을 바꿀 때 같이 걷힌다", () => {
  const squad: Squad = { GK: { id: "사라진선수", plus: 0 } };
  assert.deepEqual(carrySquad(squad, FORMATION_SLOTS["4-3-3"], new Map()), {});
});
