"use client";

import { useEffect, useState } from "react";
import { PlayerCard } from "../_game/card";
import { drawPack, groupByTier, type Card, type SportConfig } from "../_game/deck";
import { KBO } from "../_sports/kbo";
import { EPL } from "../_sports/epl";
import { cardValue, type Pack } from "./economy";
import { toSlots } from "./vault";
import { loadRun, newRun, saveRun, type Run } from "./storage";
import { Shop } from "./shop";

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
  // 하이드레이션 검사 시점(서버 출력과 비교하는 순간)과 안 겹친다 — 렌더 중에 하면
  // (지연 초기화든 렌더 중 setState든) 그 순간의 출력이 이미 저장값을 반영해버려
  // 서버가 그린 마크업과 어긋난다. react-hooks/set-state-in-effect 는 이 패턴을
  // 일반적으로 막지만, 외부 저장소(localStorage)를 하이드레이션 안전하게 읽는 이
  // 경우엔 규칙이 제안하는 useSyncExternalStore 가 오히려 과하다(그 훅은 스냅샷이
  // 매 렌더 같은 참조여야 하는데 JSON.parse 결과는 매번 새 객체라 무한 렌더를 부른다).
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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">
          보관함 <span className="text-zinc-600">{slots.length}칸 · {run.vault.length}장</span>
        </h2>
        {slots.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-600">아직 카드가 없어요. 팩을 사보세요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {slots.map((s) => {
              const card = byId.get(s.id);
              if (!card) return null;
              return (
                <div key={`${s.id}-${s.plus}`} className="flex flex-col gap-1.5">
                  <PlayerCard card={card} sport={sport} size="mini" plus={s.plus} />
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-bold tabular-nums text-zinc-400">
                      {cardValue(card.tier, s.plus).toLocaleString()}
                    </span>
                    {s.count > 1 && (
                      <span className="rounded bg-white/7 px-1.5 text-[10px] font-bold text-zinc-500 tabular-nums">
                        {s.count}장
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
