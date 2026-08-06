"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "./use-focus-trap";
import { PlayerCard, STYLE } from "../_game/card";
import type { Card, SportConfig } from "../_game/deck";
import { Coin } from "./coin";
import { MAX_PLUS, cardValue, guardFee, oddsAt, upgradeCost } from "./economy";
import type { UpgradeResult } from "./vault";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * 강화 한 번을 굴린다. guard 를 켜면 oddsAt 이 이미 파괴를 실패(유지)로 흡수해 넘겨준다.
 */
function roll(plus: number, guard: boolean): UpgradeResult {
  const o = oddsAt(plus, guard);
  const r = Math.random() * 100;
  if (r < o.success) return "success";
  if (r < o.success + o.keep) return "keep";
  return "destroy";
}

/**
 * 강화 오버레이. 새 페이지가 아니라 화면을 다 덮는다 — 성공할 때까지 계속 두드리는 일이라
 * (한 판에 39~102번) 매번 페이지를 오가면 지친다.
 *
 * plus 는 부모(run.vault)가 쥐고 있다. 성공하면 부모가 plus+1 을 다시 내려줘 다음 단계를
 * 보여주고, 유지면 부모가 아무것도 안 바꿔 같은 단계를 또 두드릴 수 있다. 파괴면 부모는
 * plus 를 그대로 두지만(카드는 이미 사라졌다) 이 컴포넌트가 마지막 굴림 결과(result)로
 * "사라졌다"를 기억해 더 못 누르게 막는다. 그래야 파괴 문구를 화면에 띄운 채로 있을 수 있다.
 */
