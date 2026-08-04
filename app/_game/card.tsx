"use client";

import Image from "next/image";
import { useState } from "react";
import { TIERS, type Card, type SportConfig, type TierKey } from "./deck";

// 등급 표현은 세 갈래로 나눈다.
// edge: 테두리 색 · glow: 바깥 광원(상위 3등급만) · pad: 테두리 두께
// 색만으로 가르면 mini 카드나 저채도 화면에서 구분이 흐려져서, 두께로 한 겹 더 준다.
// chip 배경은 등급색이 아니라 어두운 단색이다. 배지가 팀 색 사진 위에 얹히기 때문에
// 반투명 등급색으로 두면 밝은 팀(울버햄튼 금색 등) 위에서 글자가 묻힌다.
export const STYLE: Record<TierKey, { edge: string; glow: string; pad: string; chip: string; label: string }> = {
  LEGEND: {
    edge: "from-amber-200 via-yellow-400 to-orange-600",
    glow: "shadow-[0_0_40px_-4px_rgba(251,191,36,0.65)]",
    pad: "p-[2px]",
    chip: "bg-zinc-950/70 text-amber-300 ring-amber-400/50",
    label: "text-amber-300",
  },
  EPIC: {
    edge: "from-fuchsia-300 via-purple-500 to-indigo-600",
    glow: "shadow-[0_0_32px_-6px_rgba(192,132,252,0.6)]",
    pad: "p-[2px]",
    chip: "bg-zinc-950/70 text-fuchsia-300 ring-fuchsia-400/50",
    label: "text-fuchsia-300",
  },
  RARE: {
    edge: "from-sky-300 via-blue-500 to-cyan-500",
    glow: "shadow-[0_0_28px_-8px_rgba(56,189,248,0.55)]",
    pad: "p-[1.5px]",
    chip: "bg-zinc-950/70 text-sky-300 ring-sky-400/50",
    label: "text-sky-300",
  },
  UNCOMMON: {
    edge: "from-emerald-300 via-green-500 to-teal-600",
    glow: "",
    pad: "p-[1px]",
    chip: "bg-zinc-950/70 text-emerald-300 ring-emerald-400/50",
    label: "text-emerald-300",
  },
  COMMON: {
    edge: "from-zinc-500 via-slate-600 to-zinc-700",
    glow: "",
    pad: "p-[1px]",
    chip: "bg-zinc-950/70 text-zinc-400 ring-zinc-500/50",
    label: "text-zinc-400",
  },
};

const LABEL = Object.fromEntries(TIERS.map((t) => [t.key, t.label])) as Record<TierKey, string>;

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
}: {
  card: Card;
  sport: SportConfig;
  size?: CardSize;
}) {
  const s = STYLE[card.tier];
  // 사진이 없는 선수도 있다(원본 404). 카드 높이는 유지하고 이름으로 대체한다.
  const [noPhoto, setNoPhoto] = useState(false);
  // mini는 좁은 화면 스택용이라 사진을 더 줄여 카드 전체 높이를 낮춘다.
  const photoH = size === "full" ? "h-28" : size === "mini" ? "h-14" : "h-20";
  const stats = size === "mini" ? miniStats(card, sport) : card.stats;
  const teamColor = sport.teamColor[card.teamId] ?? NEUTRAL_TEAM_COLOR;
  return (
    // 등장 연출은 호출부가 정한다. 여기서 무조건 걸면 카드가 다시 마운트될 때마다 또 돈다.
    <div className={`rounded-2xl bg-gradient-to-br ${s.pad} ${s.edge} ${s.glow}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-[14px] bg-zinc-950">
        {/* 팀 색은 사진 배경에서만 뚜렷하게: 흰색 글로스 위에 팀 색을 진하게 깔고 아래로 갈수록 죽인다 */}
        <div
          className="relative flex items-end justify-center pt-3"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.1), transparent), linear-gradient(160deg, ${teamColor}e6 0%, ${teamColor}4d 65%, transparent 100%)`,
          }}
        >
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
              className={`${photoH} w-auto object-contain outline outline-1 -outline-offset-1 outline-white/10 drop-shadow-lg`}
            />
          )}
        </div>

        <div className="border-t border-white/10 px-3 pt-2 pb-1">
          <div className="flex items-baseline gap-1.5">
            <span className={`truncate font-bold ${size === "full" ? "text-lg" : "text-sm"}`}>{card.name}</span>
            {size !== "mini" && <span className="shrink-0 text-[11px] text-zinc-500 tabular-nums">{card.back}</span>}
          </div>
          {/* mini는 165px 안팎 폭이라 이름 아래는 대표 스탯만 남기고 팀/포지션/headline은 생략한다 */}
          {size !== "mini" && (
            <>
              <div className="truncate text-[11px] text-zinc-400">
                {card.team} · {card.pos}
              </div>
              <div className={`mt-0.5 truncate text-[11px] font-medium tabular-nums ${s.label}`}>{card.headline}</div>
            </>
          )}
        </div>

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
