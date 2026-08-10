"use client";

import Image from "next/image";
import { plusBand, STYLE } from "../_game/card";
import type { Card } from "../_game/deck";
import { cardValue } from "./economy";
import { matchesExact, type Slot as FieldSlot, type Squad } from "./squad";

// 포커스는 outline-*로 그린다. 이 버튼들은 뒤에 등급 링(ring, box-shadow)을 이미 쓰고
// 있어서 focus-visible:ring을 더 얹으면 서로 밀어낸다 - app/page.tsx 패턴을 따라
// outline만 쓴다(outline-none은 같이 안 쓴다. CLAUDE.md 근거: Tailwind v4에서
// --tw-outline-style을 none으로 고정해버려 focus-visible:outline-2가 안 그려진다).
const OUTLINE_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

// 야구 투수 열 명을 묶는 세 줄. squad.ts의 BASEBALL_SLOTS 배열 순서(SP1→SP5→RP1→RP4→CL)가
// 곧 화면에 나열되는 순서다 - 여기서 순서를 다시 정하지 않는다.
const PITCHER_GROUPS = new Set<FieldSlot["group"]>(["SP", "RP", "CL"]);
const PITCHER_ROWS: { label: string; group: FieldSlot["group"] }[] = [
  { label: "선발", group: "SP" },
  { label: "중계", group: "RP" },
  { label: "마무리", group: "CL" },
];

