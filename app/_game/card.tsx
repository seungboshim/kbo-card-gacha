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
    <div className={`rounded-2xl ${s.pad} ${s.edge} ${s.glow}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-[14px] bg-zinc-950">
        {/* 팀 색은 사진 배경에서만 뚜렷하게: 흰색 글로스 위에 팀 색을 진하게 깔고 아래로 갈수록 죽인다 */}
        <div
          className="relative flex items-end justify-center pt-3"
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
