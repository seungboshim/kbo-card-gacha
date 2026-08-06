"use client";

import Link from "next/link";
import { PlayerCard, STYLE } from "../_game/card";
import type { Card, SportConfig } from "../_game/deck";
import { cardValue, isBankrupt } from "./economy";
import type { Run } from "./storage";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * 런 종료 화면. 파산(강제)과 "여기까지"(자발)를 가르는 필드가 Run 에 따로 없어도,
 * 끝난 시점의 credits·vault 로 isBankrupt 를 다시 재보면 어느 쪽인지 그대로 나온다 —
 * 파산 판정 자체가 이유다.
 *
 * run.best 는 강화에 "성공"한 적이 있을 때만 채워진다. 파괴돼도 이 기록은 안 지워지므로
 * best 의 카드가 지금 보관함에 없는 게 정상이다. 다만 그 선수가 방출·은퇴로 풀에서
 * 통째로 빠졌을 수도 있어(design doc의 "복원되지 않는 id") 그 경우도 따로 다룬다.
 */
export function Result({
  run,
  byId,
  sport,
  onRestart,
}: {
  run: Run;
  byId: Map<string, Card>;
  sport: SportConfig;
  onRestart: () => void;
}) {
  const bankrupt = isBankrupt(run.credits, run.vault.length);
  const bestCard = run.best ? byId.get(run.best.id) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-6 py-10 text-center">
      <div>
        <h2 className="text-xl font-black tracking-tight">
          {bankrupt ? "크레딧이 떨어졌어요" : "여기서 마무리했어요"}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          {bankrupt
            ? "제일 싼 팩도 못 사고 보관함도 비었어요. 이번 런은 여기까지예요."
            : "이번 런에서 도달한 최고 기록이에요."}
        </p>
      </div>

      {run.best && bestCard ? (
        <div className="flex flex-col items-center gap-3">
          <PlayerCard card={bestCard} sport={sport} size="full" plus={run.best.plus} />
          <p className="text-sm text-zinc-400">
            <span className={`text-2xl font-black tabular-nums ${STYLE[bestCard.tier].label}`}>
              {cardValue(bestCard.tier, run.best.plus).toLocaleString()}
            </span>
            <span className="ml-1.5">크레딧 값</span>
          </p>
        </div>
      ) : run.best ? (
        // 방출·은퇴로 그 선수가 지금 풀에 없다. plus 는 저장돼 있으니 숫자만 보여준다.
        <p className="rounded-2xl bg-white/5 px-6 py-8 text-sm text-zinc-400 ring-1 ring-white/10">
          +{run.best.plus} 까지 갔던 선수가 지금 풀에는 없어요.
        </p>
      ) : (
        <p className="rounded-2xl bg-white/5 px-6 py-8 text-sm text-zinc-400 ring-1 ring-white/10">
          강화에 성공한 적이 없어요. 다음 런에서 도전해봐요.
        </p>
      )}

      <div className="mt-2 flex items-center gap-3">
        <Link
          href="/"
          className={`rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-zinc-200 ring-1 ring-white/15 transition-colors hover:bg-white/20 ${FOCUS_RING}`}
        >
          메인으로
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className={`rounded-xl bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 ${FOCUS_RING}`}
        >
          다시하기
        </button>
      </div>
    </div>
  );
}
