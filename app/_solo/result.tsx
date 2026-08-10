"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "./use-focus-trap";
import { PlayerCard } from "../_game/card";
import type { Card, SportConfig } from "../_game/deck";
import { Coin } from "./coin";
import { cardValue, isBankrupt } from "./economy";
import { BASEBALL_SLOTS, FORMATION_SLOTS } from "./squad";
import { SquadField } from "./squad-field";
import type { Run } from "./storage";
import type { Owned } from "./vault";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";
// 카드를 여는 버튼은 vault-grid.tsx 의 SELECT_FOCUS 와 같은 이유로 outline 계열을 쓴다
// (CLAUDE.md 근거). ring 이 아니라 outline 이라야 카드 자체의 등급 글로우와 안 부딪힌다.
// outline-none 을 같이 쓰면 안 된다 — Tailwind v4 가 --tw-outline-style 을 none 으로
// 고정해버려 focus-visible:outline-2 가 안 그려진다.
const CARD_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

/** 최고 기록 한 장. byId 조회가 끝나 카드 데이터가 확정된 상태다. */
type Entry = { owned: Owned; card: Card };

const worth = (r: Entry) => cardValue(r.card.tier, r.owned.plus);

/**
 * 카드 한 장을 크게 보는 읽기 전용 다이얼로그.
 *
 * enlarged-card.tsx 를 재사용하지 않는다 — 그건 수량 핸들·팔기·강화 버튼이 붙어
 * 있는데 판이 끝난 화면에서는 다 의미가 없다. 카드와 값만 보여준다.
 *
 * 포커스 패턴은 enlarged-card.tsx · upgrade-overlay.tsx 를 그대로 옮겼다: 열리면
 * 닫기 버튼에 포커스, Escape·배경 클릭으로 닫힌다, 닫히면 열기 전 포커스로 복원한다.
 * 복원은 setState 가 아니라 ref 로 하므로 react-hooks/set-state-in-effect 에 안 걸린다.
 */
