"use client";

import { useEffect, useState } from "react";
import { EnlargedCard } from "./enlarged-card";
import type { Card, SportConfig } from "../_game/deck";
import { Coin } from "./coin";
import { cardValue } from "./economy";
import { SellModal } from "./sell-modal";
import { SlotCard } from "./slot-card";
import type { Slot, SlotRef } from "./vault";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const keyOf = (ref: SlotRef) => `${ref.id}:${ref.plus}`;

type Mode = "idle" | "picking";
/** 칸 키 → 고른 장수. 0 장은 항목을 안 둔다(없으면 0 인 것과 같다). */
type Selection = Record<string, number>;
/** 판매 확인에 넘길 항목. 하단 바 고르기든 확대 화면이든 여기로 모인다. */
type PendingSell = { ref: SlotRef; card: Card; take: number }[];

/** 보관함 도감. 평상시엔 값과 장수, 고르기 중엔 수량 핸들. 판매·강화 진입점을 여기서 모두 다룬다. */
export function VaultGrid({
  slots,
  byId,
  sport,
  onSell,
  onUpgrade,
  upgradeOpen,
}: {
  slots: Slot[];
  byId: Map<string, Card>;
  sport: SportConfig;
  onSell: (picks: { ref: SlotRef; take: number }[]) => void;
  /** 한 칸에서 한 장만 골랐을 때만 불린다. 부모가 강화 오버레이를 연다. */
  onUpgrade: (ref: SlotRef) => void;
  /** 강화 오버레이가 지금 열려 있는가. 열려 있는 동안은 고르기를 그대로 둔다(오버레이가
   *  화면을 다 덮으므로 뒤에 있어도 문제없다) - 그래야 오버레이가 닫힐 때 이 강화 버튼으로
   *  포커스가 돌아올 자리가 남는다. */
  upgradeOpen: boolean;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [selection, setSelection] = useState<Selection>({});
  const [enlarged, setEnlarged] = useState<Slot | null>(null);
  const [enlargedTake, setEnlargedTake] = useState(1);
  // 하단 바에서 고른 것이든 확대 화면에서 정한 수량이든, 팔기를 누르면 여기로 모인다.
  // selection 을 그대로 재활용하지 않는 이유: 확대 화면의 수량은 selection 에 없다.
  // 억지로 밀어넣으면 판매를 취소했을 때 눈에 안 보이는 선택이 남아, 나중에 고르기
  // 모드에 들어가는 순간 유령처럼 되살아난다.
  const [pendingSell, setPendingSell] = useState<PendingSell | null>(null);

  function exitPicking() {
    setMode("idle");
    setSelection({});
  }

  // Escape 는 위 레이어부터 하나씩 닫는다. 확대 화면은 EnlargedCard 가 자기 Escape 를
  // 따로 처리하고(포커스 복원까지 그쪽으로 옮겼다), 판매 확인 모달·강화 오버레이도
  // 각자 처리하므로(SellModal, UpgradeOverlay) 여기서는 고르기 모드만 본다.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || upgradeOpen || enlarged) return;
      if (mode === "picking" && pendingSell === null) exitPicking();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged, mode, pendingSell, upgradeOpen]);

  function enterPickingWith(ref: SlotRef) {
    setMode("picking");
    setSelection((sel) => ({ ...sel, [keyOf(ref)]: 1 }));
  }

  function toggle(ref: SlotRef, count: number) {
    setSelection((sel) => {
      const k = keyOf(ref);
      if ((sel[k] ?? 0) > 0) {
        const next = { ...sel };
        delete next[k];
        return next;
      }
      return { ...sel, [k]: Math.min(1, count) };
    });
  }

  function bump(ref: SlotRef, delta: number, count: number) {
    setSelection((sel) => {
      const k = keyOf(ref);
      const n = Math.max(0, Math.min(count, (sel[k] ?? 0) + delta));
      const next = { ...sel };
      if (n === 0) delete next[k];
      else next[k] = n;
      return next;
    });
  }

  const totalCards = slots.reduce((a, s) => a + s.count, 0);
  const picked = slots
    .map((slot) => ({ slot, take: selection[keyOf(slot)] ?? 0 }))
    .filter((p) => p.take > 0);
  const sellTotal = picked.reduce((a, p) => {
    const card = byId.get(p.slot.id);
    return card ? a + cardValue(card.tier, p.slot.plus) * p.take : a;
  }, 0);
  // 강화는 한 칸에서 한 장만 골랐을 때만 연다. 두 칸 이상이거나 한 칸에서 두 장 이상이면 잠긴다.
  const canUpgrade = picked.length === 1 && picked[0].take === 1;
  // 복원 안 되는 id 는 판매 확인에도 안 들어간다(방출된 선수 등). SlotCard 렌더와 같은 규칙.
  const pickedItems = picked
    .map((p) => ({ ref: { id: p.slot.id, plus: p.slot.plus }, card: byId.get(p.slot.id), take: p.take }))
    .filter((it): it is { ref: SlotRef; card: Card; take: number } => it.card != null);

  return (
    <section className="flex flex-col gap-3 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">
          {mode === "picking" ? (
            picked.length > 0 ? (
              `${picked.length}칸 · ${picked.reduce((a, p) => a + p.take, 0)}장 골랐어요`
            ) : (
              "고르기"
            )
          ) : (
            <>
              보관함 <span className="text-zinc-600">{slots.length}칸 · {totalCards}장</span>
            </>
          )}
        </h2>
        {slots.length > 0 && (
          <button
            type="button"
            onClick={() => (mode === "picking" ? exitPicking() : setMode("picking"))}
            className={`rounded-lg bg-white/8 px-3 py-1.5 text-xs font-bold text-zinc-200 transition-colors hover:bg-white/15 ${FOCUS_RING}`}
          >
            {mode === "picking" ? "취소" : "고르기"}
          </button>
        )}
      </div>

      {/* 판매 확인 모달이 떠 있는 동안은 뒤 그리드가 상호작용도 포커스도 안 받는다. */}
      <div inert={pendingSell !== null ? true : undefined}>
        {slots.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-600">아직 카드가 없어요. 팩을 사보세요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {slots.map((slot) => {
              const card = byId.get(slot.id);
              // 복원 안 되는 id 는 조용히 건너뛴다(방출된 선수 등). solo.tsx 의 옛 그리드와 같은 규칙.
              if (!card) return null;
              const ref: SlotRef = { id: slot.id, plus: slot.plus };
              return (
                <SlotCard
                  key={keyOf(ref)}
                  slot={slot}
                  card={card}
                  sport={sport}
                  picking={mode === "picking"}
                  take={selection[keyOf(ref)] ?? 0}
                  onEnterPicking={() => enterPickingWith(ref)}
                  onToggle={() => toggle(ref, slot.count)}
                  onBump={(delta) => bump(ref, delta, slot.count)}
                  onEnlarge={() => {
                    setEnlarged(slot);
                    setEnlargedTake(1);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {mode === "picking" && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex w-full max-w-3xl flex-wrap items-center justify-end gap-3 rounded-2xl bg-zinc-900/95 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
            <button
              type="button"
              disabled={picked.length === 0}
              onClick={() => setPendingSell(pickedItems)}
              className={`rounded-xl bg-white/10 px-4 py-1.5 text-sm font-bold text-zinc-200 ring-1 ring-white/15 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              {picked.length === 0 ? (
                "팔기"
              ) : (
                <>
                  팔기 <Coin amount={sellTotal} className="font-black text-amber-300" />
                </>
              )}
            </button>
            {/* 잠긴 이유는 title 이 아니라 직접 그린 툴팁으로 알린다 - disabled 버튼은
                브라우저가 마우스 이벤트를 안 보내 title 도 안 떠서다. */}
            <span className="group relative">
              <button
                type="button"
                disabled={!canUpgrade}
                onClick={() => {
                  if (!canUpgrade) return;
                  // exitPicking 을 여기서 안 부른다. 지금 부르면 이 버튼이 같은 렌더에서
                  // 사라져 오버레이가 마운트 시점에 잡는 document.activeElement 가 이미
                  // body 로 밀려나 있다 - Escape 로 닫아도 포커스가 돌아올 자리가 없어진다.
                  // 오버레이는 화면을 다 덮으니 고르기 덕이 뒤에 그대로 있어도 문제없다.
                  onUpgrade({ id: picked[0].slot.id, plus: picked[0].slot.plus });
                }}
                aria-describedby={canUpgrade ? undefined : "upgrade-lock-tip"}
                className={`rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-sm font-bold text-zinc-950 transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:from-white/10 disabled:to-white/10 disabled:text-zinc-500 disabled:opacity-60 ${FOCUS_RING}`}
              >
                강화
              </button>
              {!canUpgrade && (
                <div
                  id="upgrade-lock-tip"
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-40 -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-center text-[11px] text-zinc-200 opacity-0 ring-1 ring-white/15 transition-opacity group-hover:opacity-100"
                >
                  한 칸에서 한 장만 고를 수 있어요
                </div>
              )}
            </span>
          </div>
        </div>
      )}

      {pendingSell && (
        <SellModal
          items={pendingSell}
          onCancel={() => setPendingSell(null)}
          onConfirm={() => {
            onSell(pendingSell.map((it) => ({ ref: it.ref, take: it.take })));
            setPendingSell(null);
            exitPicking();
          }}
        />
      )}

      {enlarged && byId.get(enlarged.id) && (
        <EnlargedCard
          slot={enlarged}
          card={byId.get(enlarged.id)!}
          sport={sport}
          take={enlargedTake}
          onTakeChange={setEnlargedTake}
          onClose={() => setEnlarged(null)}
          onSell={() => {
            setPendingSell([
              { ref: { id: enlarged.id, plus: enlarged.plus }, card: byId.get(enlarged.id)!, take: enlargedTake },
            ]);
            setEnlarged(null);
          }}
          onUpgrade={() => {
            setEnlarged(null);
            onUpgrade({ id: enlarged.id, plus: enlarged.plus });
          }}
        />
      )}
    </section>
  );
}
