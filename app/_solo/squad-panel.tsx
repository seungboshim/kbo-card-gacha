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
  onPlace,
  onRemove,
  onFormationChange,
}: {
  squad: Squad;
  formation?: Formation;
  vaultSlots: VaultSlot[];
  byId: Map<string, Card>;
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

  function handleFormationClick(f: Formation) {
    if (f === formation) return;
    // 포메이션이 바뀌면 슬롯 id 도 달라져 기존 배치가 새 포메이션과 안 맞을 수 있다.
    // "맞는 자리만 남기기"는 반쯤 남은 배치가 오히려 헷갈려서, 계획서 판단대로 그냥
    // 다 비운다. 되돌릴 수 없으니 비우기 전에 확인만 한다.
    if (filledCount > 0 && !window.confirm("포메이션을 바꾸면 지금 짜둔 스쿼드가 비워져요. 바꿀까요?")) return;
    onFormationChange(f);
    setActiveSlotId(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">스쿼드</h2>

      {formation && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => handleFormationClick(f)}
              aria-pressed={f === formation}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${OUTLINE_FOCUS} ${
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

      <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
        <div>
          <p className="text-xs text-zinc-500">스쿼드 가치</p>
          <Coin amount={value} className="text-lg font-black text-amber-300" />
        </div>
        <div className="flex flex-col items-end gap-0.5 text-xs text-zinc-400">
          <span>
            {fieldSlots.length}칸 중 {filledCount}칸
          </span>
          {boostedCount > 0 && <span className="text-emerald-400">주 포지션 {boostedCount}명</span>}
        </div>
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
