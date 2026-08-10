"use client";

import Image from "next/image";
import { STYLE } from "../_game/card";
import type { Card } from "../_game/deck";
import type { Slot as FieldSlot, Squad } from "./squad";

// 포커스는 outline-*로 그린다. 이 버튼들은 뒤에 등급 링(ring, box-shadow)을 이미 쓰고
// 있어서 focus-visible:ring을 더 얹으면 서로 밀어낸다 - app/page.tsx 패턴을 따라
// outline만 쓴다(outline-none은 같이 안 쓴다. CLAUDE.md 근거: Tailwind v4에서
// --tw-outline-style을 none으로 고정해버려 focus-visible:outline-2가 안 그려진다).
const OUTLINE_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

/** 슬롯 하나. 비었으면 점선 원 + 라벨, 찼으면 둥근 사진 + 이름 + 강화 칩만(카드 전체는 넣지 않는다 - 19칸을 한 화면에 깔면 PlayerCard는 아무것도 안 보인다). */
function SlotButton({
  slotDef,
  owned,
  card,
  dim,
  onClick,
}: {
  slotDef: FieldSlot;
  owned?: { id: string; plus: number };
  card?: Card;
  /** 픽커가 다른 슬롯을 다루는 중이라 이 슬롯은 지금 손댈 대상이 아니라는 표시. */
  dim: boolean;
  onClick: () => void;
}) {
  const filling = owned && card ? { owned, card } : null;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ left: `${slotDef.x}%`, top: `${slotDef.y}%` }}
      aria-label={
        filling ? `${slotDef.label} 자리 · ${filling.card.name}, 다시 고르기` : `${slotDef.label} 자리, 비어 있음`
      }
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl p-0.5 transition-opacity ${OUTLINE_FOCUS} ${dim ? "opacity-35" : ""}`}
    >
      {filling ? (
        <>
          <span
            className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-1 ring-inset sm:h-11 sm:w-11 ${STYLE[filling.card.tier].chip}`}
          >
            {filling.card.photo ? (
              <Image src={filling.card.photo} alt="" fill sizes="44px" className="object-cover" />
            ) : (
              <span aria-hidden="true" className={`h-full w-full ${STYLE[filling.card.tier].edge}`} />
            )}
            {filling.owned.plus > 0 && (
              <span className="absolute -right-0.5 -bottom-0.5 rounded bg-zinc-950/90 px-0.5 text-[8px] leading-tight font-black text-white ring-1 ring-white/40">
                +{filling.owned.plus}
              </span>
            )}
          </span>
          <span className="max-w-[54px] truncate text-[9px] font-bold text-white drop-shadow sm:max-w-[64px] sm:text-[10px]">
            {filling.card.name}
          </span>
        </>
      ) : (
        <>
          <span className="h-9 w-9 rounded-full border-2 border-dashed border-white/35 sm:h-11 sm:w-11" />
          <span className="max-w-[54px] truncate text-[9px] font-semibold text-white/55 sm:max-w-[64px] sm:text-[10px]">
            {slotDef.label}
          </span>
        </>
      )}
    </button>
  );
}

/**
 * 축구 필드 장식. 가운데 원·하프라인·양쪽 페널티 박스 정도만 그린다(계획서 지시).
 * 위가 상대 골문 쪽(공격수), 아래가 우리 골문(골키퍼) - squad.ts의 y 좌표 방향과 같다.
 */
function PitchLines() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/25" />
      <div className="absolute top-1/2 left-1/2 h-[24%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
      <div className="absolute top-0 left-1/2 h-[15%] w-[46%] -translate-x-1/2 border border-t-0 border-white/25" />
      <div className="absolute bottom-0 left-1/2 h-[15%] w-[46%] -translate-x-1/2 border border-b-0 border-white/25" />
    </div>
  );
}

/**
 * 야구장 장식. 다이아몬드(마름모) + 외야 호만 그린다(계획서 지시). squad.ts의 좌표를
 * 보면 타자 슬롯은 y 8~58, 투수 슬롯은 y 80~98로 22포인트 간격이 비어 있다 - 그
 * 사이(y 68%)에서 그림 영역과 투수 대기 영역을 가른다. 나머지는 CSS만으로 그린
 * 장식이라 좌표에 딱 맞출 필요는 없고, 인원이 몰리는 타순 구역(포수~외야) 위에
 * 걸치도록 눈대중으로 앉혔다.
 */
function BallparkArt() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* 외야 호: 큰 원의 위쪽 호만 걸쳐서 곡선으로 보이게 한다 */}
      <div className="absolute top-[2%] left-1/2 h-[62%] w-[150%] -translate-x-1/2 rounded-full border border-white/15" />
      {/* 내야 다이아몬드 */}
      <div className="absolute top-[48%] left-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-white/25 bg-white/5" />
      {/* 투수진 대기 구역 - 야구장 그림 밖 아래쪽 */}
      <div className="absolute inset-x-0 bottom-0 h-[32%] border-t border-dashed border-white/15 bg-black/20">
        <span className="absolute top-1.5 left-2 text-[9px] font-bold tracking-wide text-white/35 uppercase">
          투수진
        </span>
      </div>
    </div>
  );
}

/** 필드 그림과 슬롯 배치. x·y는 0~100 백분율, 컨테이너를 relative로 두고 슬롯을 absolute로 얹는다. */
export function SquadField({
  slots,
  squad,
  byId,
  isFootball,
  activeSlotId,
  onSlotClick,
}: {
  slots: readonly FieldSlot[];
  squad: Squad;
  byId: Map<string, Card>;
  isFootball: boolean;
  /** 픽커가 열려 있는 슬롯 id. 픽커는 슬롯 하나만 다루므로 "들어갈 수 있는 자리"는
   *  사실상 이 슬롯 하나뿐이다 - 그래서 이 슬롯만 밝게, 나머지는 흐리게 둔다. */
  activeSlotId: string | null;
  onSlotClick: (slotId: string) => void;
}) {
  return (
    // 배경(잔디 색·장식선)만 overflow-hidden으로 둥글게 자르고, 슬롯 레이어는 안 자른다.
    // 마무리(CL, y=98)처럼 가장자리에 가까운 슬롯은 라벨까지 합친 버튼 높이의 절반이
    // -translate-y-1/2로 y=100% 밖까지 걸치는데, 슬롯까지 한 겹에서 overflow-hidden을
    // 걸면 그 라벨이 통째로 잘려나간다(실측으로 확인).
    <div className={`relative w-full ${isFootball ? "aspect-[3/4]" : "aspect-[3/5]"}`}>
      <div
        className={`absolute inset-0 overflow-hidden rounded-2xl ${isFootball ? "bg-emerald-900" : "bg-emerald-950"}`}
      >
        {isFootball ? <PitchLines /> : <BallparkArt />}
      </div>
      {slots.map((s) => {
        const owned = squad[s.id];
        const card = owned ? byId.get(owned.id) : undefined;
        return (
          <SlotButton
            key={s.id}
            slotDef={s}
            owned={owned}
            card={card}
            dim={activeSlotId !== null && activeSlotId !== s.id}
            onClick={() => onSlotClick(s.id)}
          />
        );
      })}
    </div>
  );
}
