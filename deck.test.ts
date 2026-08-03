// node --test deck.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIERS,
  drawOne,
  drawPack,
  groupByTier,
  tierRankOf,
  assignTiers,
  type Card,
  type TierKey,
} from "./app/_game/deck.ts";
import { parseInnings } from "./app/_sports/kbo.ts";
import { computeEplPool } from "./app/_sports/epl.ts";

const card = (id: string, rating: number, tier: TierKey = "COMMON", role = "타자"): Card => ({
  id,
  name: id,
  team: "",
  teamId: "",
  teamLogo: "",
  photo: "",
  pos: "",
  back: "",
  role,
  rating,
  tier,
  headline: "",
  stats: [],
});

test("등급 확률 합은 100%", () => {
  assert.equal(
    TIERS.reduce((s, t) => s + t.rate, 0),
    100,
  );
});

test("tierRankOf: COMMON=1 ... LEGEND=5", () => {
  assert.equal(tierRankOf("COMMON"), 1);
  assert.equal(tierRankOf("UNCOMMON"), 2);
  assert.equal(tierRankOf("RARE"), 3);
  assert.equal(tierRankOf("EPIC"), 4);
  assert.equal(tierRankOf("LEGEND"), 5);
});

test("이닝 문자열 파싱", () => {
  assert.ok(Math.abs(parseInnings("105 2/3") - (105 + 2 / 3)) < 1e-9);
  assert.ok(Math.abs(parseInnings("0 1/3") - 1 / 3) < 1e-9);
  assert.equal(parseInnings("12"), 12);
  assert.equal(parseInnings(""), 0);
  assert.equal(parseInnings(undefined), 0);
});

test("역할군 내 백분위로 등급이 의도한 인원수로 나뉜다", () => {
  // 100명이면 누적 pct(3/10/25/55/100%) 그대로 3/7/15/30/45명으로 갈린다.
  const cards = Array.from({ length: 100 }, (_, i) => card(String(i), 100 - i));
  const tiered = assignTiers(cards);
  const count: Record<string, number> = {};
  for (const c of tiered) count[c.tier] = (count[c.tier] ?? 0) + 1;
  assert.equal(count.LEGEND, 3);
  assert.equal(count.EPIC, 7);
  assert.equal(count.RARE, 15);
  assert.equal(count.UNCOMMON, 30);
  assert.equal(count.COMMON, 45);
});

test("확률대로 등급이 뽑힌다", () => {
  const byTier = groupByTier([card("L", 5, "LEGEND"), card("E", 3, "EPIC"), card("R", 2, "RARE"), card("U", 0.5, "UNCOMMON"), card("C", 0, "COMMON")]);
  const n = 40_000;
  let seed = 1;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647; // 결정적 LCG
  const hit: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const t = drawOne(byTier, rnd).tier;
    hit[t] = (hit[t] ?? 0) + 1;
  }
  for (const t of TIERS) {
    const pct = ((hit[t.key] ?? 0) / n) * 100;
    assert.ok(Math.abs(pct - t.rate) < 1.5, `${t.key} ${pct.toFixed(2)}% vs ${t.rate}%`);
  }
});

test("빈 등급은 아래 등급으로 흘러간다", () => {
  const byTier = groupByTier([card("C", 0, "COMMON")]);
  for (let i = 0; i < 200; i++) assert.equal(drawOne(byTier).tier, "COMMON");
});

test("drawPack은 중복 없이 n장을 준다", () => {
  const pool = Array.from({ length: 30 }, (_, i) => card(`c${i}`, i));
  const byTier = groupByTier(assignTiers(pool));
  const pack = drawPack(byTier, 10);
  assert.equal(pack.length, 10);
  assert.equal(new Set(pack.map((c) => c.id)).size, 10);
});

test("drawPack: 풀이 n보다 작으면 있는 만큼만 반환한다", () => {
  const pool = Array.from({ length: 5 }, (_, i) => card(`c${i}`, i));
  const byTier = groupByTier(assignTiers(pool));
  const pack = drawPack(byTier, 10);
  assert.equal(pack.length, 5);
  assert.equal(new Set(pack.map((c) => c.id)).size, 5);
});

test("EPL: 포지션별 rating 순서가 의도대로 나온다", () => {
  const rows = [
    { playerId: "g1", playerName: "G1", position: "GK", minsPlayed: 700, cleanSheets: 19, saves: 0 },
    { playerId: "g2", playerName: "G2", position: "GK", minsPlayed: 700, cleanSheets: 10, saves: 100 },
    { playerId: "d1", playerName: "D1", position: "DF", minsPlayed: 1000, cleanSheets: 17, goals: 3, assists: 4 },
    { playerId: "d2", playerName: "D2", position: "DF", minsPlayed: 1000, cleanSheets: 10, goals: 0, assists: 5 },
    { playerId: "m1", playerName: "M1", position: "MF", minsPlayed: 1000, goals: 9, assists: 21, keyPasses: 0 },
    { playerId: "m2", playerName: "M2", position: "MF", minsPlayed: 1000, goals: 15, assists: 4, keyPasses: 0 },
    { playerId: "f1", playerName: "F1", position: "FW", minsPlayed: 1000, goals: 27, assists: 8 },
    { playerId: "f2", playerName: "F2", position: "FW", minsPlayed: 1000, goals: 22, assists: 1 },
  ];
  const pool = computeEplPool(rows);
  const byRole = (role: string) => pool.filter((c) => c.role === role);
  assert.equal(byRole("골키퍼")[0].name, "G1"); // 클린시트 19가 세이브 100보다 앞선다
  assert.equal(byRole("수비수")[0].name, "D1");
  assert.equal(byRole("미드필더")[0].name, "M1");
  assert.equal(byRole("공격수")[0].name, "F1");
});

test("EPL: 최소 출전 필터가 GK 600 / 나머지 900으로 갈린다", () => {
  const rows = [
    { playerId: "g-in", playerName: "GIn", position: "GK", minsPlayed: 600, cleanSheets: 1 },
    { playerId: "g-out", playerName: "GOut", position: "GK", minsPlayed: 599, cleanSheets: 1 },
    { playerId: "d-in", playerName: "DIn", position: "DF", minsPlayed: 900, cleanSheets: 1 },
    { playerId: "d-out", playerName: "DOut", position: "DF", minsPlayed: 899, cleanSheets: 1 },
    { playerId: "m-in", playerName: "MIn", position: "MF", minsPlayed: 900, goals: 1 },
    { playerId: "m-out", playerName: "MOut", position: "MF", minsPlayed: 899, goals: 1 },
    { playerId: "f-in", playerName: "FIn", position: "FW", minsPlayed: 900, goals: 1 },
    { playerId: "f-out", playerName: "FOut", position: "FW", minsPlayed: 899, goals: 1 },
  ];
  const ids = new Set(computeEplPool(rows).map((c) => c.id));
  assert.ok(ids.has("g-in") && !ids.has("g-out"));
  assert.ok(ids.has("d-in") && !ids.has("d-out"));
  assert.ok(ids.has("m-in") && !ids.has("m-out"));
  assert.ok(ids.has("f-in") && !ids.has("f-out"));
});
