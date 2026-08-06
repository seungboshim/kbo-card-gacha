"use client";

import Image from "next/image";
import { useState } from "react";
import { TIERS, type Card, type SportConfig, type TierKey } from "./deck";

// 등급 표현. 색 순서는 회색 → 파랑 → 보라 → 금색 → 백금(홀로그램)이다.
// edge: 테두리 배경(그라디언트 방향까지 포함) · glow: 바깥 광원 · pad: 테두리 두께
// sheen: 사진 뒤에 깔리는 무지개빛 박막. 레전드만 쓴다.
//
// 레전드를 색으로만 가르면 언커먼 파랑과 톤이 겹친다. 그래서 색이 아니라 질감으로 가른다.
// chip 배경은 등급색이 아니라 어두운 단색이다. 배지가 팀 색 사진 위에 얹히기 때문에
// 반투명 등급색으로 두면 밝은 팀(울버햄튼 금색 등) 위에서 글자가 묻힌다.
export const STYLE: Record<
  TierKey,
  { edge: string; glow: string; pad: string; chip: string; label: string; sheen?: string }
> = {
  LEGEND: {
    // 반복 그라디언트라야 좁은 테두리 안에 색이 여러 개 동시에 보인다. 한 번만 흐르는
    // 그라디언트로 두면 2.5px 폭에 색 하나만 걸려서 그냥 흐린 은색이 된다.
    // 다만 주기가 짧으면 무지개가 촘촘해져 조잡하다. 카드 한 변(170px)에 한 바퀴가
    // 조금 넘게 걸리도록 넉넉히 잡고, 색은 흰색을 사이에 끼워 부드럽게 넘긴다.
    edge: "bg-[repeating-linear-gradient(115deg,#6ee7b7_0px,#ffffff_38px,#d8b4fe_76px,#ffffff_114px,#7dd3fc_152px,#ffffff_190px,#6ee7b7_228px)] bg-[length:200%_200%] animate-[holo-drift_9s_ease-in-out_infinite]",
    glow: "shadow-[0_0_44px_-4px_rgba(150,240,255,0.7)]",
    pad: "p-[2.5px]",
    chip: "bg-zinc-950/70 text-cyan-100 ring-cyan-200/60",
    label: "text-cyan-200",
    // 흰색을 줄이고 색 띠를 살린다. 흰색이 많으면 어두운 팀 색 위에서 회색 얼룩처럼 보인다.
    // 테두리보다 주기를 더 넓게 잡아, 사진 뒤는 띠가 아니라 넓은 물결로 보이게 한다.
    sheen:
      "bg-[repeating-linear-gradient(115deg,rgba(110,231,183,0.4)_0px,rgba(255,255,255,0.22)_58px,rgba(216,180,254,0.4)_116px,rgba(255,255,255,0.22)_174px,rgba(125,211,252,0.4)_232px,rgba(110,231,183,0.4)_290px)] bg-[length:200%_200%] animate-[holo-drift_9s_ease-in-out_infinite]",
  },
  EPIC: {
    edge: "bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600",
    glow: "shadow-[0_0_34px_-5px_rgba(250,204,21,0.6)]",
    pad: "p-[2px]",
    chip: "bg-zinc-950/70 text-yellow-300 ring-yellow-400/50",
    label: "text-yellow-300",
  },
  RARE: {
    edge: "bg-gradient-to-br from-violet-300 via-purple-500 to-purple-700",
    glow: "shadow-[0_0_28px_-8px_rgba(168,85,247,0.55)]",
    pad: "p-[1.5px]",
    chip: "bg-zinc-950/70 text-purple-300 ring-purple-400/50",
    label: "text-purple-300",
  },
  UNCOMMON: {
    edge: "bg-gradient-to-br from-sky-300 via-blue-500 to-blue-700",
    glow: "",
    pad: "p-[1px]",
    chip: "bg-zinc-950/70 text-sky-300 ring-sky-400/50",
    label: "text-sky-300",
  },
  COMMON: {
    edge: "bg-gradient-to-br from-zinc-500 via-slate-600 to-zinc-700",
    glow: "",
    pad: "p-[1px]",
    chip: "bg-zinc-950/70 text-zinc-400 ring-zinc-500/50",
    label: "text-zinc-400",
  },
};

const LABEL = Object.fromEntries(TIERS.map((t) => [t.key, t.label])) as Record<TierKey, string>;

/**
 * 강화 수치 칩의 색. 카드 등급이 아니라 강화 단계를 따라간다.
 *
 * +1~4 회색 · +5~7 은색 · +8~10 금색 · +11~13 청록 · +14~15 무지개.
 * 금색이 시작되는 +8 근처가 파괴가 붙기 시작하는 구간이라, 색이 위험도를 같이 말한다.
 *
 * 배경을 안 칠하고 테두리와 글자에만 색을 준다. 금속 그라디언트로 꽉 채우면 이름 옆에서
 * 너무 무겁고, 카드가 여러 장 깔린 도감에서 칩만 튄다.
 */