/** 슬롯 하나. 비었으면 점선 원(+라벨), 찼으면 둥근 사진 + 이름 + 강화 칩만(카드 전체는 넣지 않는다 - 19칸을 한 화면에 깔면 PlayerCard는 아무것도 안 보인다). */
function SlotButton({
  slotDef,
  owned,
  card,
  dim,
  onClick,
  position,
  hideEmptyLabel = false,
}: {
  slotDef: FieldSlot;
  owned?: { id: string; plus: number };
  card?: Card;
  /** 픽커가 다른 슬롯을 다루는 중이라 이 슬롯은 지금 손댈 대상이 아니라는 표시. */
  dim: boolean;
  onClick: () => void;
  /** 있으면 필드 그림 위 절대좌표(축구 11명·야구 타자 9명), 없으면 보통 흐름(야구 투수
   *  세 줄) - squad-field.tsx의 PITCHER_ROWS가 이 값을 안 넘긴다. */
  position?: { x: number; y: number };
  /** 투수 줄처럼 왼쪽에 줄 이름을 이미 한 번 적어둔 경우, 빈 자리마다 반복되는
   *  라벨을 뺀다("선발 ●●●●●" 밑에 "선발"이 다섯 번 더 안 달리게). */
  hideEmptyLabel?: boolean;
}) {
  const filling = owned && card ? { owned, card } : null;
  return (
    <button
      type="button"
      onClick={onClick}
      style={position ? { left: `${position.x}%`, top: `${position.y}%` } : undefined}
      aria-label={
        filling ? `${slotDef.label} 자리 · ${filling.card.name}, 다시 고르기` : `${slotDef.label} 자리, 비어 있음`
      }
      className={`flex flex-col items-center gap-0.5 rounded-2xl p-0.5 transition-opacity ${
        position ? "absolute -translate-x-1/2 -translate-y-1/2" : "relative"
      } ${OUTLINE_FOCUS} ${dim ? "opacity-35" : ""}`}
    >
      {filling ? (
        <>
          {/* 사진 원. 테두리를 ring-1 에서 ring-2 로 키웠다. 얼굴이 44px 밖에 안 돼서
              얇은 선으로는 등급 색이 안 보였다.
              인라인 boxShadow 로 광원을 얹지 않는다 - ring 이 box-shadow 로 구현돼서
              같은 엘리먼트에 인라인 그림자를 주면 테두리가 통째로 덮인다(CLAUDE.md). */}
          <span className="relative">
            <span
              className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 sm:h-11 sm:w-11 ${STYLE[filling.card.tier].chip}`}
            >
              {filling.card.photo ? (
                <Image src={filling.card.photo} alt="" fill sizes="44px" className="object-cover" />
              ) : (
                <span aria-hidden="true" className={`h-full w-full ${STYLE[filling.card.tier].edge}`} />
              )}
            </span>
            {/* 강화 칩: 사진 우상단, 색·크기(text-[9px] px-1) 모두 card.tsx의 plusBand·+N 칩과
                맞췄다 - 더 작았을 때(text-[8px]) 레전드 구간 무지개 글자가 카드보다도 안 보였다. */}
            {filling.owned.plus > 0 && (
              <span
                className={`absolute -top-1 -right-1.5 rounded bg-zinc-950/95 px-1 text-[9px] leading-tight font-black ring-1 ${plusBand(filling.owned.plus)}`}
              >
                +{filling.owned.plus}
              </span>
            )}
          </span>
          <span className="max-w-[54px] truncate text-[9px] font-bold text-white drop-shadow sm:max-w-[64px] sm:text-[10px]">
            {filling.card.name}
          </span>
          {/* 값과 주 포지션 표시. 자리마다 이게 보여야 "여기 누굴 넣지"가 판단이 된다. */}
          <span className="flex items-center gap-0.5 text-[8px] leading-none font-bold tabular-nums sm:text-[9px]">
            <span className="text-amber-300/90">{cardValue(filling.card.tier, filling.owned.plus).toLocaleString()}</span>
            {matchesExact(filling.card, slotDef) && (
              <span className="text-emerald-400" title={`${slotDef.label} 주 포지션`} aria-label="주 포지션">
                ★
              </span>
            )}
          </span>
        </>
      ) : (
        <>
          <span className="h-9 w-9 rounded-full border-2 border-dashed border-white/35 sm:h-11 sm:w-11" />
          {!hideEmptyLabel && (
            <span className="max-w-[54px] truncate text-[9px] font-semibold text-white/55 sm:max-w-[64px] sm:text-[10px]">
              {slotDef.label}
            </span>
          )}
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
 * 야구장. CSS 상자 대신 SVG 로 그린다.
 *
 * `preserveAspectRatio="none"` 에 `viewBox="0 0 100 100"` 을 물리면 SVG 좌표가 슬롯의
 * x·y 백분율과 **정확히 같은 공간**이 된다. 그래서 홈플레이트를 (50,53)에 찍으면 포수
 * 슬롯(50,58)이 바로 그 뒤에 앉고, 파울라인을 1루·3루로 그으면 내야수 슬롯이 저절로
 * 베이스 바깥에 선다. 상자를 눈대중으로 앉히던 예전 방식으로는 이걸 맞출 수가 없었다.
 *
 * 늘어나는 좌표계라 선 굵기가 세로로 눌리므로 획에는 `vector-effect="non-scaling-stroke"`
 * 를 건다. 도형이 눌리는 건 오히려 맞다 - 슬롯과 같은 공간에 있어야 하니까.
 *
 * 좌표 근거(squad.ts 의 BASEBALL_SLOTS): 외야 8~12 · 내야 38~42 · 포수 58.
 * 투수 열 명은 이제 이 그림 위에 안 앉는다(SquadField의 투수진 세 줄 참고) - 그래서
 * 컨테이너 세로 비율도 투수 밴드를 빼고 타자만 담게 3/4로 줄였다. viewBox는 늘 0~100
 * 정사각형이라 비율이 바뀌어도 슬롯과 그림이 같은 백분율 공간을 쓰는 건 안 변한다.
 */
const HOME: [number, number] = [50, 53];
const BASES: [number, number][] = [
  [66, 44], // 1루
  [50, 35], // 2루
  [34, 44], // 3루
];
// 파울라인을 홈에서 1·3루 방향으로 늘여 담장에 닿는 지점. 외야수 슬롯이 (20,12)·(80,12)
// 라 여기를 좁게 잡으면 좌·우익수가 잔디 밖으로 걸쳐 나간다.
const FOUL_L: [number, number] = [0, 22];
const FOUL_R: [number, number] = [100, 22];

function BallparkArt() {
  const diamond = [HOME, BASES[0], BASES[1], BASES[2]].map((p) => p.join(",")).join(" ");
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g vectorEffect="non-scaling-stroke">
        {/* 페어 지역: 홈에서 좌우 파울라인을 타고 올라가 담장 호로 닫는다. 파울 지역
            (이 도형 바깥)은 컨테이너 배경색 그대로 남아 저절로 어두워진다. */}
        {/* 담장은 호(arc) 대신 3차 베지어로 그린다. 호는 반지름 두 개로 높이를 맞추기가
            까다로운데, 제어점을 y=-8 로 빼면 가운데가 y≈2 까지 올라와 중견수(50,8)가
            확실히 안쪽에 선다. */}
        <path
          d={`M${HOME} L${FOUL_L} C 0,-8 100,-8 ${FOUL_R} Z`}
          className="fill-emerald-800/70 stroke-white/25"
          vectorEffect="non-scaling-stroke"
        />
        {/* 내야 흙. 다이아몬드보다 조금 크게 깔아야 베이스가 흙 위에 앉는다. */}
        <path d={`M${HOME} L70,42 A 22 15 0 0 0 30,42 Z`} className="fill-amber-900/45" />
        <polygon points={diamond} className="fill-none stroke-white/45" vectorEffect="non-scaling-stroke" />
        {/* 베이스 셋과 홈플레이트 */}
        {BASES.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x - 1.6} y={y - 1.6} width="3.2" height="3.2" className="fill-white/70" />
        ))}
        <polygon
          points={`${HOME[0] - 2},${HOME[1] - 2} ${HOME[0] + 2},${HOME[1] - 2} ${HOME[0] + 2},${HOME[1]} ${HOME[0]},${HOME[1] + 2} ${HOME[0] - 2},${HOME[1]}`}
          className="fill-white/85"
        />
        {/* 마운드. 다이아몬드 한가운데다. */}
        <ellipse cx="50" cy="44" rx="4" ry="3" className="fill-amber-800/70" />
      </g>
    </svg>
  );
}

/**
 * 야구 투수진. 그림 없이 줄 이름(선발·중계·마무리)을 왼쪽에 한 번만 적고 슬롯을
 * flex로 나열한다 - 예전엔 슬롯마다 라벨이 붙어 "선발"이 다섯 번 반복됐다. slots
 * 자체가 빈 슬롯도 포함한 고정 배열이라(squad.ts) 필터링만 해도 빈 칸이 유지된다.
 */
function PitcherRows({
  slots,
  squad,
  byId,
  activeSlotId,
  onSlotClick,
}: {
  slots: readonly FieldSlot[];
  squad: Squad;
  byId: Map<string, Card>;
  activeSlotId: string | null;
  onSlotClick: (slotId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      {PITCHER_ROWS.map(({ label, group }) => (
        <div key={group} className="flex items-center gap-1.5">
          {/* 390px 드로어에서 다섯 칸(선발)이 한 줄에 40px씩 들어가야 해서 라벨·칸 간격을
              빠듯하게 잡았다(실측). */}
          <span className="w-9 shrink-0 text-[9px] font-bold tracking-wide text-white/50 sm:w-14 sm:text-xs">
            {label}
          </span>
          <div className="flex flex-1 flex-wrap gap-x-1 gap-y-2.5">
            {slots
              .filter((s) => s.group === group)
              .map((s) => {
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
                    hideEmptyLabel
                  />
                );
              })}
          </div>
        </div>
      ))}
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
  const dim = (id: string) => activeSlotId !== null && activeSlotId !== id;
  // 야구는 타자 9명만 필드 그림 위 절대좌표로, 투수 열 명은 PitcherRows(flex)로 뺀다.
  // 축구는 예전 그대로 11명 전부 한 덩어리 절대좌표다.
  const onFieldSlots = isFootball ? slots : slots.filter((s) => !PITCHER_GROUPS.has(s.group));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full aspect-[3/4]">
        <div
          className={`absolute inset-0 overflow-hidden rounded-2xl ${isFootball ? "bg-emerald-900" : "bg-emerald-950"}`}
        >
          {isFootball ? <PitchLines /> : <BallparkArt />}
        </div>
        {onFieldSlots.map((s) => {
          const owned = squad[s.id];
          const card = owned ? byId.get(owned.id) : undefined;
          return (
            <SlotButton
              key={s.id}
              slotDef={s}
              owned={owned}
              card={card}
              position={{ x: s.x, y: s.y }}
              dim={dim(s.id)}
              onClick={() => onSlotClick(s.id)}
            />
          );
        })}
      </div>

      {!isFootball && (
        <PitcherRows slots={slots} squad={squad} byId={byId} activeSlotId={activeSlotId} onSlotClick={onSlotClick} />
      )}
    </div>
  );
}
