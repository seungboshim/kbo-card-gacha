"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useFocusTrap } from "./use-focus-trap";
import { STYLE } from "../_game/card";
import type { Card } from "../_game/deck";
import { Coin } from "./coin";
import { cardValue } from "./economy";
import type { SlotRef } from "./vault";

/**
 * 판매 확인. 수량은 보관함에서 이미 정했으므로 여기서는 고른 게 맞는지만 보여준다.
 * 되돌릴 수 없는 일이라 기본 포커스는 취소 쪽에 둔다.
 */
export function SellModal({
  items,
  onConfirm,
  onCancel,
}: {
  items: { ref: SlotRef; card: Card; take: number }[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    cancelBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const total = items.reduce((a, it) => a + it.take * cardValue(it.card.tier, it.ref.plus), 0);
  const count = items.reduce((a, it) => a + it.take, 0);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="판매 확인"
      onClick={onCancel}
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-white/10"
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h4 className="text-base font-bold">이 선수들을 파시겠어요?</h4>
          <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
            {items.length}칸 · {count}장
          </span>
        </div>

        <div className="flex max-h-[50vh] flex-col overflow-y-auto">
          {items.map((it) => {
            const price = cardValue(it.card.tier, it.ref.plus);
            return (
              <div
                key={`${it.ref.id}-${it.ref.plus}`}
                className="flex items-center gap-3 border-b border-white/5 px-5 py-2.5"
              >
                {/* 등급색 배경은 그대로 깔고 그 위에 사진을 올린다 - 사진 없는(빈 문자열) 선수는
                    Image 를 안 그려서 등급색만 남는다. 어떤 선수인지는 옆 이름으로 이미 보이므로
                    사진은 장식으로만 두고 alt 를 비운다. */}
                <div
                  aria-hidden="true"
                  className={`h-10 w-10 shrink-0 overflow-hidden rounded-lg ${STYLE[it.card.tier].edge}`}
                >
                  {it.card.photo && (
                    <Image src={it.card.photo} alt="" width={210} height={262} className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    <span className="truncate">{it.card.name}</span>
                    {it.ref.plus > 0 && (
                      <span className={`shrink-0 text-xs font-black tabular-nums ${STYLE[it.card.tier].label}`}>
                        +{it.ref.plus}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold text-zinc-400 tabular-nums">{it.take}장</span>
                <span className="w-16 shrink-0 text-right text-sm font-black tabular-nums">
                  {(price * it.take).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-5 py-4">
          <span className="mr-auto flex flex-col text-xs text-zinc-400">
            받을 금액
            <Coin amount={total} className="text-xl font-black text-amber-300" />
          </span>
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-zinc-200 ring-1 ring-white/15 outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-zinc-950 outline-none transition-colors hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-white/70"
          >
            팔기
          </button>
        </div>
      </div>
    </div>
  );
}