export function UpgradeOverlay({
  card,
  sport,
  plus,
  credits,
  onClose,
  onUpgrade,
}: {
  card: Card;
  sport: SportConfig;
  plus: number;
  credits: number;
  onClose: () => void;
  /** 굴림 결과와 그때 낸 금액. 부모가 보유액을 깎고 보관함·최고 기록을 갱신한다. */
  onUpgrade: (result: UpgradeResult, pay: number) => void;
}) {
  const [guard, setGuard] = useState(false);
  const [oddsOpen, setOddsOpen] = useState(false);
  const [result, setResult] = useState<UpgradeResult | null>(null);
  // 같은 result 가 두 번 연속 나와도(예: 실패 후 또 실패) 애니메이션이 다시 돌게 하는 키.
  // className 문자열은 안 바뀌어도 key 가 바뀌면 React가 그 div를 다시 마운트해 CSS
  // 애니메이션을 처음부터 재생한다 — game.tsx의 card-in이 card.id를 key로 쓰는 것과 같은 수법.
  const [resultKey, setResultKey] = useState(0);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  // game.tsx 의 overlayCard 패턴과 같다: 열릴 때 닫기 버튼에 포커스를 두고, 닫히면 원래
  // 있던 자리로 돌려준다. Escape 도 여기서 받는다.
  useEffect(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lastFocusedRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = STYLE[card.tier];
  const atMax = plus >= MAX_PLUS;
  const destroyed = result === "destroy";
  const odds = oddsAt(plus, guard);
  const now = cardValue(card.tier, plus);
  const next = cardValue(card.tier, plus + 1);
  const cost = upgradeCost(card.tier, plus);
  const fee = guardFee(card.tier, plus);
  const pay = guard ? cost + fee : cost;
  const short = credits < pay;

  function handleUpgrade() {
    const outcome = roll(plus, guard);
    setResult(outcome);
    setResultKey((k) => k + 1);
    onUpgrade(outcome, pay);
  }

  // 여기 result 는 굴린 값이지 solo.tsx 가 받아들인 값이 아니다. 보관함에 그 칸이 없으면
  // solo.tsx 가 정산을 거절하는데 이 글자는 "성공했어요"를 띄운다. 실제 조작으로는 닿을 수
  // 없다(다이얼로그가 Tab 을 가두고 뒤 화면은 백드롭이 막는다). 맞추려면 onUpgrade 가
  // 받아들였는지를 돌려줘야 하는데, 닿지 않는 표시 하나 때문에 두 파일의 계약을 바꿀 일은
  // 아니라고 봤다. 돈과 보관함은 이미 실제로 바뀐 것으로만 움직인다.

  // 결과별 연출 클래스. 값은 globals.css 맨 위 "강화 결과 연출 튜닝" 블록에 있다.
  const resultAnim =
    result === "success" ? "upgrade-success" : result === "keep" ? "upgrade-fail" : result === "destroy" ? "upgrade-destroy" : "";

  const resultText =
    result === "success"
      ? `성공했어요! +${plus} 이 됐어요`
      : result === "keep"
        ? `실패했어요. +${plus} 그대로예요`
        : result === "destroy"
          ? "파괴됐어요. 최고 기록은 남아있어요."
          : null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} 강화`}
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-xs flex-col items-center gap-5 rounded-2xl bg-zinc-950 px-6 pt-12 pb-6 ring-1 ring-white/10"
      >
        <span className="absolute top-4 left-5 flex items-baseline gap-1.5 text-xs font-black text-amber-300">
          <span className="font-medium text-zinc-500">보유</span>
          <Coin amount={credits} />
        </span>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className={`absolute top-3 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-zinc-300 transition-colors hover:bg-white/20 ${FOCUS_RING}`}
        >
          ×
        </button>

        <div key={resultKey} className={resultAnim}>
          <PlayerCard card={card} sport={sport} size="full" plus={plus} />
        </div>

        {/* 움직임이 꺼진 환경·스크린리더에서도 결과가 갈리도록 글자와 aria-live로도 알린다. */}
        <p role="status" aria-live="polite" className="min-h-[1em] text-center text-xs font-bold text-zinc-300">
          {resultText}
        </p>

        <div className="flex w-full flex-col gap-[18px]">
          {atMax ? (
            <p className="text-center text-sm text-zinc-400">
              <span className={`block text-2xl font-black tabular-nums ${s.label}`}>+{plus}</span>
              천장이에요. 더 올릴 수 없어요.
            </p>
          ) : (
            <>
              {/* 강화 수치 아래에 그 단계의 값을 병기한다. 증감액은 안 쓴다 —
                  두 숫자를 나란히 놓으면 차이는 저절로 읽힌다. */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 text-center">
                <div>
                  <div className={`text-2xl font-black tabular-nums ${s.label}`}>+{plus}</div>
                  <Coin amount={now} className="justify-center text-xs font-bold text-zinc-400" />
                </div>
                <span className="pb-4 text-base text-zinc-600">→</span>
                <div>
                  <div className={`text-2xl font-black tabular-nums ${s.label}`}>+{plus + 1}</div>
                  <Coin amount={next} className="justify-center text-xs font-bold text-zinc-400" />
                </div>
              </div>

              {/* 접어둔다. 펼치면 겹치는 툴팁이 아니라 아래 보호권 토글을 밀어내며 연다. */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOddsOpen((o) => !o)}
                  aria-expanded={oddsOpen}
                  className={`inline-flex items-center gap-1.5 rounded text-[11.5px] text-zinc-500 ${FOCUS_RING}`}
                >
                  <span className="grid h-[17px] w-[17px] place-items-center rounded-full bg-white/10 text-[10px] font-black text-zinc-400">
                    ?
                  </span>
                  확률 보기
                </button>
                {oddsOpen && (
                  <div className="w-full rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-left ring-1 ring-white/10 ring-inset">
                    <h5 className="mb-1.5 text-[11px] font-black tracking-wide text-zinc-500">
                      +{plus} → +{plus + 1}
                    </h5>
                    <dl className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1">
                      <dt className="text-[11.5px] text-zinc-400">성공</dt>
                      <dd className="text-right text-xs font-black text-green-400 tabular-nums">{odds.success}%</dd>
                      <dt className="text-[11.5px] text-zinc-400">실패 (유지)</dt>
                      <dd className="text-right text-xs font-black text-zinc-300 tabular-nums">{odds.keep}%</dd>
                      <dt className="text-[11.5px] text-zinc-400">파괴</dt>
                      <dd
                        className={`text-right text-xs font-black tabular-nums ${guard ? "text-zinc-600 line-through" : "text-red-400"}`}
                      >
                        {guard ? "0%" : `${odds.destroy}%`}
                      </dd>
                    </dl>
                  </div>
                )}
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={guard}
                onClick={() => setGuard((g) => !g)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left ring-1 ring-inset transition-colors ${
                  guard ? "bg-green-400/10 ring-green-400/45" : "bg-white/[0.04] ring-white/10"
                } ${FOCUS_RING}`}
              >
                <span
                  aria-hidden="true"
                  className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${guard ? "bg-green-400" : "bg-white/15"}`}
                >
                  <span
                    className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-[left] ${guard ? "left-[19px]" : "left-[3px]"}`}
                  />
                </span>
                <span className="flex-1 text-xs font-bold">
                  파괴 보호권
                  <span className="block text-[11px] font-medium text-zinc-500">
                    {guard ? "터져도 카드가 안 사라져요" : "켜면 파괴 확률이 0이 돼요"}
                  </span>
                </span>
                <span className={`text-sm font-black ${guard ? "text-green-400" : "text-zinc-600"}`}>
                  +<Coin amount={fee} />
                </span>
              </button>

              {/* 낼 금액은 버튼 안에 넣는다. "원"을 붙이지 않는다 — 게임 화폐라
                  현금 결제로 읽히면 안 된다. 동전 그림이 단위를 대신한다. */}
              <button
                type="button"
                disabled={short || destroyed}
                onClick={handleUpgrade}
                className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-black text-zinc-950 transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-zinc-500 disabled:opacity-60 ${FOCUS_RING}`}
              >
                {destroyed ? (
                  "카드가 사라졌어요"
                ) : short ? (
                  "돈이 모자라요"
                ) : (
                  <>
                    강화하기 <Coin amount={pay} className="rounded-md bg-black/20 px-2 py-0.5" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
