"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "./use-focus-trap";
import { PlayerCard } from "../_game/card";
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
  const [confirming, setConfirming] = useState(false);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const enlargeRef = useRef<HTMLDivElement>(null);
  useFocusTrap(enlargeRef, enlarged !== null);

  // 확대 오버레이 포커스 관리. game.tsx 의 overlayCard 패턴과 같다.
  useEffect(() => {
    if (!enlarged) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    return () => lastFocusedRef.current?.focus();
  }, [enlarged]);

  function exitPicking() {
    setMode("idle");
    setSelection({});
  }

  // Escape 는 위 레이어부터 하나씩 닫는다. 판매 확인 모달·강화 오버레이가 떠 있으면
  // 그쪽이 자기 Escape 를 따로 처리하므로(SellModal, UpgradeOverlay) 여기서는 손대지
  // 않는다. 강화 오버레이를 안 걸러주면 같은 Escape 한 번에 이 효과도 같이 반응해
  // 고르기 덕(강화 버튼)까지 사라져서, 오버레이가 닫힐 때 되돌아갈 포커스 자리가 없어진다.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || upgradeOpen) return;
      if (enlarged) setEnlarged(null);
      else if (mode === "picking" && !confirming) exitPicking();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged, mode, confirming, upgradeOpen]);

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
      <div inert={confirming ? true : undefined}>
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
                  onEnlarge={() => setEnlarged(slot)}
                />
              );
            })}
          </div>
        )}
      </div>

      {mode === "picking" && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl bg-zinc-900/95 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
            <span className="mr-auto text-sm text-zinc-400">
              팔면 <Coin amount={sellTotal} className="font-black text-amber-300" />
            </span>
            <button
              type="button"
              disabled={picked.length === 0}
              onClick={() => setConfirming(true)}
              className={`rounded-xl bg-white/10 px-4 py-1.5 text-sm font-bold text-zinc-200 ring-1 ring-white/15 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              팔기
            </button>
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
              className={`rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-sm font-bold text-zinc-950 transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-zinc-500 disabled:opacity-60 ${FOCUS_RING}`}
            >
              {canUpgrade ? "강화" : "강화 · 한 칸에서 한 장만"}
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <SellModal
          items={picked
            .map((p) => ({ ref: { id: p.slot.id, plus: p.slot.plus }, card: byId.get(p.slot.id), take: p.take }))
            .filter((it): it is { ref: SlotRef; card: Card; take: number } => it.card != null)}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            onSell(picked.map((p) => ({ ref: { id: p.slot.id, plus: p.slot.plus }, take: p.take })));
            setConfirming(false);
            exitPicking();
          }}
        />
      )}

      {enlarged && byId.get(enlarged.id) && (
        <div
          ref={enlargeRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${byId.get(enlarged.id)!.name} 카드 확대`}
          onClick={() => setEnlarged(null)}
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
        >
          <div className="flex w-full max-w-xs flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => setEnlarged(null)}
              aria-label="닫기"
              className={`flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full bg-zinc-900 text-xl leading-none font-bold text-white/80 ring-1 ring-white/20 transition-colors hover:bg-zinc-800 hover:text-white ${FOCUS_RING}`}
            >
              ×
            </button>
            <div className="animate-[card-in_.5s_cubic-bezier(.2,.8,.2,1)_both]">
              <PlayerCard card={byId.get(enlarged.id)!} sport={sport} size="full" plus={enlarged.plus} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
