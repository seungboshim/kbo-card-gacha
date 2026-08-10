"use client";

import { useState } from "react";
import type { Card } from "../_game/deck";
import { Coin } from "./coin";
import { cardValue } from "./economy";
import {
  BASEBALL_SLOTS,
  FORMATIONS,
  FORMATION_SLOTS,
  canPlace,
  isDuplicate,
  squadValue,
  type Formation,
  type Slot as FieldSlot,
  type Squad,
} from "./squad";
import { SquadField } from "./squad-field";
import { SquadPicker, type Candidate } from "./squad-picker";
import type { Slot as VaultSlot, SlotRef } from "./vault";

const OUTLINE_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

/**
 * 스쿼드 판. 위에서부터 포메이션 고르기(축구만) → 필드 → 스쿼드 가치.
 *
 * formation 이 있으면 축구(필드 그림 + 포메이션 다섯 개), 없으면 야구(고정 19칸) -
 * storage.ts 가 Run.formation 을 그렇게 두는 것과 같은 신호를 그대로 쓴다.
 */
export function SquadPanel({
  squad,
  formation,
  vaultSlots,
  byId,
  prevValue,
  bestValue,
  onPlace,
  onRemove,
  onFormationChange,
}: {
  squad: Squad;
  formation?: Formation;
  vaultSlots: VaultSlot[];
  byId: Map<string, Card>;
  /** 직전 스쿼드 가치(storage.ts 의 Run.prevSquadValue). 지금 가치와의 차이가
   *  상승/하락 이펙트의 근거다. */
  prevValue: number;
  /** 이 런에서 도달한 스쿼드 최고 가치(Run.bestSquad.value). solo.tsx 의
   *  withSquadValue 가 오를 때만 갱신하므로, 이 값이 바뀌었다는 것 자체가 곧
   *  "방금 신기록을 세웠다"는 신호다. */
  bestValue: number;
  onPlace: (slotId: string, ref: SlotRef) => void;
  onRemove: (slotId: string) => void;
  onFormationChange: (f: Formation) => void;
}) {
  // 픽커가 지금 다루는 슬롯 id. null 이면 안 열려 있다.
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const fieldSlots: readonly FieldSlot[] = formation ? FORMATION_SLOTS[formation] : BASEBALL_SLOTS;
  const value = squadValue(squad, fieldSlots, byId);
  const filledCount = Object.keys(squad).length;

  // 주 포지션 보너스가 붙었는지는 squadValue 로 역산한다. squad.ts 의 matchesExact 는
  // export 돼 있지 않다(P1 규칙층은 이미 끝난 것으로 두고 다시 손대지 않기로 했다) -
  // 슬롯 하나만 담은 squad 로 squadValue 를 불러 카드 기본가보다 크면 배수가 붙은 것이다.
  const boostedCount = Object.entries(squad).filter(([slotId, owned]) => {
    const card = byId.get(owned.id);
    if (!card) return false;
    const base = cardValue(card.tier, owned.plus);
    const withSlot = squadValue({ [slotId]: owned }, fieldSlots, byId);
    return withSlot > base;
  }).length;

  // 스쿼드 가치 변동 이펙트. useEffect 안에서 setState 하면 lint 에러라
  // (react-hooks/set-state-in-effect, Next 16 React Compiler 규칙, CLAUDE.md 근거)
  // "prop 이 바뀌면 렌더 중에 상태를 맞춘다" 패턴을 쓴다(React 공식 문서: Adjusting
  // state when a prop changes) - effect 가 아니라 렌더 바디에서 직접 부르므로 그
  // 규칙에 안 걸린다. key 를 바꿔 CSS 애니메이션을 재생시키는 수법은
  // upgrade-overlay.tsx 의 resultKey 와 같다.
  const [lastValue, setLastValue] = useState(value);
  const [lastBestValue, setLastBestValue] = useState(bestValue);
  const [pulse, setPulse] = useState<{ key: number; diff: number; isNewBest: boolean } | null>(null);
  if (value !== lastValue || bestValue !== lastBestValue) {
    // best 는 solo.tsx(withSquadValue)에서 오를 때만 갱신되므로, 바뀐 것 자체가
    // 곧 "방금 신기록을 세웠다"는 신호다.
    const isNewBest = bestValue !== lastBestValue;
    setLastValue(value);
    setLastBestValue(bestValue);
    setPulse((p) => ({ key: (p?.key ?? 0) + 1, diff: value - prevValue, isNewBest }));
  }

  const activeSlotDef = activeSlotId ? (fieldSlots.find((s) => s.id === activeSlotId) ?? null) : null;

  const candidates: Candidate[] = activeSlotDef
    ? vaultSlots
        .map((vs) => ({ ref: { id: vs.id, plus: vs.plus }, card: byId.get(vs.id) }))
        .filter((c): c is Candidate => c.card != null)
        .filter((c) => canPlace(c.card, activeSlotDef))
        .filter((c) => !isDuplicate(squad, activeSlotDef.id, c.ref.id))
        .sort((a, b) => cardValue(b.card.tier, b.ref.plus) - cardValue(a.card.tier, a.ref.plus))
    : [];

  const occupied = activeSlotDef ? squad[activeSlotDef.id] : undefined;
  const occupantCard = occupied ? byId.get(occupied.id) : undefined;
  const occupant: Candidate | null = occupied && occupantCard ? { ref: occupied, card: occupantCard } : null;

  // 확인을 안 묻는다. 새 포메이션에도 있는 자리는 그대로 남으므로(squad.ts 의 carrySquad)
  // 잃는 게 없다. 4-3-3 에서 4-4-2 로 가면 수비 다섯이 그대로 남고 미드필더·공격진만 흩어진다.
  function handleFormationClick(f: Formation) {
    if (f === formation) return;
    onFormationChange(f);
    setActiveSlotId(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">스쿼드</h2>

      {formation && (
        /* 가로 스크롤 대신 접는다. 390px 드로어 안에서는 다섯 개가 한 줄에 안 들어가
           마지막 포메이션이 잘려 있었고, 가로로 스크롤되는 줄은 있는지도 모르고 지나친다. */
        <div className="flex flex-wrap gap-1.5">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => handleFormationClick(f)}
              aria-pressed={f === formation}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${OUTLINE_FOCUS} ${
                f === formation ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-300 hover:bg-white/15"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <SquadField
        slots={fieldSlots}
        squad={squad}
        byId={byId}
        isFootball={!!formation}
        activeSlotId={activeSlotId}
        onSlotClick={setActiveSlotId}
      />

      <div className="flex flex-col gap-1 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">스쿼드 가치</p>
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Coin amount={value} className="text-lg font-black text-amber-300" />
              {/* 장식용 이펙트. 잠깐 떴다 사라진다(globals.css, forwards로 끝에서
                  투명 고정) - 계속 떠 있으면 시끄러워서다. 방향은 화살표+색 글자로
                  담아 움직임이 꺼진 환경에서도 읽을 수 있고, 그 아래 role="status"
                  줄이 애니메이션과 상관없이 같은 내용을 알린다. */}
              {pulse && (
                <span
                  key={pulse.key}
                  aria-hidden="true"
                  className={
                    pulse.isNewBest
                      ? "squad-value-record text-xs font-black text-amber-300"
                      : `squad-value-pulse text-xs font-black ${pulse.diff > 0 ? "text-emerald-400" : "text-red-400"}`
                  }
                >
                  {pulse.isNewBest ? (
                    "🏆 신기록"
                  ) : pulse.diff > 0 ? (
                    <>
                      ▲ <Coin amount={pulse.diff} />
                    </>
                  ) : (
                    <>
                      ▼ <Coin amount={Math.abs(pulse.diff)} />
                    </>
                  )}
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-xs text-zinc-400">
            <span>
              {fieldSlots.length}칸 중 {filledCount}칸
            </span>
            {boostedCount > 0 && <span className="text-emerald-400">주 포지션 {boostedCount}명</span>}
          </div>
        </div>
        {/* 스크린리더와, 움직임이 꺼진 환경에서도 글자로 방향을 알린다(upgrade-overlay.tsx 선례). */}
        <p role="status" aria-live="polite" className="min-h-[1em] text-left text-[11px] font-bold text-zinc-500">
          {pulse &&
            (pulse.isNewBest
              ? "스쿼드 최고 기록을 새로 세웠어요."
              : pulse.diff > 0
                ? "스쿼드 가치가 올랐어요."
                : "스쿼드 가치가 내렸어요.")}
        </p>
      </div>

      {activeSlotDef && (
        <SquadPicker
          slotDef={activeSlotDef}
          occupant={occupant}
          candidates={candidates}
          onPick={(ref) => {
            onPlace(activeSlotDef.id, ref);
            setActiveSlotId(null);
          }}
          onClear={() => {
            onRemove(activeSlotDef.id);
            setActiveSlotId(null);
          }}
          onClose={() => setActiveSlotId(null)}
        />
      )}
    </section>
  );
}