const PLUS_BAND: { upTo: number; cls: string }[] = [
  { upTo: 4, cls: "text-zinc-300 ring-zinc-400/60" },
  { upTo: 7, cls: "text-[#e8e8f0] ring-[#c8c8d8]/70" },
  { upTo: 10, cls: "text-[#ffd76a] ring-[#e0a800]/70" },
  { upTo: 13, cls: "text-[#a5f3fc] ring-[#22d3ee]/70" },
  // 최상위 두 칸만 무지개. 테두리는 한 색으로 못 주므로 글자만 흐르게 두고 링은 밝은 흰색.
  {
    upTo: 15,
    cls:
      "ring-white/70 bg-clip-text text-transparent" +
      " bg-[linear-gradient(115deg,#6ee7b7,#ffffff_30%,#d8b4fe_55%,#ffffff_75%,#7dd3fc)]" +
      " bg-[length:200%_200%] animate-[holo-drift_9s_ease-in-out_infinite]",
  },
];

const plusBand = (plus: number) =>
  (PLUS_BAND.find((b) => plus <= b.upTo) ?? PLUS_BAND[PLUS_BAND.length - 1]).cls;

// 구단 색 없는 teamId는 중립 회색.
const NEUTRAL_TEAM_COLOR = "#52525b";

// mini: 좁은 스택용(대표 스탯 2개) · compact: 넓은 스택용(스탯 8칸) · full: 확대용(큰 카드)
export type CardSize = "mini" | "compact" | "full";

// mini 카드의 대표 스탯 2개. 종목별로 어떤 스탯이 대표인지 다르다(sport.miniStatKeys).
function miniStats(card: Card, sport: SportConfig): { k: string; v: string }[] {
  const find = (k: string) => card.stats.find((st) => st.k === k) ?? { k, v: "-" };
  return sport.miniStatKeys(card.role).map(find);
}