function CardDetail({
  entry,
  sport,
  onClose,
}: {
  entry: Entry;
  sport: SportConfig;
  onClose: () => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

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

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.card.name} 카드 상세`}
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
    >
      {/* items-center 를 쓰면 안 된다. 카드가 제 내용 크기로 쪼그라들어 폭이 들쭉날쭉해지고,
          카드 옆에 남는 빈 자리가 여전히 이 div 안이라 거기를 눌러도 stopPropagation 에
          막혀 안 닫힌다. 폭을 max-w-xs 로 고정하고 카드가 그 폭을 다 쓰게 두면,
          카드 바깥은 전부 백드롭이라 눌러서 닫을 수 있다. enlarged-card.tsx 와 같은 구조다. */}
      <div className="flex w-full max-w-xs flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className={`flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full bg-zinc-900 text-xl leading-none font-bold text-white/80 ring-1 ring-white/20 transition-colors hover:bg-zinc-800 hover:text-white ${FOCUS_RING}`}
        >
          ×
        </button>
        {/* 열리는 연출도 다른 확대 화면과 같게 맞춘다. */}
        <div className="animate-[card-in_.5s_cubic-bezier(.2,.8,.2,1)_both]">
          <PlayerCard card={entry.card} sport={sport} size="full" plus={entry.owned.plus} />
        </div>
        <Coin amount={worth(entry)} className="justify-center text-lg font-black text-amber-300" />
      </div>
    </div>
  );
}

/**
 * 최고 기록 한 줄. 가치순·강화순 둘 다 같은 모양(mini 카드 + 값)이라 여기서 같이 그린다.
 * 같은 카드가 두 줄에 다 나올 수 있다 — 실제로 양쪽 1등이면 그게 사실이라 그대로 둔다.
 */
function BestRow({
  title,
  items,
  sport,
  onSelect,
}: {
  title: string;
  items: Entry[];
  sport: SportConfig;
  onSelect: (entry: Entry) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <h3 className="text-xs font-bold text-zinc-500">{title}</h3>
      {/* 폭을 고정하지 않고 3열 그리드로 남는 자리를 나눠 쓴다. 100px 로 박아뒀더니
          mini 카드 안에서 강화 칩이 이름 자리를 먹어 "김도영 +13" 이 "긷 +13" 으로
          잘렸다. mini 는 165px 안팎을 전제로 만든 크기라(CLAUDE.md) 좁히면 여기가
          먼저 깨진다. 3열이면 390px 화면에서도 한 장에 116px 쯤 돌아가 세 글자
          이름이 들어간다. */}
      <div className="grid w-full grid-cols-3 gap-2">
        {items.map((entry) => (
          <button
            key={entry.owned.id}
            type="button"
            onClick={() => onSelect(entry)}
            aria-label={`${entry.card.name} 카드 상세`}
            className={`flex flex-col items-center gap-1 rounded-2xl ${CARD_FOCUS}`}
          >
            {/* w-full 을 감싸는 div 에 준다. 버튼이 items-center 라 카드가 제 내용
                크기(65px)로 쪼그라들어 있었다 — 그래서 칸을 넓혀도 이름이 계속 잘렸다.
                vault-grid.tsx 의 SlotCard 도 같은 이유로 버튼에 w-full 을 준다. */}
            <div className="w-full">
              <PlayerCard card={entry.card} sport={sport} size="mini" plus={entry.owned.plus} />
            </div>
            <Coin amount={worth(entry)} className="text-[11px] font-bold text-zinc-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 런 종료 화면. 파산(강제)과 "여기까지"(자발)를 가르는 필드가 Run 에 따로 없어도,
 * 끝난 시점의 credits·vault 로 isBankrupt 를 다시 재보면 어느 쪽인지 그대로 나온다 —
 * 파산 판정 자체가 이유다.
 *
 * run.best 는 이번 런에서 도달한 최고 기록 후보다(가치순·강화순 각 상위 BEST_KEEP
 * 장의 합집합, solo.tsx 의 mergeBest 참고). 도감이라 vault 와 다르다 — 강화 중에
 * 카드가 터져도 지워지지 않는다. 화면에는 그중 가치순 top3, 강화순 top3(같은 강화
 * 수치는 가치 내림차순)를 한 줄씩 보여준다 — 다섯 장씩 두 줄이면 세로로 넘친다.
 *
 * 그 선수가 방출·은퇴로 풀에서 통째로 빠졌으면 화면에 그릴 수 없어 그 항목만
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
  const records: Entry[] = run.best
    .map((o) => ({ owned: o, card: byId.get(o.id) }))
    .filter((r): r is Entry => r.card != null);

  const byValue = [...records].sort((a, b) => worth(b) - worth(a)).slice(0, 3);
  const byPlus = [...records]
    .sort((a, b) => b.owned.plus - a.owned.plus || worth(b) - worth(a))
    .slice(0, 3);

  // 스쿼드를 한 번도 안 짰으면(run.bestSquad.squad 가 비어 있으면) 스쿼드 자리를
  // 아예 안 그린다 - "팩을 한 번도 안 사봤어요" 빈 상태와 같은 결이다.
  const hasBestSquad = Object.keys(run.bestSquad.squad).length > 0;
  const bestSlots = run.bestSquad.formation ? FORMATION_SLOTS[run.bestSquad.formation] : BASEBALL_SLOTS;

  const [selected, setSelected] = useState<Entry | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-6 py-10 text-center lg:max-w-3xl">
      <div>
        {/* 파산 조건(제일 싼 팩도 못 사고 보관함도 비었다)을 문구로 풀어 쓰지 않는다.
            규칙 설명은 판정 직전에나 쓸모 있지, 끝난 뒤에는 김만 뺀다. */}
        <h2 className="text-xl font-black tracking-tight">{bankrupt ? "파산했어요!" : "여기까지!"}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {bankrupt ? "팩 살 돈이 떨어졌어요." : "가장 값나가는 카드와 가장 많이 강화한 카드예요."}
        </p>
      </div>

      {records.length > 0 ? (
        // PC 는 좌우로(스쿼드 · 가치순/강화순 top3), 모바일은 위아래로.
        <div className="flex w-full flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
          {/* 지금 스쿼드가 아니라 이 런에서 가장 값나갔던 순간의 박제다(storage.ts
              의 Run.bestSquad) - 나중에 팔거나 강화 정리로 지금 스쿼드가 줄어도
              이건 그대로 남는다. 슬롯을 눌러도 아무 일도 안 나게 읽기 전용으로 쓴다. */}
          {hasBestSquad && (
            <div className="flex w-full flex-col items-center gap-2 lg:w-[260px] lg:shrink-0">
              <h3 className="text-xs font-bold text-zinc-500">최고 기록 스쿼드</h3>
              <div className="w-full max-w-[260px]">
                <SquadField
                  slots={bestSlots}
                  squad={run.bestSquad.squad}
                  byId={byId}
                  isFootball={!!run.bestSquad.formation}
                  activeSlotId={null}
                  onSlotClick={() => {}}
                />
              </div>
              <Coin amount={run.bestSquad.value} className="text-sm font-black text-amber-300" />
            </div>
          )}
          <div className="flex w-full flex-col gap-6 lg:max-w-xs">
            <BestRow title="가치순 최고 기록" items={byValue} sport={sport} onSelect={setSelected} />
            <BestRow title="강화순 최고 기록" items={byPlus} sport={sport} onSelect={setSelected} />
          </div>
        </div>
      ) : (
        // 뽑은 카드는 강화 여부와 상관없이 best 에 들어간다(solo.tsx 의 buy()).
        // 그래서 여기가 비는 경우는 딱 하나, 팩을 한 번도 안 산 것뿐이다(스쿼드에
        // 카드를 넣으려면 먼저 뽑아야 하니 그때도 이 조건 하나로 같이 걸러진다).
        <p className="rounded-2xl bg-white/5 px-6 py-8 text-sm text-zinc-400 ring-1 ring-white/10">
          팩을 한 번도 안 사봤어요. 다음엔 한 봉 사보세요.
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

      {selected && <CardDetail entry={selected} sport={sport} onClose={() => setSelected(null)} />}
    </div>
  );
}
