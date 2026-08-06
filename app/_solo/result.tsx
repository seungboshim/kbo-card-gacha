"use client";

import Link from "next/link";
import { PlayerCard } from "../_game/card";
import type { Card, SportConfig } from "../_game/deck";
import { Coin } from "./coin";
import { cardValue, isBankrupt } from "./economy";
import type { Run } from "./storage";
import type { Owned } from "./vault";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * 런 종료 화면. 파산(강제)과 "여기까지"(자발)를 가르는 필드가 Run 에 따로 없어도,
 * 끝난 시점의 credits·vault 로 isBankrupt 를 다시 재보면 어느 쪽인지 그대로 나온다 —
 * 파산 판정 자체가 이유다.
 *
 * run.best 는 이번 런에서 도달한 상위 다섯 기록(가치 내림차순)이다. 도감이라 vault 와
 * 다르다 — 강화 중에 카드가 터져도 지워지지 않는다. "+7까지 갔었다"가 이 모드의 성취다.
 * 다만 그 선수가 방출·은퇴로 풀에서 통째로 빠졌으면 화면에 그릴 수 없어 그 항목만
 * 건너뛴다.
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
  const records = run.best
    .map((o) => ({ owned: o, card: byId.get(o.id) }))
    .filter((r): r is { owned: Owned; card: Card } => r.card != null);
  const [top, ...rest] = records;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-6 py-10 text-center">
      <div>
        {/* 파산 조건(제일 싼 팩도 못 사고 보관함도 비었다)을 문구로 풀어 쓰지 않는다.
            규칙 설명은 판정 직전에나 쓸모 있지, 끝난 뒤에는 김만 뺀다. */}
        <h2 className="text-xl font-black tracking-tight">{bankrupt ? "파산했어요!" : "여기까지!"}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {bankrupt ? "팩 살 돈이 떨어졌어요." : "가장 높이 올린 카드들이에요."}
        </p>
      </div>

      {top ? (
        <div className="flex flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <PlayerCard card={top.card} sport={sport} size="full" plus={top.owned.plus} />
            <Coin
              amount={cardValue(top.card.tier, top.owned.plus)}
              className="text-lg font-black text-amber-300"
            />
          </div>
          {rest.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {rest.map(({ owned, card }) => (
                <div key={`${owned.id}-${owned.plus}`} className="flex w-[100px] flex-col items-center gap-1">
                  <PlayerCard card={card} sport={sport} size="mini" plus={owned.plus} />
                  <Coin amount={cardValue(card.tier, owned.plus)} className="text-[11px] font-bold text-zinc-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/5 px-6 py-8 text-sm text-zinc-400 ring-1 ring-white/10">
          강화에 성공한 적이 없어요. 다음엔 꼭 올려봐요.
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
