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
import { parseInnings, meetsMinimum } from "./app/_sports/kbo.ts";
import { computeEplPool, type StatMaps, type StatRow } from "./app/_sports/epl.ts";

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
  // 100명이면 누적 pct(3/10/35/65/100%) 그대로 3/7/25/30/35명으로 갈린다.
  const cards = Array.from({ length: 100 }, (_, i) => card(String(i), 100 - i));
  const tiered = assignTiers(cards);
  const count: Record<string, number> = {};
  for (const c of tiered) count[c.tier] = (count[c.tier] ?? 0) + 1;
  assert.equal(count.LEGEND, 3);
  assert.equal(count.EPIC, 7);
  assert.equal(count.RARE, 25);
  assert.equal(count.UNCOMMON, 30);
  assert.equal(count.COMMON, 35);
});

test("34명 미만 역할군도 1위는 레전드가 된다", () => {
  // 22명이면 1위 백분위가 1/22 = 4.5%라 3% 컷에 안 걸린다. 골키퍼 풀이 이 크기다.
  for (const n of [22, 29, 33]) {
    const tiered = assignTiers(Array.from({ length: n }, (_, i) => card(String(i), n - i)));
    assert.equal(tiered[0].tier, "LEGEND", `${n}명 풀의 1위`);
    assert.equal(tiered.filter((c) => c.tier === "LEGEND").length, 1, `${n}명 풀의 레전드 수`);
  }
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

// FotMob 평점 목록 한 줄. 카드 하나를 만드는 데 필요한 최소 필드만 채운다.
const fmRow = (id: number, name: string, code: number, rating: number, mins = 2000, extra: Partial<StatRow> = {}): StatRow => ({
  ParticiantId: id,
  ParticipantName: name,
  TeamId: 9825,
  TeamName: "Arsenal",
  StatValue: rating,
  MinutesPlayed: mins,
  MatchesPlayed: 30,
  Positions: [code],
  ...extra,
});
/** 스탯 파일 하나를 흉내낸다. [선수ID, 값, 부제값] 목록을 받는다. */
const fmStat = (rows: [number, number, number?][]): Map<number, StatRow> =>
  new Map(rows.map(([id, v, sub]) => [id, { ...fmRow(id, String(id), 11, 0), StatValue: v, SubStatValue: sub }]));

test("EPL: 포지션 코드가 7개 역할군으로 갈린다", () => {
  const rows = [
    fmRow(1, "GK", 11, 7.2),
    fmRow(2, "CB", 34, 7.1),
    fmRow(3, "FB", 38, 7.0),
    fmRow(4, "MF", 66, 7.5),
    fmRow(5, "AM", 85, 8.0),
    fmRow(6, "WG", 87, 7.3),
    fmRow(7, "ST", 115, 7.6),
  ];
  const pool = computeEplPool(rows, {});
  assert.deepEqual(
    pool.map((c) => c.role).sort(),
    ["골키퍼", "공격형MF", "미드필더", "센터백", "스트라이커", "윙어", "풀백"],
  );
  // 알 수 없는 코드는 버린다(리그 데이터에 새 코드가 들어와도 카드가 깨지지 않게)
  assert.equal(computeEplPool([fmRow(8, "??", 999, 7.0)], {}).length, 0);
});

test("EPL: 등급은 FotMob 평점 순위로만 갈린다", () => {
  // 같은 역할군 5명. 평점만 다르고 다른 스탯은 없다.
  const rows = [1, 2, 3, 4, 5].map((i) => fmRow(i, `P${i}`, 115, 6.0 + i * 0.1));
  const pool = computeEplPool(rows, {});
  assert.equal(pool[0].name, "P5"); // 6.5로 가장 높다
  assert.equal(pool[0].tier, "LEGEND"); // 5명뿐이어도 1위는 레전드
  assert.equal(pool[0].rating, 6.5);
  assert.deepEqual(
    pool.map((c) => c.name),
    ["P5", "P4", "P3", "P2", "P1"],
  );
});

test("EPL: 최소 출전 1500분으로 갈린다", () => {
  const rows = [fmRow(1, "In", 66, 7.0, 1500), fmRow(2, "Out", 66, 9.9, 1499)];
  const pool = computeEplPool(rows, {});
  assert.deepEqual(pool.map((c) => c.name), ["In"]); // 평점이 높아도 출전이 모자라면 빠진다
});

test("EPL: 스탯 8칸에 평점이 들어가고 없는 기록은 0으로 채운다", () => {
  const rows = [fmRow(1, "ST", 115, 7.68), fmRow(2, "GK", 11, 7.24)];
  const stats: StatMaps = {
    goals: fmStat([[1, 27]]),
    goal_assist: fmStat([[1, 8, 2.8]]),
    expected_goals: fmStat([[1, 25.4]]),
    clean_sheet: fmStat([[2, 19]]),
    _save_percentage: fmStat([[2, 73]]),
  };
  const pool = computeEplPool(rows, stats);
  for (const c of pool) {
    assert.equal(c.stats.length, 8);
    assert.equal(c.stats.at(-1)!.k, "평점"); // 합성값이 아니라 FotMob 실제 평점이라 감추지 않는다
  }
  const st = pool.find((c) => c.role === "스트라이커")!;
  assert.equal(st.stats.find((s) => s.k === "골")!.v, "27");
  assert.equal(st.stats.find((s) => s.k === "xG")!.v, "25.4");
  assert.equal(st.stats.at(-1)!.v, "7.68");
  assert.equal(st.stats.find((s) => s.k === "유효슛/90")!.v, "0.0"); // 파일에 없으면 0
  // 누적과 90분당이 섞이므로 90분당인 칸만 라벨로 구분한다
  assert.ok(st.stats.some((s) => s.k === "골") && !st.stats.some((s) => s.k === "골/90"));
  const gk = pool.find((c) => c.role === "골키퍼")!;
  assert.equal(gk.stats.find((s) => s.k === "클린시트")!.v, "19");
  assert.equal(gk.stats.find((s) => s.k === "선방률")!.v, "73%");
});

test("EPL: 한글 이름이 있으면 바꾸고 없으면 영문 그대로 둔다", () => {
  const rows = [fmRow(1, "Erling Haaland", 115, 7.68), fmRow(2, "Nobody Unknown", 115, 7.0)];
  const pool = computeEplPool(rows, {});
  assert.equal(pool.find((c) => c.id === "1")!.name, "엘링 홀란");
  assert.equal(pool.find((c) => c.id === "2")!.name, "Nobody Unknown");
});

test("EPL: 팀 이름과 이미지 주소를 채운다", () => {
  const pool = computeEplPool([fmRow(999999, "Nobody Unknown", 115, 7.0, 2000, { TeamId: 8456, TeamName: "Manchester City" })], {});
  const c = pool[0];
  assert.equal(c.team, "맨체스터 시티");
  assert.equal(c.teamLogo, "https://images.fotmob.com/image_resources/logo/teamlogo/8456.png");
  assert.equal(c.photo, "https://images.fotmob.com/image_resources/playerimages/999999.png");
  assert.equal(c.back, ""); // 평점 목록에 등번호가 없다
});

test("EPL: 레전드 후보는 등번호와 큰 사진을 따로 얹는다", () => {
  const pool = computeEplPool([fmRow(737066, "Erling Haaland", 115, 7.68, 2000, { TeamId: 8456 })], {});
  const c = pool[0];
  assert.equal(c.back, "#9");
  assert.equal(c.photo, "https://sports-phinf.pstatic.net/player/wfootball/default/991181.png");
});

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

test("drawOne: 확률표를 주면 그걸 따른다", () => {
  const pool = [card("c", 1, "COMMON"), card("l", 5, "LEGEND")];
  const byTier = groupByTier(pool);
  // 레전드 100%, 나머지 0% 인 표를 주면 항상 레전드가 나와야 한다
  const onlyLegend = { LEGEND: 100, EPIC: 0, RARE: 0, UNCOMMON: 0, COMMON: 0 };
  for (let i = 0; i < 20; i++) {
    assert.equal(drawOne(byTier, () => i / 20, onlyLegend).tier, "LEGEND");
  }
});

test("drawPack: 확률표를 주면 그걸 따른다", () => {
  const pool = [card("c1", 1, "COMMON"), card("c2", 1, "COMMON"), card("l", 5, "LEGEND")];
  const byTier = groupByTier(pool);
  const onlyCommon = { LEGEND: 0, EPIC: 0, RARE: 0, UNCOMMON: 0, COMMON: 100 };
  // 상수 rnd(()=>0.5)를 쓰면 매 호출이 같은 카드를 반환해 20회 재시도가 바로 소진되고,
  // "남은 풀에서 채우기"(등급 무관, 원래부터 있던 동작)로 빠져 LEGEND가 새어든다.
  // 그 fallback 은 의도적으로 그대로 두는 로직이라(계획 문서 참고), 여기선 값을 바꿔가며
  // 굴려서 rates 를 따르는 정상 경로를 검증한다.
  let n = 0;
  const rnd = () => (n++ % 4) / 4;
  const picked = drawPack(byTier, 2, rnd, onlyCommon);
  assert.equal(picked.length, 2);
  assert.ok(picked.every((c) => c.tier === "COMMON"));
});

test("drawOne: 확률표를 안 주면 TIERS 를 쓴다", () => {
  // 기존 동작이 그대로인지 확인한다. 커먼만 있는 풀이면 뭘 굴려도 커먼이다.
  const byTier = groupByTier([card("c", 1, "COMMON")]);
  assert.equal(drawOne(byTier, () => 0.99).tier, "COMMON");
});
