"use client";

import { useEffect, useRef, useState } from "react";
import { drawPack, groupByTier, type Card, type SportConfig } from "../_game/deck";
import { KBO } from "../_sports/kbo";
import { EPL } from "../_sports/epl";
import { cardValue, isBankrupt, type Pack } from "./economy";
import { UpgradeOverlay } from "./upgrade-overlay";
import { applyUpgrade, takeFrom, toSlots, type SlotRef, type UpgradeResult } from "./vault";
import { clearRun, loadRun, newRun, saveRun, type Run } from "./storage";
import { Opening } from "./opening";
import { Result } from "./result";
import { Shop } from "./shop";
import { VaultGrid } from "./vault-grid";

const SPORTS: Record<SportConfig["key"], SportConfig> = { kbo: KBO, epl: EPL };
const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * 상태가 바뀔 때마다(구매·판매·강화) 파산 조건을 다시 잰다. 이미 over 가 켜져
 * 있으면(자발적 종료) 그대로 두고, 아니면 isBankrupt 결과로만 켠다 — 한 번 켠 종료는
 * 다시 안 끈다.
 */
function settleOver(next: Run): Run {
  return next.over || isBankrupt(next.credits, next.vault.length) ? { ...next, over: true } : next;
}

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
  // 개봉 연출이 지금 보여주는 팩. null 이면 안 열려 있다. 카드는 buy() 시점에 이미
  // vault에 커밋해두므로, 이 state는 순수하게 화면용이라 잃어도 상관없다.
  const [opening, setOpening] = useState<{ pack: Pack; cards: Card[] } | null>(null);
  // "여기까지 하고 결과 보기" 확인 모달. 되돌릴 수 없어서 한 번 멈춰 세운다.
  const [endConfirm, setEndConfirm] = useState(false);
  const endCancelRef = useRef<HTMLButtonElement>(null);

  // 마운트 직후 딱 한 번만 저장된 런으로 갈아끼운다. 커밋 이후(useEffect)에 해야
  // 하이드레이션 검사 시점과 안 겹친다. 렌더 중에 읽으면(지연 초기화든 렌더 중
  // setState든) 그 순간의 출력이 이미 저장값을 반영해버려 서버가 그린 마크업과 어긋난다.
  //
  // react-hooks/set-state-in-effect 가 이 패턴을 막지만 여기서는 끈다. 규칙이 제안하는
  // useSyncExternalStore 는 스냅샷이 매 렌더 같은 참조여야 하는데, JSON.parse 결과는
  // 매번 새 객체라 무한 렌더를 부른다. 한 번 읽고 마는 값에 캐시 장치까지 붙일 일은 아니다.
  useEffect(() => {
    // settleOver 를 여기도 거친다. 정상 플레이에서는 저장 전에 항상 이미 거쳤을 값이지만,
    // 저장값을 손으로 만들거나 옛 스키마를 옮겨온 경우까지 대비하는 한 줄이다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(settleOver(loadRun(season) ?? newRun(season)));
    setReady(true);
  }, [season]);

  useEffect(() => {
    if (ready) saveRun(run);
  }, [run, ready]);

  // SellModal·UpgradeOverlay와 같은 패턴: 열리면 취소 쪽에 포커스, Escape로 닫힌다.
  useEffect(() => {
    if (!endConfirm) return;
    endCancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEndConfirm(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endConfirm]);

  const byId = new Map(pool.map((c) => [c.id, c]));
  const slots = toSlots(run.vault);

  function buy(pack: Pack) {
    if (run.credits < pack.price) return;
    const picked = drawPack(groupByTier(pool), pack.size, Math.random, pack.rates);
    // 카드를 먼저 vault에 커밋하고서야 개봉 연출을 띄운다. 그래야 연출 중에 뒤로 가거나
    // 새로고침해도 결제한 카드가 그대로 남는다 — 연출은 이미 끝난 거래를 보여주는 것뿐이다.
    setRun((r) =>
      settleOver({
        ...r,
        credits: r.credits - pack.price,
        vault: [...r.vault, ...picked.map((c) => ({ id: c.id, plus: 0 }))],
      }),
    );
    setOpening({ pack, cards: picked });
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
      return settleOver({ ...r, vault, credits: r.credits + total });
    });
  }

  // 강화 한 번의 결과를 반영한다. 성공하면 그 한 장만 칸에서 빠져나와 plus+1 새 칸이 되고,
  // 최고 기록도 값(등급 × 강화 배수)으로 비교해 갈아끼운다. 파괴는 vault 만 줄고 best 는
  // 그대로 남는다. "+7까지 갔었다"가 이 모드의 성취라 터져도 지우면 안 된다.
  function upgrade(ref: SlotRef, result: UpgradeResult, pay: number) {
    const card = byId.get(ref.id);
    if (!card || run.credits < pay) return;
    setRun((r) => {
      const vault = applyUpgrade(r.vault, ref, result);
      let best = r.best;
      if (result === "success") {
        const value = cardValue(card.tier, ref.plus + 1);
        // 예전 기록의 선수가 풀에서 빠졌을 수 있다(방출·은퇴). 그때는 값을 0 으로 봐서
        // 새 기록이 이긴다. 화면에 못 그리는 기록이 새 기록을 막으면 안 된다.
        const prev = r.best && byId.get(r.best.id);
        const bestValue = prev ? cardValue(prev.tier, r.best!.plus) : 0;
        if (value > bestValue) best = { id: ref.id, plus: ref.plus + 1 };
      }
      return settleOver({ ...r, vault, credits: r.credits - pay, best });
    });
    // 성공하면 오버레이가 다음 단계를 보게 ref 를 올린다. 파괴는 그대로 둬 오버레이가
    // 스스로 "사라졌다"를 표시하게 하고, 유지는 어차피 같은 ref 라 손댈 게 없다.
    if (result === "success") setUpgrading({ id: ref.id, plus: ref.plus + 1 });
  }

  // 자발적 종료. 파산과 달리 보관함·크레딧은 그대로 두고 over 만 켠다.
  function endNow() {
    setRun((r) => ({ ...r, over: true }));
    setEndConfirm(false);
  }

  // 다시하기: 저장된 런을 지우고 새 런으로 갈아끼운다. 열려 있던 오버레이도 같이 닫는다.
  function restart() {
    clearRun(season);
    setUpgrading(null);
    setOpening(null);
    setRun(newRun(season));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-black tracking-tight">
          {sport.title} <span className="text-zinc-500">혼자서</span>
        </h1>
        <div className="flex items-center gap-3">
          {/* 파산 없이도 끝낼 수 있는 유일한 길. 없으면 수십 번 클릭이 남은 판에 갇힌다. */}
          {!run.over && (
            <button
              type="button"
              onClick={() => setEndConfirm(true)}
              className={`rounded-lg bg-white/8 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/15 ${FOCUS_RING}`}
            >
              여기까지 하고 결과 보기
            </button>
          )}
          <span className="text-base font-black text-amber-300 tabular-nums">
            <span className="mr-1.5 text-xs font-medium text-zinc-500">보유</span>
            {run.credits.toLocaleString()}
          </span>
        </div>
      </header>

      {run.over ? (
        <Result run={run} byId={byId} sport={sport} onRestart={restart} />
      ) : opening ? (
        <Opening
          sport={sport}
          pack={opening.pack}
          cards={opening.cards}
          onDone={() => setOpening(null)}
        />
      ) : (
        <>
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
        </>
      )}

      {endConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="런 종료 확인"
          onClick={() => setEndConfirm(false)}
          className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-zinc-950 px-6 py-5 ring-1 ring-white/10"
          >
            <div>
              <h4 className="text-base font-bold">여기까지 하고 결과를 보시겠어요?</h4>
              <p className="mt-1 text-sm text-zinc-400">
                되돌릴 수 없어요. 지금 런은 끝나고 최고 기록으로 결과가 남아요.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                ref={endCancelRef}
                type="button"
                onClick={() => setEndConfirm(false)}
                className={`rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-zinc-200 ring-1 ring-white/15 transition-colors hover:bg-white/20 ${FOCUS_RING}`}
              >
                계속할래요
              </button>
              <button
                type="button"
                onClick={endNow}
                className={`rounded-xl bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 ${FOCUS_RING}`}
              >
                여기까지
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
