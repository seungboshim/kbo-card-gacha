"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { PlayerCard, STYLE } from "./card";
import { TIERS, drawPack, groupByTier, tierRankOf, type Card, type SportConfig, type TierKey } from "./deck";
import { KBO } from "../_sports/kbo";
import { EPL } from "../_sports/epl";

// sport 전체(SportConfig, 함수 필드 포함)는 서버→클라이언트 경계를 직렬화로 못 건너간다.
// 그래서 서버 컴포넌트인 page.tsx는 key만 문자열로 넘기고, 클라이언트에서 실제 설정을 찾는다.
const SPORTS: Record<SportConfig["key"], SportConfig> = { kbo: KBO, epl: EPL };

type Phase = "setup" | "picking" | "opening" | "revealing" | "result";
type OpenStage = "reposition" | "tear" | "drop";

// 1P 하늘색 · 2P 로즈 · 3P 앰버 · 4P 에메랄드
// grad는 팩 선택 단계와 손패 카드 뒷면에 똑같이 쓴다(고른 팩 색이 그대로 손패로 이어지게).
const PLAYERS = [
  { name: "1P", text: "text-sky-300", grad: "from-sky-400 to-sky-600" },
  { name: "2P", text: "text-rose-300", grad: "from-rose-400 to-rose-600" },
  { name: "3P", text: "text-amber-300", grad: "from-amber-400 to-amber-600" },
  { name: "4P", text: "text-emerald-300", grad: "from-emerald-400 to-emerald-600" },
] as const;

const TIER_LABEL = Object.fromEntries(TIERS.map((t) => [t.key, t.label])) as Record<TierKey, string>;
const SCORE_OF = Object.fromEntries(TIERS.map((t) => [t.key, t.score])) as Record<TierKey, number>;

// 봉지 위·아래 핑킹가위 에지. 톱니는 잘고 촘촘하게.
const TEETH = 34; // 팩 전체 폭 기준 톱니 개수
const TOOTH_D = 1.1; // 톱니 깊이 (높이 %)
const TEAR_STEPS = 11; // 세로로 찢긴 절단면의 요철 개수
const TEAR_D = 3; // 절단면 요철 깊이 (폭 %)

/**
 * 위·아래가 핑킹가위로 잘린 봉지 모양 clip-path.
 * x0~x1 구간만 남기고, tornEdge를 주면 그 쪽 절단면을 세로 요철로 찢긴 것처럼 만든다.
 */
function packClip(x0 = 0, x1 = 100, tornEdge?: "left" | "right") {
  const w = x1 - x0;
  const n = Math.max(2, Math.round((TEETH * w) / 100));
  const step = w / n;
  const x = (i: number) => (x0 + i * step).toFixed(2);
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(`${x(i)}% ${i % 2 ? 0 : TOOTH_D}%`); // 위쪽 톱니: 왼→오
  if (tornEdge === "right")
    for (let i = 1; i < TEAR_STEPS; i++)
      pts.push(`${(x1 - (i % 2 ? TEAR_D : 0)).toFixed(2)}% ${((100 * i) / TEAR_STEPS).toFixed(1)}%`);
  for (let i = n; i >= 0; i--) pts.push(`${x(i)}% ${i % 2 ? 100 : 100 - TOOTH_D}%`); // 아래쪽 톱니: 오→왼
  if (tornEdge === "left")
    for (let i = TEAR_STEPS - 1; i >= 1; i--)
      pts.push(`${(x0 + (i % 2 ? TEAR_D : 0)).toFixed(2)}% ${((100 * i) / TEAR_STEPS).toFixed(1)}%`);
  return `polygon(${pts.join(",")})`;
}

const TEAR_X = 80; // 반이 아니라 오른쪽 끄트머리를 뜯는 느낌
const CLIP_WHOLE = packClip();
const CLIP_LEFT = packClip(0, TEAR_X, "right");
const CLIP_RIGHT = packClip(TEAR_X, 100, "left");

