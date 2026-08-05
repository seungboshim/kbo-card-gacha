// 시즌 카드 풀을 구워 data/<key>.json 에 쓴다. 깃액션이 매일 돌린다.
//
// 라이브 시즌은 매번 덮어쓰고, 끝난 시즌은 파일이 없을 때만 굽는다. 그래서 처음 한 번
// 돌리면 두 시즌이 다 생기고, 이후로는 KBO 만 갱신된다. 플래그가 필요 없다.
//
// 실행: node scripts/snapshot.ts

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SEASONS, seasonKey, type Season } from "../app/_sports/seasons.ts";
import { getKboPool } from "../app/_sports/kbo.ts";
import { getEplPool } from "../app/_sports/epl.ts";
import { withPrevTier } from "./prev-tier.ts";
import type { Card } from "../app/_game/deck.ts";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");

const FETCHERS: Record<Season["sport"], () => Promise<Card[]>> = {
  kbo: getKboPool,
  epl: getEplPool,
};

/** 없으면 null. 첫 실행이거나 파일이 깨졌을 때도 그냥 새로 굽는다. */
async function readExisting(file: string): Promise<Card[] | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Card[];
  } catch {
    return null;
  }
}

await mkdir(DATA_DIR, { recursive: true });

for (const season of SEASONS) {
  const key = seasonKey(season);
  const file = path.join(DATA_DIR, `${key}.json`);
  const existing = await readExisting(file);

  if (!season.live && existing) {
    console.log(`${key}: 끝난 시즌이고 파일이 있어 건너뛴다`);
    continue;
  }

  const fresh = await FETCHERS[season.sport]();
  const pool = withPrevTier(fresh, existing ?? []);
  const moved = pool.filter((c) => c.prevTier).length;

  await writeFile(file, JSON.stringify(pool), "utf8");
  console.log(`${key}: 카드 ${pool.length}장, 등급 변동 ${moved}장 → ${path.relative(process.cwd(), file)}`);
}
