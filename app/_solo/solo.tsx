"use client";

import { useEffect, useState } from "react";
import { drawPack, groupByTier, type Card, type SportConfig } from "../_game/deck";
import { KBO } from "../_sports/kbo";
import { EPL } from "../_sports/epl";
import { cardValue, type Pack } from "./economy";
import { takeFrom, toSlots, type SlotRef } from "./vault";
import { loadRun, newRun, saveRun, type Run } from "./storage";
import { Shop } from "./shop";
import { VaultGrid } from "./vault-grid";

const SPORTS: Record<SportConfig["key"], SportConfig> = { kbo: KBO, epl: EPL };

export default function Solo({
  pool,
  sport: sportKey,
  season,
}: {
  pool: Card[];
  sport: SportConfig["key"];
  season: string;
}) {
  const sport = SPORTS[sportKey];
  // 서버 렌더에서는 localStorage 를 못 읽으므로 새 런으로 시작했다가,
  // 브라우저에 붙은 뒤 저장된 런이 있으면 갈아끼운다. 그래야 하이드레이션이 안 어긋난다.
  const [run, setRun] = useState<Run>(() => newRun(season));
  const [ready, setReady] = useState(false);

  // 마운트 직후 딱 한 번만 저장된 런으로 갈아끼운다. 커밋 이후(useEffect)에 해야
  // 하이드레이션 검사 시점과 안 겹친다. 렌더 중에 읽으면(지연 초기화든 렌더 중
  // setState든) 그 순간의 출력이 이미 저장값을 반영해버려 서버가 그린 마크업과 어긋난다.
  //
  // react-hooks/set-state-in-effect 가 이 패턴을 막지만 여기서는 끈다. 규칙이 제안하는
  // useSyncExternalStore 는 스냅샷이 매 렌더 같은 참조여야 하는데, JSON.parse 결과는
  // 매번 새 객체라 무한 렌더를 부른다. 한 번 읽고 마는 값에 캐시 장치까지 붙일 일은 아니다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(loadRun(season) ?? newRun(season));
    setReady(true);
  }, [season]);

  useEffect(() => {
    if (ready) saveRun(run);
  }, [run, ready]);

  const byId = new Map(pool.map((c) => [c.id, c]));
  const slots = toSlots(run.vault);

  function buy(pack: Pack) {
    if (run.credits < pack.price) return;
    const picked = drawPack(groupByTier(pool), pack.size, Math.random, pack.rates);
    setRun((r) => ({
      ...r,
      credits: r.credits - pack.price,
      vault: [...r.vault, ...picked.map((c) => ({ id: c.id, plus: 0 }))],
    }));
  }

  // 골라진 칸마다 takeFrom 으로 실제 장수를 빼고, 뺀 만큼의 값을 합쳐 크레딧에 더한다.
  function sell(picks: { ref: SlotRef; take: number }[]) {
    setRun((r) => {
      let vault = r.vault;
      let total = 0;
      for (const p of picks) {
        const card = byId.get(p.ref.id);
        if (card) total += cardValue(card.tier, p.ref.plus) * p.take;
        vault = takeFrom(vault, p.ref, p.take);
      }
      return { ...r, vault, credits: r.credits + total };
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-black tracking-tight">
          {sport.title} <span className="text-zinc-500">혼자서</span>
        </h1>
        <span className="text-base font-black text-amber-300 tabular-nums">
          <span className="mr-1.5 text-xs font-medium text-zinc-500">보유</span>
          {run.credits.toLocaleString()}
        </span>
      </header>

      <Shop credits={run.credits} onBuy={buy} />

      <VaultGrid slots={slots} byId={byId} sport={sport} onSell={sell} />
    </main>
  );
}
