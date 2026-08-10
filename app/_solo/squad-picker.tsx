"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useFocusTrap } from "./use-focus-trap";
import { STYLE } from "../_game/card";
import { TIERS, type Card, type TierKey } from "../_game/deck";
import { Coin } from "./coin";
import { cardValue } from "./economy";
import type { Slot as FieldSlot } from "./squad";
import type { SlotRef } from "./vault";

const TIER_LABEL = Object.fromEntries(TIERS.map((t) => [t.key, t.label])) as Record<TierKey, string>;
const OUTLINE_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

/** 픽커 한 줄. ref는 보관함 칸(id+강화 수치) 하나를 가리킨다 - 스쿼드는 카드를 "참조"만 하지 보관함에서 빼가지 않는다. */
export type Candidate = { ref: SlotRef; card: Card };

/**
 * 슬롯 하나에 넣을 선수를 고르는 다이얼로그. 줄 모양(사진·이름·등급·강화·가치)은
 * sell-modal.tsx 를 그대로 따르고, 포커스 트랩·Escape·배경 클릭·포커스 복원은
 * enlarged-card.tsx 패턴을 옮겼다.
 */
export function SquadPicker({
  slotDef,
  occupant,
  candidates,
  onPick,
  onClear,
  onClose,
}: {
  slotDef: FieldSlot;
  /** 이 슬롯에 지금 꽂혀 있는 선수. 없으면 null. */
  occupant: Candidate | null;
  /** canPlace·isDuplicate 를 이미 거친, 이 슬롯에 들어갈 수 있는 후보만. */
  candidates: Candidate[];
  onPick: (ref: SlotRef) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lastFocusedRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${slotDef.label} 자리에 넣을 선수 고르기`}
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
    >
      {/* 폭을 고정하고 내용이 그 폭을 다 쓰게 한다 - items-center 를 안쪽 컨테이너에
          주면 내용이 제 크기로 쪼그라들어 옆 빈 자리가 여전히 이 안이라 클릭해도
          안 닫힌다(result.tsx CardDetail 주석 참고). */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-white/10"
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h4 className="text-base font-bold">{slotDef.label} 자리</h4>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className={`shrink-0 text-xl leading-none font-bold text-white/60 transition-colors hover:text-white ${OUTLINE_FOCUS}`}
          >
            ×
          </button>
        </div>

        {occupant && (
          <button
            type="button"
            onClick={onClear}
            className={`flex items-center gap-3 border-b border-white/10 bg-white/5 px-5 py-2.5 text-left transition-colors hover:bg-white/10 ${OUTLINE_FOCUS}`}
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-sm font-black text-rose-300"
            >
              ✕
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-300">
              지금 {occupant.card.name} · 비우기
            </span>
          </button>
        )}

        <div className="flex max-h-[50vh] flex-col overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">이 자리에 넣을 수 있는 선수가 없어요.</p>
          ) : (
            candidates.map(({ ref, card }) => (
              <button
                key={`${ref.id}-${ref.plus}`}
                type="button"
                onClick={() => onPick(ref)}
                className={`flex items-center gap-3 border-b border-white/5 px-5 py-2.5 text-left transition-colors hover:bg-white/5 ${OUTLINE_FOCUS}`}
              >
                <div
                  aria-hidden="true"
                  className={`h-10 w-10 shrink-0 overflow-hidden rounded-lg ${STYLE[card.tier].edge}`}
                >
                  {card.photo && (
                    <Image
                      src={card.photo}
                      alt=""
                      width={210}
                      height={262}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    <span className="truncate">{card.name}</span>
                    {ref.plus > 0 && (
                      <span className={`shrink-0 text-xs font-black tabular-nums ${STYLE[card.tier].label}`}>
                        +{ref.plus}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold ${STYLE[card.tier].label}`}>{TIER_LABEL[card.tier]}</span>
                </div>
                <Coin amount={cardValue(card.tier, ref.plus)} className="shrink-0 text-sm font-black" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
