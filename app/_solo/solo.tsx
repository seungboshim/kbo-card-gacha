"use client";

import { useEffect, useState } from "react";
import { drawPack, groupByTier, type Card, type SportConfig } from "../_game/deck";
import { KBO } from "../_sports/kbo";
import { EPL } from "../_sports/epl";
import { cardValue, type Pack } from "./economy";
import { UpgradeOverlay } from "./upgrade-overlay";
import { applyUpgrade, takeFrom, toSlots, type SlotRef, type UpgradeResult } from "./vault";
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
  // 강화 오버레이가 지금 다루는 칸. null 이면 안 열려 있다.
  const [upgrading, setUpgrading] = useState<SlotRef | null>(null);

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

  // 강화 한 번의 결과를 반영한다. 성공하면 그 한 장만 칸에서 빠져나와 plus+1 새 칸이 되고,
  // 최고 기록도 값(등급 × 강화 배수)으로 비교해 갈아끼운다. 파괴는 vault 만 줄고 best 는
  // 그대로 남는다 — "+7까지 갔었다"가 이 모드의 성취라 터져도 지우면 안 된다.
  function upgrade(ref: SlotRef, result: UpgradeResult, pay: number) {
    const card = byId.get(ref.id);
    if (!card || run.credits < pay) return;
    setRun((r) => {
      const vault = applyUpgrade(r.vault, ref, result);
      let best = r.best;
      if (result === "success") {
        const value = cardValue(card.tier, ref.plus + 1);
        const bestValue = r.best ? cardValue(byId.get(r.best.id)!.tier, r.best.plus) : 0;
        if (value > bestValue) best = { id: ref.id, plus: ref.plus + 1 };
      }
      return { ...r, vault, credits: r.credits - pay, best };
    });
    // 성공하면 오버레이가 다음 단계를 보게 ref 를 올린다. 파괴는 그대로 둬 오버레이가
    // 스스로 "사라졌다"를 표시하게 하고, 유지는 어차피 같은 ref 라 손댈 게 없다.
    if (result === "success") setUpgrading({ id: ref.id, plus: ref.plus + 1 });
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

      <VaultGrid
        slots={slots}
        byId={byId}
        sport={sport}
        onSell={sell}
        onUpgrade={setUpgrading}
        upgradeOpen={upgrading !== null}
      />

      {upgrading && byId.get(upgrading.id) && (
        <UpgradeOverlay
          card={byId.get(upgrading.id)!}
          sport={sport}
          plus={upgrading.plus}
          credits={run.credits}
          onClose={() => setUpgrading(null)}
          onUpgrade={(result, pay) => upgrade(upgrading, result, pay)}
        />
      )}
    </main>
  );
}