export default function Game({ pool, sport: sportKey }: { pool: Card[]; sport: SportConfig["key"] }) {
  const sport = SPORTS[sportKey];
  const [phase, setPhase] = useState<Phase>("setup");
  const [numPlayers, setNumPlayers] = useState(2);
  const [packSize, setPackSize] = useState(5);

  // picking: 슬롯별 팩 내용물과, 슬롯을 고른 플레이어
  const [packs, setPacks] = useState<Card[][]>([]);
  const [slotOwner, setSlotOwner] = useState<(number | null)[]>([]);
  const [pickTurn, setPickTurn] = useState(0);

  const [openStage, setOpenStage] = useState<OpenStage>("reposition");

  // revealing: 플레이어별 남은 손패 / 공개된 스택
  const [hands, setHands] = useState<Card[][]>([]);
  const [revealed, setRevealed] = useState<Card[][]>([]);
  const [turn, setTurn] = useState(0);
  const [spotlight, setSpotlight] = useState<{ card: Card; key: number } | null>(null);
  const spotlightKey = useRef(0);
  // 확대 오버레이: sm 미만에서 스택 카드를 누르면 바로 연다
  const [overlayCard, setOverlayCard] = useState<Card | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!overlayCard) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlayCard(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lastFocusedRef.current?.focus();
    };
  }, [overlayCard]);

  function startGame() {
    // 팩끼리도 중복 금지: 한 팩을 뽑을 때마다 그 카드들을 풀에서 빼고 다음 팩을 뽑는다.
    const packs: Card[][] = [];
    let remaining = pool;
    for (let i = 0; i < numPlayers; i++) {
      const pack = drawPack(groupByTier(remaining), packSize);
      if (pack.length === 0) break; // 풀 고갈 방어 (339명 풀에 최대 28장이라 실질적으로 안 일어난다)
      packs.push(pack);
      const used = new Set(pack.map((c) => c.id));
      remaining = remaining.filter((c) => !used.has(c.id));
    }
    setPacks(packs);
    setSlotOwner(Array(numPlayers).fill(null));
    setPickTurn(0);
    setPhase("picking");
  }

  function pickSlot(slot: number) {
    if (slotOwner[slot] !== null) return;
    const next = [...slotOwner];
    next[slot] = pickTurn;
    setSlotOwner(next);

    if (pickTurn + 1 < numPlayers) {
      setPickTurn(pickTurn + 1);
      return;
    }
    // 전원 다 골랐다: 슬롯 내용물을 각자의 손패로 배정하고 개봉 연출 시작
    setHands(Array.from({ length: numPlayers }, (_, p) => packs[next.indexOf(p)]));
    setRevealed(Array.from({ length: numPlayers }, () => []));
    setOpenStage("reposition");
    setPhase("opening");
  }

  useEffect(() => {
    if (phase !== "opening") return;
    const t1 = setTimeout(() => setOpenStage("tear"), 600);
    const t2 = setTimeout(() => setOpenStage("drop"), 1500);
    const t3 = setTimeout(() => {
      setTurn(0);
      setPhase("revealing");
    }, 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [phase]);

  function flipCardAt(index: number) {
    const hand = hands[turn];
    if (!hand || index >= hand.length) return;
    const card = hand[index];
    const newHands = hands.map((h, i) => (i === turn ? h.filter((_, j) => j !== index) : h));
    setHands(newHands);
    setRevealed((prev) => prev.map((stack, i) => (i === turn ? [...stack, card] : stack)));

    if (tierRankOf(card.tier) >= tierRankOf("EPIC")) {
      spotlightKey.current += 1;
      const key = spotlightKey.current;
      setSpotlight({ card, key });
      setTimeout(() => setSpotlight((s) => (s?.key === key ? null : s)), 1800);
    }

    if (newHands.every((h) => h.length === 0)) {
      setPhase("result");
      return;
    }
    // 팩당 장수가 모두 같아서 한 라운드 안에서는 아무도 먼저 바닥나지 않는다.
    setTurn((turn + 1) % numPlayers);
  }

  // sm 이상: 스택 카드를 누르면 그 카드를 배열 맨 끝(시각적으로 맨 앞)으로 옮긴다.
  function bringToFront(p: number, cardId: string) {
    setRevealed((prev) =>
      prev.map((stack, i) => {
        if (i !== p) return stack;
        const idx = stack.findIndex((c) => c.id === cardId);
        if (idx === -1 || idx === stack.length - 1) return stack;
        return [...stack.slice(0, idx), ...stack.slice(idx + 1), stack[idx]];
      }),
    );
  }

  function resetGame() {
    setPhase("setup");
    setPacks([]);
    setSlotOwner([]);
    setPickTurn(0);
    setHands([]);
    setRevealed([]);
    setTurn(0);
    setSpotlight(null);
    setOverlayCard(null);
  }

  const scores = revealed.map((stack, p) => ({ p, score: stack.reduce((s, c) => s + SCORE_OF[c.tier], 0) }));
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  // 동점이면 공동 순위 (1,2,2,4 식)
  const ranked = sorted.reduce<{ p: number; score: number; rank: number }[]>((acc, s, i) => {
    const prevItem = acc[i - 1];
    const rank = prevItem && prevItem.score === s.score ? prevItem.rank : i + 1;
    return [...acc, { ...s, rank }];
  }, []);

  const gridCols: CSSProperties = { gridTemplateColumns: `repeat(${numPlayers}, minmax(0, 1fr))` };

  // 비닐 카드팩 껍데기. picking과 opening(reposition/tear)에서 똑같이 쓴다 — 겉모습이 같아야
  // "그 팩을 뜯는다"는 연결이 유지된다. clip으로 위/아래 절반만 남기면 tear에서 두 조각으로 쪼갤 수 있다.
  function PackShell({ dim, clip, animateClass }: { dim?: boolean; clip?: "left" | "right"; animateClass?: string }) {
    const clipPath = clip === "left" ? CLIP_LEFT : clip === "right" ? CLIP_RIGHT : CLIP_WHOLE;
    return (
      <div
        className={`absolute inset-0 overflow-hidden bg-[linear-gradient(165deg,#fde68a_0%,#fcd34d_42%,#f59e0b_100%)] ${dim ? "brightness-[.45]" : ""} ${animateClass ?? ""}`}
        style={{ clipPath }}
      >
        {/* 야구공 실밥: 큰 점선 원 테두리의 활 부분만 팩을 지나가게 둔다(좌우 각각, 서로 교차하지 않게) */}
        <div className="absolute top-1/2 -left-[165%] aspect-square w-[190%] -translate-y-1/2 rounded-full border-[3px] border-dashed border-white/50" />
        <div className="absolute top-1/2 -right-[165%] aspect-square w-[190%] -translate-y-1/2 rounded-full border-[3px] border-dashed border-white/50" />

        {/* 위·아래 밀봉부: 살짝 짙은 띠 */}
        <div className="absolute inset-x-0 top-0 h-[7%] bg-black/10" />
        <div className="absolute inset-x-0 bottom-0 h-[7%] bg-black/10" />

        {/* 가운데 워드마크 밴드 */}
        <div className="absolute inset-x-[-6%] top-[38%] -rotate-[4deg] bg-[#111827] py-1.5 text-center shadow-lg sm:py-2">
          <div className="text-sm leading-none font-black tracking-tight text-white sm:text-xl">카드깡</div>
          <div className="mt-0.5 text-[6px] leading-none font-bold tracking-[.2em] text-amber-300 sm:text-[8px]">
            {sport.packSub}
          </div>
        </div>

        {/* 하단 표기 */}
        <div className="absolute inset-x-0 bottom-[11%] text-center text-[7px] leading-tight font-bold text-yellow-950/75 sm:text-[9px]">
          선수 카드 {packSize}장
          <br />
          등급 무작위
        </div>

        {/* 비닐 광택 */}
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_34%,rgba(255,255,255,.55)_47%,transparent_58%)]" />
      </div>
    );
  }

  // 등급이 어떻게 정해지는지 설명. 화면 구석의 (?) 버튼을 누르면 툴팁으로 펼친다.
  function gradeGuide() {
    return (
      <div className="fixed top-2 right-2 z-50 sm:top-3 sm:right-3">
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          aria-expanded={showGuide}
          aria-label="등급이 정해지는 기준"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm leading-none font-bold text-zinc-300 ring-1 ring-white/20 transition hover:bg-white/20"
        >
          ?
        </button>
        {showGuide && (
          <div
            role="tooltip"
            className="absolute top-9 right-0 w-64 space-y-2 rounded-xl bg-zinc-900 p-3 text-left text-[11px] leading-relaxed text-zinc-300 shadow-xl ring-1 ring-white/15"
          >
            <p>
              <b className="text-white">카드 풀</b>
              <br />
              {sport.guide.pool}
            </p>
            <p>
              <b className="text-white">등급</b>
              <br />
              {sport.guide.tier}
            </p>
            <ul className="space-y-0.5 tabular-nums">
              {TIERS.map((t) => (
                <li key={t.key} className="flex justify-between gap-2">
                  <span className={STYLE[t.key].label}>{t.label}</span>
                  <span className="text-zinc-500">
                    {t.pct >= 1 ? "그 외" : `상위 ${Math.round(t.pct * 100)}%`} · {t.score}점
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-zinc-500">점수는 뽑은 카드 등급 점수의 합이에요. 뽑는 순서는 점수에 영향이 없어요.</p>
          </div>
        )}
      </div>
    );
  }

  // 고른 팩 위에 얹는 플레이어 이름. dim된 팩 위로 크게 올린다(팩 디자인을 가려도 상관없다).
  function ownerBadge(owner: number) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-3xl font-black drop-shadow-[0_2px_6px_rgba(0,0,0,.9)] sm:text-4xl ${PLAYERS[owner].text}`}>
          {PLAYERS[owner].name}
        </span>
      </div>
    );
  }

  // revealing/result 공용: 플레이어별 공개 스택. order로 열 순서를 바꿀 수 있다(결과 화면은 점수순).
  // sm 미만에서는 인원수와 무관하게 2열로 감싸(4인=2x2, 3인=2+1, 2인=2x1), sm 이상에서는 인원수만큼 가로 배치.
  // 컨테이너 높이는 팩당 최대 장수(packSize) 기준으로 처음부터 고정해서, 카드를 뒤집어도 아래 요소가 안 밀린다.
  function renderStacks(order: number[]) {
    return (
      <div
        className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[repeat(var(--stack-cols),minmax(0,1fr))] sm:gap-4"
        style={{ "--stack-cols": numPlayers } as CSSProperties}
      >
        {order.map((p) => {
          const stack = revealed[p];
          const score = stack.reduce((s, c) => s + SCORE_OF[c.tier], 0);
          return (
            <div key={p} className="flex w-full flex-col items-center">
              {/* 이름/점수가 스택 카드 위에 항상 보이게: 배경 불투명 + z-index를 카드보다 높게 */}
              <div className="relative z-20 mb-1 w-full bg-zinc-950 py-0.5 text-center sm:mb-2 sm:py-1">
                <div className={`text-sm font-bold ${PLAYERS[p].text}`}>{PLAYERS[p].name}</div>
                <div className="text-lg font-black tabular-nums">{score}</div>
              </div>
              <div
                className="relative w-full max-w-[170px] [--stack-card-h:148px] [--stack-step:17px] sm:[--stack-card-h:340px] sm:[--stack-step:28px]"
                style={{ height: `calc(var(--stack-step) * ${packSize - 1} + var(--stack-card-h))` }}
              >
                {stack.map((card, i) => {
                  // 호버는 아주 약한 CSS 피드백만(hover:*), z-index는 절대 안 건드린다.
                  const hoverCls =
                    "transition duration-200 ease-out hover:-translate-y-[3px] hover:scale-[1.01] hover:brightness-105";
                  const isFront = i === stack.length - 1;
                  const flipCls = isFront ? "animate-[flip-up_.5s_cubic-bezier(.2,.8,.2,1)_both]" : "";
                  return (
                    <div
                      key={card.id}
                      className="absolute inset-x-0 transition-[top] duration-300 ease-out"
                      style={{ top: `calc(var(--stack-step) * ${i})`, zIndex: i }}
                    >
                      {/* sm 미만: mini 카드. 뒤 카드는 넓은 화면과 같이 맨 앞으로, 맨 앞 카드만 확대 모달 */}
                      <button
                        type="button"
                        aria-label={isFront ? `${card.name} 자세히 보기` : `${card.name} 맨 앞으로`}
                        onClick={() => (isFront ? setOverlayCard(card) : bringToFront(p, card.id))}
                        className={`block w-full text-left outline-none sm:hidden ${hoverCls} ${flipCls}`}
                      >
                        <PlayerCard card={card} sport={sport} size="mini" />
                      </button>
                      {/* sm 이상: compact 카드, 누르면 스택 맨 앞으로 이동(모달은 열지 않음) */}
                      <button
                        type="button"
                        aria-label={`${card.name} 맨 앞으로`}
                        onClick={() => bringToFront(p, card.id)}
                        className={`hidden w-full text-left outline-none sm:block ${hoverCls} ${flipCls}`}
                      >
                        <PlayerCard card={card} sport={sport} size="compact" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 손패 영역: 현재 턴 손패만 가운데로 떠올라 조금 크게 보이고(클릭·키보드 조작 가능),
  // 나머지는 화면 아래 플레이어별 가로 고정 자리에 아주 작게 그대로 있다(턴과 무관하게 자리 불변).
  // 활성 플레이어의 아래 자리는 그냥 빈 공간으로 둔다(칸 높이는 min-h로 유지해 다른 자리가 안 밀리게).
  function renderHands() {
    const smallBack = (p: number) => (
      <div
        className={`h-9 w-6 shrink-0 rounded-xs bg-gradient-to-br ring-1 ring-white/10 sm:h-12 sm:w-8 sm:rounded-sm ${PLAYERS[p].grad}`}
      />
    );
    const bigBack = (p: number) => (
      <div
        className={`h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-gradient-to-br ring-1 ring-white/10 sm:h-20 sm:w-14 sm:rounded-md ${PLAYERS[p].grad}`}
      >
        <div className="h-1/3 w-full bg-gradient-to-b from-white/25 to-transparent" />
      </div>
    );
    // 카드 장수가 많아도(최대 7장) 열 폭을 안 넘게 겹쳐서 늘어놓는다. 첫 장 빼고 왼쪽으로 당긴다.
    // 모바일은 4인이면 열 폭이 ~93px뿐이라 겹침을 크게 잡아야 한다.
    const fannedBacks = (p: number, count: number) =>
      Array.from({ length: count }, (_, i) => (
        <div key={i} className={i === 0 ? "" : "-ml-4"}>
          {smallBack(p)}
        </div>
      ));
    return (
      // 손패 전체를 화면 하단에 고정한다. 스크롤이 생겨도 자리를 지킨다.
      <div className="fixed inset-x-0 bottom-0 z-40 px-2">
        {/* 현재 턴 손패: 겹침 없이 일렬, 가운데 정렬.
            턴이 바뀔 때마다(key=turn) 아래 자기 자리에서 가운데로 올라오는 연출이 돈다.
            --hand-dx는 자기 자리 열 중심까지의 가로 오프셋(전체 폭 기준 %). */}
        <div
          key={turn}
          className="flex flex-nowrap items-end justify-center gap-1.5 animate-[hand-rise_.45s_cubic-bezier(.2,.8,.2,1)_both] [--hand-dy:70px] sm:gap-3 sm:[--hand-dy:96px]"
          style={{ "--hand-dx": `${(((turn + 0.5) / numPlayers - 0.5) * 100).toFixed(2)}%` } as CSSProperties}
        >
          {(hands[turn] ?? []).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => flipCardAt(i)}
              aria-label={`손패 카드 ${i + 1}번 뒤집기`}
              className="shrink-0 rounded-sm transition hover:-translate-y-1 active:scale-95 sm:rounded-md"
            >
              {bigBack(turn)}
            </button>
          ))}
        </div>

        {/* 대기 중인 손패: 플레이어별 고정 자리. 카드는 겹쳐서 일렬로 두고(줄바꿈 없음),
            화면 아래로 밀어내 60% 정도만 보이게 한다. 자리는 numPlayers로만 정해져 턴과 무관하다. */}
        <div
          className="mt-1.5 grid translate-y-[40%] sm:mt-2"
          style={{ "--stack-cols": numPlayers, gridTemplateColumns: `repeat(${numPlayers}, minmax(0, 1fr))` } as CSSProperties}
        >
          {Array.from({ length: numPlayers }, (_, p) => p).map((p) => (
            <div key={p} aria-hidden="true" className="flex min-h-[36px] flex-nowrap justify-center sm:min-h-[48px]">
              {p !== turn && fannedBacks(p, (hands[p] ?? []).length)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-4 sm:py-6">
      {gradeGuide()}

      {phase === "setup" && (
        <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-8 text-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              <span className="text-zinc-500 tabular-nums">{sport.seasonLabel}</span> {sport.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {sport.seasonLabel} 시즌 실시간 기록으로 만든 카드팩을 열어 최고의 선수를 뽑아보세요
            </p>
          </div>

          <div className="w-full">
            <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">인원</p>
            <div className="flex justify-center gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumPlayers(n)}
                  aria-pressed={numPlayers === n}
                  className={`w-16 rounded-xl py-3 font-bold transition ${
                    numPlayers === n ? "bg-white text-zinc-950" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {n}명
                </button>
              ))}
            </div>
          </div>

          <div className="w-full">
            <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">팩당 카드 수</p>
            <div className="flex justify-center gap-2">
              {[3, 5, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPackSize(n)}
                  aria-pressed={packSize === n}
                  className={`w-16 rounded-xl py-3 font-bold transition ${
                    packSize === n ? "bg-white text-zinc-950" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {n}장
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={startGame}
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 font-bold text-zinc-950 transition hover:brightness-110 active:scale-[.98]"
          >
            시작
          </button>
        </div>
      )}

      {phase === "picking" && (
        <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center gap-8 sm:gap-10">
          <p className="text-center">
            <span className={`text-3xl font-black ${PLAYERS[pickTurn].text}`}>{PLAYERS[pickTurn].name}</span>
            <span className="ml-2 text-lg text-zinc-400">차례 — 카드팩을 골라주세요</span>
          </p>
          {/* 좁은 화면에서 4인 팩이 한 줄에 들어가야 해서 간격을 좁게 잡는다 */}
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-5">
            {slotOwner.map((owner, slot) => (
              <button
                key={slot}
                type="button"
                disabled={owner !== null}
                onClick={() => pickSlot(slot)}
                aria-label={owner === null ? `카드팩 ${slot + 1}번 고르기` : `${PLAYERS[owner].name}의 카드팩`}
                className={`relative aspect-[10/19] w-20 shrink-0 transition sm:w-28 ${
                  owner === null ? "hover:scale-105 active:scale-95" : ""
                }`}
              >
                <PackShell dim={owner !== null} />
                {owner !== null && ownerBadge(owner)}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "opening" && (
        // 카드가 흩어지는 연출(--sx)이 잠깐 열 밖으로 나가므로 가로 넘침만 잘라낸다
        <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col justify-center gap-16 overflow-x-hidden">
          <div className="grid gap-4" style={gridCols}>
            {Array.from({ length: numPlayers }, (_, p) => {
              const originSlot = slotOwner.indexOf(p);
              const dx = (originSlot - p) * 100;
              return (
                <div key={p} className="flex min-w-0 flex-col items-center gap-3">
                  <span className={`text-sm font-bold ${PLAYERS[p].text}`}>{PLAYERS[p].name}</span>
                  {openStage === "drop" ? (
                    // 7장까지 나올 수 있어 좁은 화면에서는 겹쳐 놓는다(줄바꿈·삐져나감 방지)
                    <div className="flex flex-nowrap justify-center">
                      {Array.from({ length: packSize }, (_, i) => (
                        <div
                          key={i}
                          className={`h-14 w-10 shrink-0 animate-[cards-burst_.5s_ease-out_both] rounded-sm bg-gradient-to-br ring-1 ring-white/15 sm:h-20 sm:w-14 sm:rounded-md ${
                            i === 0 ? "" : "-ml-8 sm:-ml-4"
                          } ${PLAYERS[p].grad}`}
                          style={
                            {
                              animationDelay: `${i * 55}ms`,
                              "--sx": `${(i - (packSize - 1) / 2) * 12}px`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="relative aspect-[10/19] w-20 sm:w-28" style={{ "--dx": `${dx}%` } as CSSProperties}>
                      {/* 개봉 단계는 뜯는 순간이 주인공이라 dim도, 이름 오버레이도 걸지 않는다.
                          누구 팩인지는 위쪽 열 헤더의 플레이어 이름으로 이미 보인다. */}
                      {openStage === "reposition" ? (
                        <PackShell animateClass="animate-[pack-in_.6s_ease-out_both]" />
                      ) : (
                        <>
                          <PackShell clip="left" animateClass="animate-[pack-tear-left_.9s_ease-in_both]" />
                          <PackShell clip="right" animateClass="animate-[pack-tear-right_.9s_ease-in_both]" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm text-zinc-500">개봉 중…</p>
        </div>
      )}

      {phase === "revealing" && (
        // main의 상하 패딩(모바일 py-4=32px, sm 이상 py-6=48px)을 뺀 화면 안에서 본문을 세로 가운데
        // 정렬해, 스택 높이가 packSize 기준으로 고정돼 생기는 빈 공간을 위아래로 나눠 덜 휑해 보이게 한다.
        // 손패가 fixed로 화면 하단에 붙으므로 아래 패딩으로 겹침을 피한다.
        <div className="flex min-h-[calc(100vh-32px)] flex-col justify-center pb-28 sm:min-h-[calc(100vh-48px)] sm:pb-36">
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

          {/* 턴 안내를 화면 맨 위로 */}
          <p className={`mb-2 text-center text-sm font-bold sm:mb-3 ${PLAYERS[turn].text}`}>
            {PLAYERS[turn].name} 차례 — 카드를 뒤집어주세요
          </p>

          {renderStacks(Array.from({ length: numPlayers }, (_, p) => p))}

          {renderHands()}
        </div>
      )}

      {phase === "result" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <h1 className="text-xl font-black tracking-tight">결과</h1>
            {ranked.map(({ p, score, rank }) => (
              <div
                key={p}
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${
                  rank === 1
                    ? "bg-gradient-to-r from-amber-400/20 to-orange-500/20 ring-1 ring-amber-400/40"
                    : "bg-white/5"
                }`}
              >
                <span className="font-black text-zinc-500 tabular-nums">{rank}위</span>
                <span className={`font-bold ${PLAYERS[p].text}`}>{PLAYERS[p].name}</span>
                <span className="font-black tabular-nums">{score}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={resetGame}
              className="rounded-xl bg-white px-4 py-1.5 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200 active:scale-[.97]"
            >
              다시하기
            </button>
          </div>

          {/* 순위표는 점수순이지만 스택은 1P부터 그대로 둔다(누가 뭘 뽑았는지 자리로 찾게) */}
          {renderStacks(Array.from({ length: numPlayers }, (_, p) => p))}
        </div>
      )}

      {overlayCard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${overlayCard.name} 카드 확대`}
          onClick={() => setOverlayCard(null)}
          /* 뒤 화면이 보이게 반투명. 카드에 시선이 가도록 살짝만 흐린다 */
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
        >
          {/* 닫기 버튼은 카드 위쪽 줄에 둔다. 카드에 겹쳐 두면 카드가 위로 덮어 가려진다 */}
          <div className="flex w-full max-w-xs flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => setOverlayCard(null)}
              aria-label="닫기"
              className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full bg-zinc-900 text-xl leading-none font-bold text-white/80 ring-1 ring-white/20 outline-none transition hover:bg-zinc-800 hover:text-white"
            >
              ×
            </button>
            <PlayerCard card={overlayCard} sport={sport} size="full" />
          </div>
        </div>
      )}
    </main>
  );
}
