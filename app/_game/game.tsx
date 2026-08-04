"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { PlayerCard, STYLE } from "./card";
import { TIERS, drawPack, groupByTier, tierRankOf, type Card, type SportConfig, type TierKey } from "./deck";
import {
  applyRound,
  battleEnd,
  frontOf,
  isFinalRound,
  resolveRound,
  stalemateLimit,
  survivorsOf,
  type BattleEnd,
  type BattleSide,
  type RoundResult,
} from "./battle";
import { KBO } from "../_sports/kbo";
import { EPL } from "../_sports/epl";

// sport 전체(SportConfig, 함수 필드 포함)는 서버→클라이언트 경계를 직렬화로 못 건너간다.
// 그래서 서버 컴포넌트인 page.tsx는 key만 문자열로 넘기고, 클라이언트에서 실제 설정을 찾는다.
const SPORTS: Record<SportConfig["key"], SportConfig> = { kbo: KBO, epl: EPL };

type Phase = "setup" | "picking" | "opening" | "revealing" | "result" | "battle";
type OpenStage = "reposition" | "tear" | "drop";
// 대결 한 판의 연출 단계. idle: 판정 전/후 대기, clash: 충돌, judge: 판정(빛나거나 파괴)
type BattleStage = "idle" | "clash" | "judge";
// 판정 결과 + 그 판을 계산할 때의 덱/quietRounds 스냅샷. 타이머가 끝나면 이걸로 applyRound를 커밋한다.
type BattleAnim = { result: RoundResult; beforeDecks: Card[][]; beforeQuiet: number; final: boolean };

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

// 대결 화면 배치: 인원수별로 몇 번째 줄에 어떤 플레이어(PLAYERS 인덱스)가 들어가는지.
// 화면 폭과 무관하게 항상 이 모양대로 간다 — 2인은 가로 한 줄, 3인은 역삼각형, 4인은 2x2.
const BATTLE_ROWS: Record<number, number[][]> = {
  2: [[0, 1]],
  3: [
    [0, 1],
    [2],
  ],
  4: [
    [0, 1],
    [2, 3],
  ],
};

// 각 자리 카드가 대결에서 등장할 때 출발하는 방향(중심의 반대쪽). x: 좌우, y: 상하(+는 아래).
const APPROACH_DIR: Record<number, { x: number; y: number }[]> = {
  2: [
    { x: -1, y: 0 }, // 1P: 왼쪽
    { x: 1, y: 0 }, // 2P: 오른쪽
  ],
  3: [
    { x: -1, y: -1 }, // 1P: 왼쪽 위
    { x: 1, y: -1 }, // 2P: 오른쪽 위
    { x: 0, y: 1 }, // 3P: 아래
  ],
  4: [
    { x: -1, y: -1 }, // 1P: 왼쪽 위
    { x: 1, y: -1 }, // 2P: 오른쪽 위
    { x: -1, y: 1 }, // 3P: 왼쪽 아래
    { x: 1, y: 1 }, // 4P: 오른쪽 아래
  ],
};
const APPROACH_X = 60; // px
const APPROACH_Y = 40; // px

// 상단 남은 손패 띠: mini 카드를 이 폭 기준으로 그린 뒤 scale로 줄인다.
// 148은 renderStacks가 mini 카드 높이로 실측해 쓰는 값(--stack-card-h)과 같다.
const HAND_BASE_W = 170;
const HAND_BASE_H = 148;
const HAND_SCALE = 0.2;
const HAND_W = Math.round(HAND_BASE_W * HAND_SCALE);
const HAND_H = Math.round(HAND_BASE_H * HAND_SCALE);

