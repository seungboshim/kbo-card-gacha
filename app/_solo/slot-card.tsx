"use client";

import { useRef } from "react";
import type { MouseEventHandler, PointerEventHandler } from "react";
import { PlayerCard } from "../_game/card";
import type { Card, SportConfig } from "../_game/deck";
import { cardValue } from "./economy";
import type { Slot } from "./vault";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * 길게 눌러 고르기로 들어간다. 브라우저 기본 동작을 다 막아야 한다.
 * iOS 는 이미지 롱프레스에 저장 팝업을 띄우고, 데스크톱은 텍스트가 드래그로 잡힌다.
 * 카드를 누른 채 화면을 밀면 고르기로 들어가면 안 되므로 10px 넘게 움직이면 취소한다.
 *
 * 계획서 sketch 에서 고친 것: 롱프레스가 발동한 뒤 손(포인터)을 떼면 브라우저가 그
 * 자리에 click 이벤트를 또 보낸다. 그 click 을 짧은 탭으로 처리하면 방금 골라진 카드가
 * 바로 풀려버린다. suppressClick 플래그를 남겨 롱프레스 뒤 첫 click 딱 한 번만 무시한다.
 */
function useLongPress(onLong: () => void): {
  suppressClick: { current: boolean };
  onContextMenu: MouseEventHandler;
  onPointerDown: PointerEventHandler;
  onPointerMove: PointerEventHandler;
  onPointerUp: PointerEventHandler;
  onPointerCancel: PointerEventHandler;
  onPointerLeave: PointerEventHandler;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return {
    suppressClick,
    onContextMenu: (e) => e.preventDefault(),
    onPointerDown: (e) => {
      from.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        suppressClick.current = true;
        onLong();
      }, 500);
    },
    onPointerMove: (e) => {
      const d = Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y);
      if (d > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  };
}

/** 보관함 한 칸. 평상시엔 값과 장수, 고르기 중엔 체크 표시와 수량 핸들. */
export function SlotCard({
  slot,
  card,
  sport,
  picking,
  take,
  onEnterPicking,
  onToggle,
  onBump,
  onEnlarge,
}: {
  slot: Slot;
  card: Card;
  sport: SportConfig;
  picking: boolean;
  take: number;
  onEnterPicking: () => void;
  onToggle: () => void;
  onBump: (delta: number) => void;
  onEnlarge: () => void;
}) {
  const picked = take > 0;
  // 이미 고르기 중이면 롱프레스가 수량을 1로 되돌릴 이유가 없다. idle 일 때만 진입 + 선택을 겸한다.
  const { suppressClick: suppressClickRef, ...longPress } = useLongPress(() => {
    if (!picking) onEnterPicking();
  });

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (picking) onToggle();
    else onEnlarge();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        {...longPress}
        onClick={handleClick}
        role={picking ? "checkbox" : undefined}
        aria-checked={picking ? picked : undefined}
        aria-label={picking ? `${card.name} 고르기` : `${card.name} 확대`}
        className={`pickable relative block w-full rounded-2xl text-left transition-opacity ${FOCUS_RING} ${picking && !picked ? "opacity-45" : ""}`}
      >
        {picking && picked && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1 z-10 rounded-[19px] shadow-[0_0_0_2px_#fff,0_0_18px_-2px_rgba(255,255,255,0.55)]"
            />
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -left-1.5 z-20 grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-black text-zinc-950"
            >
              ✓
            </span>
          </>
        )}
        <PlayerCard card={card} sport={sport} size="mini" plus={slot.plus} />
      </button>

      {picking ? (
        <div className="flex min-h-[24px] items-center justify-center gap-1">
          <button
            type="button"
            disabled={take <= 0}
            onClick={() => onBump(-1)}
            aria-label="한 장 빼기"
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-md bg-white/10 text-sm font-black disabled:opacity-30 ${FOCUS_RING}`}
          >
            −
          </button>
          <span className="min-w-[34px] text-center text-xs font-black tabular-nums">
            {take}
            <span className="font-semibold text-zinc-600">/{slot.count}</span>
          </span>
          <button
            type="button"
            disabled={take >= slot.count}
            onClick={() => onBump(1)}
            aria-label="한 장 더"
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-md bg-white/10 text-sm font-black disabled:opacity-30 ${FOCUS_RING}`}
          >
            +
          </button>
        </div>
      ) : (
        <div className="flex min-h-[24px] items-center justify-between px-0.5">
          <span className="text-[11px] font-bold tabular-nums text-zinc-400">
            {cardValue(card.tier, slot.plus).toLocaleString()}
          </span>
          {slot.count > 1 && (
            <span className="rounded bg-white/7 px-1.5 text-[10px] font-bold text-zinc-500 tabular-nums">
              {slot.count}장
            </span>
          )}
        </div>
      )}
    </div>
  );
}
