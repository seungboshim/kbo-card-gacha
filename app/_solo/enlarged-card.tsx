"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "./use-focus-trap";
import { PlayerCard } from "../_game/card";
import type { Card, SportConfig } from "../_game/deck";
import { Coin } from "./coin";
import { cardValue } from "./economy";
import type { Slot } from "./vault";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * 카드를 짧게 눌러 뜨는 확대 화면. 카드 아래에 도감 하단 바와 같은 조작(수량 핸들 ·
 * 팔기 · 강화)을 그대로 둔다 - 도감까지 안 나가고 여기서 바로 처리할 수 있게.
 *
 * 포커스 트랩·Escape·포커스 복원은 vault-grid.tsx 에 있던 확대 다이얼로그를 그대로
 * 옮긴 것뿐이다(파일 하나가 300줄을 넘지 않게 나눴다). upgrade-overlay.tsx 의 같은
 * 패턴을 그대로 따른다.
 */
export function EnlargedCard({
  slot,
  card,
  sport,
  take,
  onTakeChange,
  onClose,
  onSell,
  onUpgrade,
}: {
  slot: Slot;
  card: Card;
  sport: SportConfig;
  /** 팔 장수. 1..slot.count. 확대 화면은 0 장이 없다 - 최소 한 장이다. */
  take: number;
  onTakeChange: (take: number) => void;
  onClose: () => void;
  /** 지금 take 만큼 팔기로 넘긴다. 부모가 확인 모달을 열고 이 화면을 닫는다. */
  onSell: () => void;
  /** take === 1 일 때만 눌린다. 부모가 이 화면을 닫고 강화 오버레이를 연다. */
  onUpgrade: () => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  // vault-grid.tsx 의 옛 확대 오버레이·upgrade-overlay.tsx 와 같은 포커스 패턴.
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

  const canUpgrade = take === 1;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} 카드 확대`}
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
    >
      <div className="flex w-full max-w-xs flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className={`flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full bg-zinc-900 text-xl leading-none font-bold text-white/80 ring-1 ring-white/20 transition-colors hover:bg-zinc-800 hover:text-white ${FOCUS_RING}`}
        >
          ×
        </button>
        <div className="animate-[card-in_.5s_cubic-bezier(.2,.8,.2,1)_both]">
          <PlayerCard card={card} sport={sport} size="full" plus={slot.plus} />
        </div>

        <div className="mt-1 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={take <= 1}
            onClick={() => onTakeChange(Math.max(1, take - 1))}
            aria-label="한 장 빼기"
            className={`flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/10 text-sm font-black disabled:opacity-30 ${FOCUS_RING}`}
          >
            −
          </button>
          <span className="min-w-[42px] text-center text-sm font-black tabular-nums">
            {take}
            <span className="font-semibold text-zinc-600">/{slot.count}</span>
          </span>
          <button
            type="button"
            disabled={take >= slot.count}
            onClick={() => onTakeChange(Math.min(slot.count, take + 1))}
            aria-label="한 장 더"
            className={`flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/10 text-sm font-black disabled:opacity-30 ${FOCUS_RING}`}
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSell}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-zinc-200 ring-1 ring-white/15 transition-colors hover:bg-white/20 ${FOCUS_RING}`}
          >
            팔기 <Coin amount={cardValue(card.tier, slot.plus) * take} />
          </button>
          <span className="group relative flex-1">
            <button
              type="button"
              disabled={!canUpgrade}
              onClick={onUpgrade}
              aria-describedby={canUpgrade ? undefined : "enlarged-upgrade-tip"}
              className={`flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-bold text-zinc-950 transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:from-white/10 disabled:to-white/10 disabled:text-zinc-500 disabled:opacity-60 ${FOCUS_RING}`}
            >
              강화
            </button>
            {/* 잠겼을 때만 그린다. canUpgrade 면 aria-describedby 도 안 걸려 있어
                가리킬 대상이 없어도 된다 - hover 만으로 뜨는 잠금 사유 안내는 잠겼을 때뿐이다. */}
            {!canUpgrade && (
              <div
                id="enlarged-upgrade-tip"
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-40 -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-center text-[11px] text-zinc-200 opacity-0 ring-1 ring-white/15 transition-opacity group-hover:opacity-100"
              >
                한 칸에서 한 장만 고를 수 있어요
              </div>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