// 판정 결과를 글로 요약. 연출이 안 보여도(스크린리더, prefers-reduced-motion) 결과를 알 수 있게 aria-live로 읽힌다.
function roundSummary(r: RoundResult, final: boolean): string {
  const label = (e: BattleSide) => `${PLAYERS[e.player].name} ${TIER_LABEL[e.card.tier]}`;
  const prefix = final ? "마지막 승부. " : "";
  if (r.draw) return `${prefix}${r.winners.map(label).join(", ")} 무승부`;
  return `${prefix}${r.winners.map(label).join(", ")} 승, ${r.losers.map(label).join(", ") || "없음"} 파괴`;
}

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

  // battle: 대결용 덱(원본 revealed와 별개), 판 번호, 연출 단계, 종료 정보
  const [battleDecks, setBattleDecks] = useState<Card[][]>([]);
  const [battleRound, setBattleRound] = useState(0);
  const [battleAnim, setBattleAnim] = useState<BattleAnim | null>(null);
  const [battleStage, setBattleStage] = useState<BattleStage>("idle");
  const [quietRounds, setQuietRounds] = useState(0);
  const [battleFinish, setBattleFinish] = useState<BattleEnd | null>(null);

  function startBattle() {
    setBattleDecks(revealed.map((stack) => [...stack])); // 원본 revealed는 복귀 시 그대로 남아야 해서 복사
    setBattleRound(0);
    setBattleAnim(null);
    setBattleStage("idle");
    setQuietRounds(0);
    setBattleFinish(null);
    setPhase("battle");
  }

  // 한 판 진행: 판정은 바로 하되(등급/막배틀 rating은 battle.ts가 가린다), 덱 반영은
  // 연출이 끝난 뒤(judge 단계 종료 시점)에 커밋한다. beforeDecks/beforeQuiet를 같이 들고 있어
  // 커밋 시점에 다른 state를 다시 안 읽어도 된다.
  function playRound() {
    if (battleAnim || battleFinish) return;
    const result = resolveRound(battleDecks);
    if (!result) return;
    setBattleAnim({ result, beforeDecks: battleDecks, beforeQuiet: quietRounds, final: isFinalRound(battleDecks) });
    setBattleRound((n) => n + 1);
    setBattleStage("clash");
  }

  useEffect(() => {
    if (!battleAnim) return;
    const t1 = setTimeout(() => setBattleStage("judge"), 350);
    const t2 = setTimeout(() => {
      const next = applyRound(battleAnim.beforeDecks, battleAnim.result);
      const quiet = battleAnim.result.losers.length === 0 ? battleAnim.beforeQuiet + 1 : 0;
      setBattleDecks(next);
      setQuietRounds(quiet);
      const end = battleEnd(next, quiet, stalemateLimit(next));
      if (end.finished) setBattleFinish(end);
      setBattleAnim(null);
      setBattleStage("idle");
    }, 950);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [battleAnim]);

  // 자동 진행: 판정/정리가 끝나(battleAnim이 비고) 아직 안 끝났으면 다음 판을 예약한다.
  // 250ms는 새 카드가 등장하는 걸 볼 시간이고, 이후 충돌(350ms)·판정(600ms)까지 더하면
  // 한 판이 총 1.2초 정도로 흐른다. phase가 battle을 벗어나면(결과로 돌아가기 등) cleanup에서 예약을 지운다.
  // 안전장치: 판수가 비정상적으로 커지면 battleEnd에 limit 0을 줘 그 자리에서 강제로 끝낸다.
  useEffect(() => {
    if (phase !== "battle" || battleAnim || battleFinish) return;
    const t = setTimeout(() => {
      if (battleRound >= 200) {
        setBattleFinish(battleEnd(battleDecks, quietRounds, 0));
        return;
      }
      playRound();
    }, 250);
    return () => clearTimeout(t);
    // playRound는 매 렌더마다 새로 만들어져서 deps에 넣으면 대결과 무관한 리렌더에도
    // 타이머가 리셋된다. 실제로 쓰는 값은 이미 다 deps에 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, battleAnim, battleFinish, battleRound, battleDecks, quietRounds]);

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
    setBattleDecks([]);
    setBattleRound(0);
    setBattleAnim(null);
    setBattleStage("idle");
    setQuietRounds(0);
    setBattleFinish(null);
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
          className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm leading-none font-bold text-zinc-300 ring-1 ring-white/20 transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-white/20"
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
                    "transition-[translate,scale,filter] duration-200 ease-out hover:-translate-y-[3px] hover:scale-[1.01] hover:brightness-105";
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
                        className={`block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:hidden ${hoverCls} ${flipCls}`}
                      >
                        <PlayerCard card={card} sport={sport} size="mini" />
                      </button>
                      {/* sm 이상: compact 카드, 누르면 스택 맨 앞으로 이동(모달은 열지 않음) */}
                      <button
                        type="button"
                        aria-label={`${card.name} 맨 앞으로`}
                        onClick={() => bringToFront(p, card.id)}
                        className={`hidden w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:block ${hoverCls} ${flipCls}`}
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
              className="shrink-0 rounded-sm transition-transform hover:-translate-y-1 active:scale-[0.96] sm:rounded-md"
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

  // 남은 손패를 mini 카드 앞면을 겹쳐서 보여준다(뒷면이 아니다 — 카드깡이 끝나 이미 다 공개됐다).
  // 새 size를 만들지 않고 mini 카드를 HAND_BASE_W 기준으로 그린 뒤 scale로 축소한다.
  function miniHandCard(card: Card) {
    return (
      <div className="relative shrink-0 overflow-hidden rounded-[3px]" style={{ width: HAND_W, height: HAND_H }}>
        <div style={{ width: HAND_BASE_W, transform: `scale(${HAND_SCALE})`, transformOrigin: "top left" }}>
          <PlayerCard card={card} sport={sport} size="mini" />
        </div>
      </div>
    );
  }

  // 대결 상단 띠: 플레이어별 남은 카드를 겹쳐서 보여준다. 탈락했으면 숫자 없이 "탈락"만 둔다.
  function renderRemainingHands() {
    return (
      <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
        {Array.from({ length: numPlayers }, (_, p) => p).map((p) => {
          const deck = battleDecks[p];
          return (
            <div key={p} className="flex flex-col items-center gap-1">
              <span className={`text-xs font-bold ${PLAYERS[p].text}`}>{PLAYERS[p].name}</span>
              {deck.length === 0 ? (
                <div style={{ height: HAND_H }} className="flex items-center text-xs font-bold text-zinc-500">
                  탈락
                </div>
              ) : (
                <div className="flex">
                  {deck.map((card, i) => (
                    <div key={card.id} style={i === 0 ? undefined : { marginLeft: -HAND_W / 2 }}>
                      {miniHandCard(card)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // 대결 화면. 판정 전/후 대기(battleAnim 없음)와 진행 중(battleAnim 있음)을 같은 자리에 그린다.
  // 카드 크기는 renderStacks와 같은 규칙(sm 미만 mini, sm 이상 compact)을 그대로 따른다.
  function renderBattle() {
    const finalUp = !battleAnim && !battleFinish && battleRound > 0 && isFinalRound(battleDecks);
    const rows = BATTLE_ROWS[numPlayers] ?? [Array.from({ length: numPlayers }, (_, p) => p)];

    // 대결 카드 한 장. 대기 중엔 스택 맨 앞 카드, 진행 중엔 이번 판 카드를 자기 자리(p)에 그린다.
    // 래퍼 폭 계산은 renderStacks와 같다(min-w-0 + flex-1 + max-w-170px) — grid justify-items로 인한
    // 폭 불일치를 피하려 일부러 grid 대신 flex를 쓴다.
    function battleCard(p: number) {
      if (!battleAnim) {
        const card = frontOf(battleDecks[p]);
        if (!card) return null;
        return (
          <div key={p} className="flex min-w-0 flex-1 max-w-[170px] flex-col items-center gap-1">
            <span className={`text-xs font-bold ${PLAYERS[p].text}`}>{PLAYERS[p].name}</span>
            {/* renderStacks와 같은 규칙: sm 미만 mini, sm 이상 compact */}
            <div className="w-full sm:hidden">
              <PlayerCard key={card.id} card={card} sport={sport} size="mini" />
            </div>
            <div className="hidden w-full sm:block">
              <PlayerCard key={card.id} card={card} sport={sport} size="compact" />
            </div>
          </div>
        );
      }
      const entry = battleAnim.result.entries.find((e) => e.player === p);
      if (!entry) return null;
      const isWinner = battleAnim.result.winners.some((w) => w.player === p);
      const judge = battleStage === "judge";
      const dir = APPROACH_DIR[numPlayers]?.[p] ?? { x: 0, y: 0 };
      const approachStyle = {
        "--bx": `${dir.x * APPROACH_X}px`,
        "--by": `${dir.y * APPROACH_Y}px`,
      } as CSSProperties;
      const faceClass =
        battleStage === "clash"
          ? "animate-[battle-approach_.25s_ease-out_both]"
          : judge
            ? isWinner
              ? "animate-[battle-win-glow_.4s_ease-in-out]"
              : "animate-[battle-lose-shatter_.25s_ease-in_forwards]"
            : "";
      // 판정 결과는 카드 아래 문구 대신 카드 위 오버레이(테두리+틴트)로 표현한다. 자리를 차지하지 않아
      // 배지가 붙고 빠질 때 아래 요소가 밀리지 않고, 애니메이션이 꺼져도(prefers-reduced-motion) 그대로 보인다.
      // faceClass를 쓰는 div의 형제로 둬서, 그 div가 연출 끝에 opacity 0으로 끝나도 영향을 안 받는다.
      const outcomeCls = !judge ? "" : isWinner ? "ring-2 ring-emerald-400/80" : "bg-black/50 ring-2 ring-red-500/70";
      return (
        <div key={p} className="flex min-w-0 flex-1 max-w-[170px] flex-col items-center gap-1">
          <span className={`text-xs font-bold ${PLAYERS[p].text}`}>{PLAYERS[p].name}</span>
          <div className="relative w-full sm:hidden">
            <div className={faceClass} style={approachStyle}>
              <PlayerCard card={entry.card} sport={sport} size="mini" />
            </div>
            {judge && (
              <span aria-hidden="true" className={`pointer-events-none absolute inset-0 rounded-2xl ${outcomeCls}`} />
            )}
          </div>
          <div className="relative hidden w-full sm:block">
            <div className={faceClass} style={approachStyle}>
              <PlayerCard card={entry.card} sport={sport} size="compact" />
            </div>
            {judge && (
              <span aria-hidden="true" className={`pointer-events-none absolute inset-0 rounded-2xl ${outcomeCls}`} />
            )}
          </div>
          {battleAnim.final && (
            <span className="text-[10px] text-zinc-500 tabular-nums">활약도 {entry.card.rating.toFixed(1)}</span>
          )}
        </div>
      );
    }

    return (
      // 4인 2x2처럼 줄이 두 개가 되면 세로가 빡빡해져 gap/padding을 결과 화면보다 좁게 잡는다
      // (카드 크기는 그대로 두고 여백만 줄인다 — 1440x950 안에 들어오도록 실측해 맞춘 값).
      <div className="flex min-h-[80vh] flex-col justify-between gap-2 py-2 sm:gap-3 sm:py-2">
        {renderRemainingHands()}

        {battleFinish ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <p aria-live="polite" className="text-2xl font-black">
              {battleFinish.stalemate
                ? `${battleFinish.champions.map((p) => PLAYERS[p].name).join(", ")} 카드를 가장 많이 남겨 ${
                    battleFinish.champions.length > 1 ? "공동 우승" : "우승"
                  }!`
                : `${battleFinish.champions.map((p) => PLAYERS[p].name).join(", ")} ${
                    battleFinish.champions.length > 1 ? "공동 우승" : "우승"
                  }!`}
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {battleFinish.champions.map((p) => (
                <div key={p} className="flex flex-col items-center gap-2">
                  <span className={`font-bold ${PLAYERS[p].text}`}>{PLAYERS[p].name}</span>
                  {/* 폭은 결과·대결 화면과 같은 170px. 좁게 잡으면 이름이 잘리고 스탯 칸이 두 줄로 깨진다.
                      여러 장이 남을 수 있어 size는 mini로 두고 넘치면 줄바꿈한다. */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {battleDecks[p].map((card) => (
                      <div key={card.id} className="w-[170px] max-w-full">
                        <PlayerCard card={card} sport={sport} size="mini" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("result")}
                className="rounded-xl bg-white px-4 py-1.5 text-sm font-bold text-zinc-950 transition-[background-color,scale] hover:bg-zinc-200 active:scale-[0.96]"
              >
                결과로 돌아가기
              </button>
              <button
                type="button"
                onClick={resetGame}
                className="rounded-xl bg-white/10 px-4 py-1.5 text-sm font-bold text-zinc-200 transition-[background-color,scale] hover:bg-white/20 active:scale-[0.96]"
              >
                다시하기
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              {/* 이 줄은 내용이 없어도 자리를 지킨다. 조건부로 붙였다 빼면 카드 대열이 위아래로 밀린다. */}
              <div className="flex h-7 items-center justify-center">
                {battleAnim && battleStage === "judge" && battleAnim.result.draw ? (
                  <p className="text-center text-lg font-black text-zinc-200">무승부</p>
                ) : battleAnim?.final ? (
                  <p className="text-center text-xs font-bold tracking-wide text-amber-400 uppercase">마지막 승부</p>
                ) : null}
              </div>
              <p aria-live="polite" className="sr-only">
                {battleAnim && battleStage === "judge" ? roundSummary(battleAnim.result, battleAnim.final) : ""}
              </p>

              <div className="relative flex w-full flex-col gap-3 sm:gap-6">
                {rows.map((row, ri) => (
                  <div key={ri} className="flex w-full flex-wrap justify-center gap-3 sm:gap-6">
                    {row.map((p) => battleCard(p))}
                  </div>
                ))}
                {battleAnim && battleStage === "clash" && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 m-auto h-20 w-20 animate-[battle-flash_.2s_ease-out_both] rounded-full bg-white/70 blur-md"
                    style={{ animationDelay: "140ms" }}
                  />
                )}
              </div>
            </div>

            <p className="self-center text-sm text-zinc-500 tabular-nums">
              {battleRound === 0 ? "대결 준비" : `${battleRound}판`}
              {finalUp && " · 다음이 마지막 승부"}
            </p>

            {/* 자동 진행이라 이 버튼이 없으면 끝날 때까지 화면에 갇힌다. 나가면 예약된 타이머도 정리된다. */}
            <button
              type="button"
              onClick={() => setPhase("result")}
              className="self-center rounded-xl bg-white/10 px-4 py-1.5 text-sm font-bold text-zinc-300 ring-1 ring-white/15 transition-[background-color,scale] hover:bg-white/20 active:scale-[0.96]"
            >
              그만두고 결과로
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    // 대결 화면은 4인 2x2 카드 두 줄이 들어가야 해서 세로가 빡빡하다. 그때만 상하 여백을 줄인다.
    <main
      className={`mx-auto min-h-screen w-full max-w-5xl px-4 ${phase === "battle" ? "py-1" : "py-4 sm:py-6"}`}
    >
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
                  className={`w-16 rounded-xl py-3 font-bold transition-colors ${
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
                  className={`w-16 rounded-xl py-3 font-bold transition-colors ${
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
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 font-bold text-zinc-950 transition-[filter,scale] hover:brightness-110 active:scale-[0.96]"
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
                className={`relative aspect-[10/19] w-20 shrink-0 transition-transform sm:w-28 ${
                  owner === null ? "hover:scale-105 active:scale-[0.96]" : ""
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
          </div>

          {/* 순위표는 점수순이지만 스택은 1P부터 그대로 둔다(누가 뭘 뽑았는지 자리로 찾게) */}
          {renderStacks(Array.from({ length: numPlayers }, (_, p) => p))}

          {/* 결과를 보고 다음 행동을 고르는 순서라, 버튼은 스택 아래로 둔다(대결 종료 화면과 같은 배치) */}
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={resetGame}
              className="rounded-xl bg-white px-4 py-1.5 text-sm font-bold text-zinc-950 transition-[background-color,scale] hover:bg-zinc-200 active:scale-[0.96]"
            >
              다시하기
            </button>
            <button
              type="button"
              onClick={startBattle}
              disabled={survivorsOf(revealed).length < 2}
              className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-sm font-bold text-zinc-950 transition-[filter,scale] hover:brightness-110 active:scale-[0.96] disabled:opacity-40"
            >
              대결하기
            </button>
          </div>
        </div>
      )}

      {phase === "battle" && renderBattle()}

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
              className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full bg-zinc-900 text-xl leading-none font-bold text-white/80 ring-1 ring-white/20 outline-none transition-colors hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
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