export function PlayerCard({
  card,
  sport,
  size = "compact",
  plus = 0,
}: {
  card: Card;
  sport: SportConfig;
  size?: CardSize;
  /** 강화 수치. 0 이면 아무것도 안 그린다. 팩에서 막 나온 카드가 압도적으로 많아서,
   *  그 다수에 표시가 없어야 손을 탄 소수가 튄다. */
  plus?: number;
}) {
  const s = STYLE[card.tier];
  // 사진이 없는 선수도 있다(원본 404). 카드 높이는 유지하고 이름으로 대체한다.
  const [noPhoto, setNoPhoto] = useState(false);
  // 사진과 이름을 한 덩이로 붙여 이름을 사진 위에 얹는 레이아웃.
  // mini(모바일 스택)는 폭이 좁아 섹션을 나누면 사진이 너무 작아지므로 등급과 무관하게 쓰고,
  // 넓은 화면에서는 레전드만 쓴다. 나머지는 사진과 이름 섹션이 나뉜 기본 레이아웃이다.
  const isLegend = card.tier === "LEGEND";
  const hero = size === "mini" || isLegend;
  // 히어로는 이름 섹션이 사진 안으로 들어오는 대신 사진이 커진다. 아래 pb 와 합쳐
  // 기본 레이아웃(사진 + 이름 섹션)과 전체 높이가 맞도록 잡은 값이다.
  const photoH = !hero
    ? size === "full"
      ? "h-28"
      : "h-20"
    : size === "full"
      ? "h-32"
      : size === "mini"
        ? "h-16"
        : "h-24";
  const stats = size === "mini" ? miniStats(card, sport) : card.stats;
  const teamColor = sport.teamColor[card.teamId] ?? NEUTRAL_TEAM_COLOR;
  return (
    // 등장 연출은 호출부가 정한다. 여기서 무조건 걸면 카드가 다시 마운트될 때마다 또 돈다.
    <div className={`rounded-2xl ${s.pad} ${s.edge} ${s.glow}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-[14px] bg-zinc-950">
        {/* 팀 색은 사진 배경에서만 뚜렷하게: 흰색 글로스 위에 팀 색을 진하게 깔고 아래로 갈수록 죽인다 */}
        <div
          className={`relative flex items-end justify-center ${hero ? (size === "mini" ? "pt-2 pb-7" : "pt-2 pb-14") : "pt-3"}`}
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.1), transparent), linear-gradient(160deg, ${teamColor}e6 0%, ${teamColor}4d 65%, transparent 100%)`,
          }}
        >
          {/* 무지개빛 박막. 선수 사진보다 먼저 그려서 사진 뒤에 깔린다(테두리와 같은 리듬으로 흐른다). */}
          {s.sheen && <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${s.sheen}`} />}
          <span
            className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${s.chip}`}
          >
            {LABEL[card.tier]}
          </span>
          {card.teamLogo && (
            <Image
              src={card.teamLogo}
              alt={card.team}
              width={92}
              height={88}
              className="absolute top-2 right-2 h-6 w-auto object-contain"
            />
          )}
          {/* 레전드 배경 장식. 사진보다 먼저 그려서 선수 뒤에 깔리고, 등급 칩·팀 로고보다는
              앞서 그려 그 둘이 위로 올라온다. 좌상단에 영문 이름을 단어마다 한 줄씩, 우하단에 등번호. */}
          {isLegend && size !== "mini" && card.subName && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-1 left-0 font-black tracking-tight text-white/10 uppercase ${size === "full" ? "text-3xl leading-[0.88]" : "text-2xl leading-[0.9]"}`}
            >
              {card.subName.split(" ").map((word, i) => (
                <span key={i} className="block">
                  {word}
                </span>
              ))}
            </span>
          )}
          {isLegend && size !== "mini" && card.back && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute right-0 bottom-9 leading-none font-black tabular-nums text-white/12 ${size === "full" ? "text-6xl" : "text-5xl"}`}
            >
              {card.back.replace("#", "")}
            </span>
          )}
          {noPhoto ? (
            // 사진 대신 사람 상반신 아바타 아이콘. alt 역할은 role="img"+aria-label로 대신하고 svg는 aria-hidden.
            // 비율은 실제 사진(210x262)에 맞춘다. 정사각으로 두면 사진 있는 카드와 실루엣이 달라 줄에서 튄다.
            <div role="img" aria-label={card.name} className={`${photoH} aspect-[210/262]`}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full fill-white/35">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          ) : (
            <Image
              src={card.photo}
              alt={card.name}
              width={210}
              height={262}
              priority={size === "full"}
              onError={() => setNoPhoto(true)}
              className={`${photoH} w-auto object-contain drop-shadow-lg`}
            />
          )}
          {/* 이름을 사진 위에 얹는다. 아래로 갈수록 짙어지는 그라디언트로 글자를 읽히게 한다. */}
          {hero && (
            <div
              className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent px-3 ${size === "mini" ? "pt-5 pb-1" : "pt-8 pb-1.5"}`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`truncate ${isLegend ? "font-black" : "font-bold"} ${size === "full" ? "text-xl" : size === "mini" ? "text-sm" : "text-base"}`}
                >
                  {card.name}
                </span>
                {size !== "mini" && card.back && (
                  <span className="shrink-0 text-[11px] text-zinc-400 tabular-nums">{card.back}</span>
                )}
                {plus > 0 && (
                  <span className={`shrink-0 rounded px-1 text-[10px] leading-normal font-black tabular-nums ring-1 ring-inset ${plusBand(plus)}`}>
                    +{plus}
                  </span>
                )}
              </div>
              {/* mini는 165px 안팎 폭이라 이름 아래는 대표 스탯만 남기고 팀/포지션/headline은 생략한다 */}
              {size !== "mini" && (
                <>
                  <div className="truncate text-[11px] text-zinc-400">
                    {card.team} · {card.pos}
                  </div>
                  <div className={`truncate text-[11px] font-medium tabular-nums ${s.label}`}>{card.headline}</div>
                </>
              )}
            </div>
          )}
        </div>

        {!hero && (
          <div className="border-t border-white/10 px-3 pt-2 pb-1">
            <div className="flex items-center gap-1.5">
              <span className={`truncate font-bold ${size === "full" ? "text-lg" : "text-sm"}`}>{card.name}</span>
              {card.back && <span className="shrink-0 text-[11px] text-zinc-500 tabular-nums">{card.back}</span>}
              {plus > 0 && (
                <span className={`shrink-0 rounded px-1 text-[10px] leading-normal font-black tabular-nums ring-1 ring-inset ${plusBand(plus)}`}>
                  +{plus}
                </span>
              )}
            </div>
            <div className="truncate text-[11px] text-zinc-400">
              {card.team} · {card.pos}
            </div>
            <div className={`mt-0.5 truncate text-[11px] font-medium tabular-nums ${s.label}`}>{card.headline}</div>
          </div>
        )}

        {/* mini/compact는 4인 좁은 화면에서도 한글 라벨이 안 잘리게 2열로 (4열은 셀당 폭이 부족) */}
        <div className={`mt-auto grid gap-px bg-white/10 text-center ${size === "full" ? "grid-cols-4" : "grid-cols-2"}`}>
          {stats.map((st) => (
            <div key={st.k} className="bg-zinc-950 px-1 py-1.5">
              <div className="text-[10px] text-zinc-500">{st.k}</div>
              <div className={`font-semibold tabular-nums ${size === "full" ? "text-xs" : "text-[11px]"}`}>{st.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
