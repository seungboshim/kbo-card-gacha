"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { PlayerCard, STYLE } from "../_game/card";
import { PackShell } from "../_game/pack";
import { TIERS, tierRankOf, type Card, type SportConfig } from "../_game/deck";
import type { Pack } from "./economy";

const TIER_LABEL = Object.fromEntries(TIERS.map((t) => [t.key, t.label])) as Record<string, string>;

// 개봉 초반에 튀어나오는 익명 뒷면 색. pack.tsx의 PACK_THEME과 같은 계열로 맞춘다
// (KBO 노랑 → 앰버, PL 보라 → 바이올렛). 인원이 하나라 game.tsx의 PLAYERS 그라디언트는 못 쓴다.
const BACK_GRAD: Record<string, string> = {
  kbo: "from-amber-400 to-amber-600",
  epl: "from-violet-400 to-violet-600",
};

type Stage = "reposition" | "tear" | "drop" | "revealing";

/**
 * 혼자서 모드 개봉 연출. 여럿이서 모드(game.tsx)의 reposition → tear → drop 흐름을 그대로 쓰되,
 * 그 뒤로는 턴을 나눌 사람이 없어 한 장씩 자동으로 뒤집는다(손패를 직접 터치하는 대신 지켜보는
 * 연출). cards는 solo.tsx가 연출을 시작하기 전에 이미 보관함에 커밋해둔 것과 같은 배열이라,
 * 중간에 페이지를 벗어나도 카드는 이미 안전하다 — 이 컴포넌트는 순수 연출일 뿐이다.
 */
export function Opening({
  sport,
  pack,
  cards,
  onDone,
}: {
  sport: SportConfig;
  pack: Pack;
  cards: Card[];
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("reposition");
  const [revealed, setRevealed] = useState(0);
  const [spotlight, setSpotlight] = useState<{ card: Card; key: number } | null>(null);
  const spotlightKey = useRef(0);

  // 전역 CSS(globals.css)가 애니메이션 길이를 0.01ms로 눌러주는 건 CSS 트랜지션/애니메이션뿐이다.
  // 이 연출은 JS setTimeout으로 단계를 넘기므로 미디어쿼리를 직접 읽어야 실제로 안 멈춘다.
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const ms = (n: number) => (reduced ? 0 : n);

  useEffect(() => {
    const t1 = setTimeout(() => setStage("tear"), ms(600));
    const t2 = setTimeout(() => setStage("drop"), ms(1500));
    const t3 = setTimeout(() => setStage("revealing"), ms(2400));
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 한 장씩 공개. revealed가 카드 수를 채우면 잠깐 두었다가 onDone으로 보관함 화면에 돌아간다.
  useEffect(() => {
    if (stage !== "revealing") return;
    if (revealed >= cards.length) {
      const t = setTimeout(onDone, ms(700));
      return () => clearTimeout(t);
    }
    const card = cards[revealed];
    if (tierRankOf(card.tier) >= tierRankOf("EPIC")) {
      spotlightKey.current += 1;
      const key = spotlightKey.current;
      setSpotlight({ card, key });
      setTimeout(() => setSpotlight((s) => (s?.key === key ? null : s)), ms(1800));
    }
    const t = setTimeout(() => setRevealed((n) => n + 1), ms(700));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, revealed]);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center gap-8 overflow-x-hidden px-4">
      {spotlight && (
        <p
          key={spotlight.key}
          className={`pointer-events-none fixed inset-x-0 top-6 z-[1000] animate-[card-in_.4s_ease-out_both] text-center text-lg font-black ${
            STYLE[spotlight.card.tier].label
          }`}
        >
          {TIER_LABEL[spotlight.card.tier]} 등장! {spotlight.card.name}
        </p>
      )}

      {stage !== "revealing" ? (
        <div className="relative aspect-[10/19] w-28 sm:w-36">
          {stage === "reposition" ? (
            <PackShell
              sport={sport}
              packSize={pack.size}
              grade={pack.key as "normal" | "good" | "platinum"}
              animateClass="animate-[pack-in_.6s_ease-out_both]"
            />
          ) : (
            <>
              <PackShell
                sport={sport}
                packSize={pack.size}
                grade={pack.key as "normal" | "good" | "platinum"}
                clip="left"
                animateClass="animate-[pack-tear-left_.9s_ease-in_both]"
              />
              <PackShell
                sport={sport}
                packSize={pack.size}
                grade={pack.key as "normal" | "good" | "platinum"}
                clip="right"
                animateClass="animate-[pack-tear-right_.9s_ease-in_both]"
              />
            </>
          )}
          {stage === "drop" && (
            <div className="absolute inset-x-0 top-1/2 flex flex-nowrap justify-center">
              {cards.map((card, i) => (
                <div
                  key={card.id}
                  aria-hidden="true"
                  className={`h-16 w-11 shrink-0 animate-[cards-burst_.5s_ease-out_both] rounded-sm bg-gradient-to-br ring-1 ring-white/15 ${
                    i === 0 ? "" : "-ml-6"
                  } ${BACK_GRAD[sport.key]}`}
                  style={
                    {
                      animationDelay: `${ms(i * 55)}ms`,
                      "--sx": `${(i - (cards.length - 1) / 2) * 12}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {cards.slice(0, revealed + 1).map((card, i) => (
            <div key={card.id} className="w-[120px] sm:w-[150px]">
              <div className={i === revealed ? "animate-[flip-up_.55s_cubic-bezier(.2,.8,.2,1)_both]" : ""}>
                <PlayerCard card={card} sport={sport} size="mini" />
              </div>
            </div>
          ))}
        </div>
      )}

      <p aria-live="polite" className="text-center text-sm text-zinc-500">
        {stage !== "revealing"
          ? `${pack.name} 개봉 중…`
          : revealed < cards.length
            ? "카드 공개 중…"
            : "보관함으로 이동 중…"}
      </p>

      {/* 자동 진행이라 이 버튼이 없으면 다 볼 때까지 화면에 갇힌다. 카드는 이미 보관함에
          들어가 있으므로 건너뛰어도 잃는 게 없다. */}
      <button
        type="button"
        onClick={onDone}
        className="text-xs font-bold text-zinc-500 underline-offset-2 outline-none transition-colors hover:text-zinc-300 hover:underline focus-visible:ring-2 focus-visible:ring-white/70"
      >
        건너뛰기
      </button>
    </div>
  );
}
