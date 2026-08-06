"use client";

import type { SportConfig } from "../_game/deck";
import { PackShell } from "../_game/pack";
import { Coin } from "./coin";
import { PACKS, legendChance, type Pack } from "./economy";

// 키보드 포커스는 outline-*로 그린다. ring-*은 box-shadow라, 아래에서 팩에 광원을
// 인라인 그림자로 얹으면(플래티넘 등) 밀려서 안 보인다. outline은 독립 속성이라 안 부딪힌다.
//
// "outline-none"은 안 붙인다. Tailwind v4의 outline-none은 --tw-outline-style을 "none"으로
// 영구히 고정해버려서, 같은 엘리먼트의 focus-visible:outline-2가 폭·오프셋·색은 먹여도
// outline-style은 계속 none으로 남아 아예 안 그려진다(실측 확인). app/page.tsx의 입구 카드가
// outline-none 없이 이 조합만 쓰는 게 그래서다 — 같은 조합을 그대로 따른다.
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

/**
 * 팩 하단 둘째 줄 문구. 숫자는 economy.ts의 실제 확률표에서 뽑는다 —
 * 여기 손으로 적으면 그쪽 확률이 바뀔 때 문구만 낡아서 거짓말이 된다.
 *
 * 일반팩만 기본 문구("등급 무작위")를 쓴다. 레전드 3%를 적어봤자 살 이유가 안 되고,
 * 오히려 "여긴 기대할 게 없다"가 이 팩의 성격이다.
 */
function noteFor(p: Pack): string | undefined {
  if (p.key === "normal") return undefined;
  return `레전드 ${legendChance(p)}%`;
}

export function Shop({
  credits,
  sport,
  onBuy,
}: {
  credits: number;
  sport: SportConfig;
  onBuy: (pack: Pack) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">상점</h2>
      {/* 좁은 화면(390px)에서도 세 팩이 한 줄에 들어가야 해서 sm 이전에도 3열로 고정한다.
          여럿이서 모드 팩 고르기(game.tsx)와 같은 이유로 gap을 좁게 잡는다. */}
      <div className="grid grid-cols-3 items-stretch gap-2 sm:gap-4">
        {PACKS.map((p) => {
          const afford = credits >= p.price;
          return (
            <button
              key={p.key}
              type="button"
              disabled={!afford}
              onClick={() => onBuy(p)}
              aria-label={afford ? `${p.name} 구매` : `${p.name}, 보유액이 모자라 살 수 없어요`}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center transition-transform duration-150 sm:gap-2 sm:p-2 ${FOCUS_RING} ${
                afford
                  ? "hover:-translate-y-1 hover:-rotate-1 active:translate-y-0 active:scale-[0.97]"
                  : "cursor-not-allowed"
              }`}
            >
              <div className="relative aspect-[10/19] w-full max-w-[104px]">
                {/* p.key가 그대로 grade다: economy.ts의 PACKS 키가 "normal"/"good"/"platinum"이라 */}
                <PackShell
                  sport={sport}
                  packSize={p.size}
                  grade={p.key as "normal" | "good" | "platinum"}
                  dim={!afford}
                  note={noteFor(p)}
                />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] font-bold sm:text-sm">{p.name}</span>
                <Coin
                  amount={p.price}
                  className={`text-xs font-black sm:text-sm ${afford ? "text-amber-300" : "text-zinc-500"}`}
                />
                <span className="text-[10px] leading-tight text-zinc-500 sm:text-[11px]">
                  {p.blurb.replace("{legend}", `${legendChance(p)}%`)}
                </span>
                <span className="text-[10px] text-zinc-600">{p.size}장</span>
                {!afford && <span className="text-[10px] font-bold text-rose-400">보유액 부족</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
