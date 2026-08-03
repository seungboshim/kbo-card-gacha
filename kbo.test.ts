// node --test kbo.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIERS,
  drawOne,
  drawPack,
  groupByTier,
  tierRankOf,
  assignTiers,
  parseInnings,
  type Card,
  type Role,
  type TierKey,
} from "./app/kbo.ts";

const card = (id: string, war: number, tier: TierKey = "COMMON", role: Role = "타자"): Card => ({
  id,
  name: id,
  team: "",
  teamId: "",
  teamLogo: "",
  photo: "",
  pos: "",
  back: "",
  role,
  war,
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
