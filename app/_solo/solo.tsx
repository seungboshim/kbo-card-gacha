"use client";

import { useEffect, useRef, useState } from "react";
import { drawPack, groupByTier, type Card, type SportConfig } from "../_game/deck";
import { KBO } from "../_sports/kbo";
import { EPL } from "../_sports/epl";
import { Coin } from "./coin";
import { cardValue, isBankrupt, type Pack } from "./economy";
import { UpgradeOverlay } from "./upgrade-overlay";
import { applyUpgrade, takeFrom, toSlots, type Owned, type SlotRef, type UpgradeResult } from "./vault";
import { BEST_KEEP, clearRun, loadRun, newRun, saveRun, type Run } from "./storage";
import {
  BASEBALL_SLOTS,
  FORMATION_SLOTS,
  bumpPlus,
  carrySquad,
  isDuplicate,
  pruneSquad,
  squadValue,
  type Formation,
} from "./squad";
import { Opening } from "./opening";
import { Result } from "./result";
import { Shop } from "./shop";
import { SquadDrawer } from "./squad-drawer";
import { SquadPanel } from "./squad-panel";
import { useFocusTrap } from "./use-focus-trap";
import { VaultGrid } from "./vault-grid";

const SPORTS: Record<SportConfig["key"], SportConfig> = { kbo: KBO, epl: EPL };
const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * 상태가 바뀔 때마다(구매·판매·강화) 파산 조건을 다시 잰다. 이미 over 가 켜져
 * 있으면(자발적 종료) 그대로 두고, 아니면 isBankrupt 결과로만 켠다 — 한 번 켠 종료는
 * 다시 안 끈다.
 */
function settleOver(next: Run): Run {
  return next.over || isBankrupt(next.credits, next.vault.length) ? { ...next, over: true } : next;
}

/**
 * 스쿼드 값 필드(prevSquadValue·bestSquad)를 최신화한다. old 는 이번 변동 직전 상태,
 * next 는 squad·formation 이 이미 반영된 상태다.
 *
 * 이전 가치는 이번 변동 직전 값으로 밀어 넣는다 - squad-panel.tsx 가 그 차이로
 * 상승/하락 이펙트를 그리는 기준이다. 지금 가치가 최고기록보다 크면 최고기록을
 * (스쿼드·포메이션·가치 통째로) 갈아끼운다.
 *
 * placeInSquad·removeFromSquad·changeFormation 뿐 아니라 sell·upgrade 로 스쿼드가
 * 줄어들 때도 반드시 거쳐야 한다 - 최고기록은 "그때 그랬다"의 박제라 스쿼드가 줄어도
 * 그대로 남아야 하고(값이 안 늘었으니 안 갈아끼워진다), 이전 가치는 그 시점 값으로라도
 * 갱신돼야 다음 변동에서 다시 상승/하락을 잴 수 있다.
 */
function withSquadValue(old: Run, next: Run, byId: Map<string, Card>): Run {
  const oldSlots = old.formation ? FORMATION_SLOTS[old.formation] : BASEBALL_SLOTS;
  const newSlots = next.formation ? FORMATION_SLOTS[next.formation] : BASEBALL_SLOTS;
  const prevSquadValue = squadValue(old.squad, oldSlots, byId);
  const value = squadValue(next.squad, newSlots, byId);
  const bestSquad =
    value > next.bestSquad.value
      ? { squad: next.squad, value, ...(next.formation ? { formation: next.formation } : {}) }
      : next.bestSquad;
  return { ...next, prevSquadValue, bestSquad };
}

/**
 * best 후보에 새 카드를 더한다.
 *
 * 1. **같은 선수 id 는 가치 높은 쪽만 남긴다.** 같은 등급 안에서는 강화 수치가
 *    높을수록 가치도 커지므로(economy.ts 의 cardValue, MULT 는 단조 증가), 가치로
 *    골라도 결국 그 선수의 최고 강화 기록이 남는다 — 강화순 기준으로도 안전하다.
 * 2. **가치순 상위 BEST_KEEP 장과 강화순 상위 BEST_KEEP 장의 합집합**을 남긴다
 *    (최대 2*BEST_KEEP 장). 가치순으로만 다섯 장을 자르면 싸구려 등급을 잔뜩
 *    강화한 기록이 밀려난다 — 커먼 +12(가치 425)는 레전드 +0(가치 2,000)보다
 *    싸서 가치순 다섯 장 안에 못 들어오는데, 강화순으로는 1등일 수 있다.
 *
 * 강화순 정렬의 tiebreak 은 가치 내림차순이다.
 *
 * buy()에서 팩으로 갓 뽑은 +0 카드와 upgrade()에서 오른 카드가 같은 규칙을 타야
 * 한다. 두 곳에 각자 정렬·필터를 짜면 한쪽만 고치는 사고가 나서 함수 하나로 뽑았다.
 */
function mergeBest(best: Owned[], additions: Owned[], byId: Map<string, Card>): Owned[] {
  const worth = (o: Owned) => {
    const c = byId.get(o.id);
    return c ? cardValue(c.tier, o.plus) : 0;
  };
  const byPlayer = new Map<string, Owned>();
  for (const o of [...best, ...additions]) {
    const prev = byPlayer.get(o.id);
    if (!prev || worth(o) > worth(prev)) byPlayer.set(o.id, o);
  }
  const candidates = [...byPlayer.values()];
  const topByValue = [...candidates].sort((a, b) => worth(b) - worth(a)).slice(0, BEST_KEEP);
  const topByPlus = [...candidates]
    .sort((a, b) => b.plus - a.plus || worth(b) - worth(a))
    .slice(0, BEST_KEEP);

  const union = new Map<string, Owned>();
  for (const o of [...topByValue, ...topByPlus]) union.set(o.id, o);
  return [...union.values()].sort((a, b) => worth(b) - worth(a));
}

export default function Solo({
  pool,
  sport: sportKey,
  season,
}: {
  pool: Card[];
  sport: SportConfig["key"];
  season: string;
}) {
  const sport = SPORTS[sportKey];
  // 서버 렌더에서는 localStorage 를 못 읽으므로 새 런으로 시작했다가,
  // 브라우저에 붙은 뒤 저장된 런이 있으면 갈아끼운다. 그래야 하이드레이션이 안 어긋난다.
  const [run, setRun] = useState<Run>(() => newRun(season));
  const [ready, setReady] = useState(false);
  // 강화 오버레이가 지금 다루는 칸. null 이면 안 열려 있다.
  const [upgrading, setUpgrading] = useState<SlotRef | null>(null);
  // 개봉 연출이 지금 보여주는 팩. null 이면 안 열려 있다. 카드는 buy() 시점에 이미
  // vault에 커밋해두므로, 이 state는 순수하게 화면용이라 잃어도 상관없다.
  const [opening, setOpening] = useState<{ pack: Pack; cards: Card[] } | null>(null);
  // "여기까지 하고 결과 보기" 확인 모달. 되돌릴 수 없어서 한 번 멈춰 세운다.
  const [endConfirm, setEndConfirm] = useState(false);
  // 모바일 스쿼드 드로어가 펼쳐졌는지. PC에서는 CSS가 항상 펼친 상태로 그려 이 값을 무시한다.
  const [squadOpen, setSquadOpen] = useState(false);
  const endCancelRef = useRef<HTMLButtonElement>(null);
  const endDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(endDialogRef, endConfirm);

  // 마운트 직후 딱 한 번만 저장된 런으로 갈아끼운다. 커밋 이후(useEffect)에 해야
  // 하이드레이션 검사 시점과 안 겹친다. 렌더 중에 읽으면(지연 초기화든 렌더 중
  // setState든) 그 순간의 출력이 이미 저장값을 반영해버려 서버가 그린 마크업과 어긋난다.
  //
  // react-hooks/set-state-in-effect 가 이 패턴을 막지만 여기서는 끈다. 규칙이 제안하는
  // useSyncExternalStore 는 스냅샷이 매 렌더 같은 참조여야 하는데, JSON.parse 결과는
  // 매번 새 객체라 무한 렌더를 부른다. 한 번 읽고 마는 값에 캐시 장치까지 붙일 일은 아니다.
  useEffect(() => {
    const loaded = loadRun(season) ?? newRun(season);

    // 풀에 없는 선수는 보관함에서 걷어낸다. 라이브 시즌은 방출·은퇴로 선수가 사라질 수 있다.
    // 남겨두면 화면에는 안 그려지는데 vault.length 는 채워서, 팔 수도 강화할 수도 없는
    // 카드 한 장이 파산 판정을 영영 막아 런이 결과 화면에 못 간다.
    const ids = new Set(pool.map((c) => c.id));
    const vault = loaded.vault.filter((c) => ids.has(c.id));
    // 방출된 선수가 스쿼드에도 꽂혀 있었으면 마저 걷어낸다 - 안 그러면 방출된 선수가
    // 스쿼드 점수판에 유령처럼 계속 남는다.
    const squad = pruneSquad(loaded.squad, vault);
    const pruned =
      vault.length === loaded.vault.length && Object.keys(squad).length === Object.keys(loaded.squad).length
        ? loaded
        : { ...loaded, vault, squad };

    // settleOver 를 여기도 거친다. 정상 플레이에서는 저장 전에 항상 이미 거쳤을 값이지만,
    // 방금 걷어낸 뒤라면 그 자리에서 파산이 될 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(settleOver(pruned));
    setReady(true);
  }, [season, pool]);

  useEffect(() => {
    if (ready) saveRun(run);
  }, [run, ready]);

  // SellModal·UpgradeOverlay와 같은 패턴: 열리면 취소 쪽에 포커스, Escape로 닫힌다.
  useEffect(() => {
    if (!endConfirm) return;
    endCancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEndConfirm(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endConfirm]);

  const byId = new Map(pool.map((c) => [c.id, c]));
  const slots = toSlots(run.vault);

  function buy(pack: Pack) {
    if (run.credits < pack.price) return;
    const picked = drawPack(groupByTier(pool), pack.size, Math.random, pack.rates);
    // 카드를 먼저 vault에 커밋하고서야 개봉 연출을 띄운다. 그래야 연출 중에 뒤로 가거나
    // 새로고침해도 결제한 카드가 그대로 남는다. 연출은 이미 끝난 거래를 보여주는 것뿐이다.
    setRun((r) => {
      // 진짜 판정은 업데이터 안에서 한다. 위 가드는 렌더 시점 값이라 같은 배치에서 두 번
      // 불리면 뚫린다.
      if (r.credits < pack.price) return r;
      // 뽑은 카드도 best 후보에 넣는다. 강화를 한 번도 안 해도 결과 화면에 남아야
      // 한다 — 안 넣으면 upgrade()만 best 를 갱신해, 플래티넘에서 레전드를 뽑고
      // 강화 없이 끝낸 판은 도감이 빈 채로 남는다.
      const added = picked.map((c) => ({ id: c.id, plus: 0 }));
      return settleOver({
        ...r,
        credits: r.credits - pack.price,
        vault: [...r.vault, ...added],
        best: mergeBest(r.best, added, byId),
      });
    });
    setOpening({ pack, cards: picked });
  }

  /**
   * 고른 칸을 판다.
   *
   * **실제로 빠진 장수만 값을 친다.** 요청한 take 로 계산하면, 모달이 열려 있는 사이에
   * 보관함이 바뀌어 takeFrom 이 그만큼 못 빼도 판 값은 다 쳐줘서 돈이 생긴다.
   */
  function sell(picks: { ref: SlotRef; take: number }[]) {
    setRun((r) => {
      let vault = r.vault;
      let total = 0;
      for (const p of picks) {
        const before = vault.length;
        vault = takeFrom(vault, p.ref, p.take);
        const taken = before - vault.length;
        const card = byId.get(p.ref.id);
        if (card) total += cardValue(card.tier, p.ref.plus) * taken;
      }
      // 판 카드가 스쿼드에 꽂혀 있었고 그게 마지막 한 장이었으면 스쿼드에서도 뺀다.
      // 여러 장 중 일부만 팔렸으면(같은 id+강화 수치가 vault 에 남아 있으면) 안 건드린다.
      const squad = pruneSquad(r.squad, vault);
      // 스쿼드가 정리로 줄었어도 최고기록·이전 가치를 다시 잰다(withSquadValue 주석).
      return settleOver(withSquadValue(r, { ...r, vault, squad, credits: r.credits + total }, byId));
    });
  }

  // 강화 한 번의 결과를 반영한다. 성공하면 그 한 장만 칸에서 빠져나와 plus+1 새 칸이 되고,
  // 최고 기록 다섯 장도 값(등급 × 강화 배수) 내림차순으로 다시 갈아끼운다. 파괴는 vault 만
  // 줄고 best 는 그대로 남는다. "+7까지 갔었다"가 이 모드의 성취라 터져도 지우면 안 된다.
  function upgrade(ref: SlotRef, result: UpgradeResult, pay: number) {
    const card = byId.get(ref.id);
    if (!card) return;
    setRun((r) => {
      // 이 칸이 정말 남아 있는지, 돈이 정말 있는지를 커밋된 상태로 확인한다.
      //
      // applyUpgrade 는 없는 칸을 만나면 조용히 아무것도 안 한다. 그래서 여기서 안 막으면
      // 오버레이가 열려 있는 사이에 그 카드를 팔아버렸을 때, 강화 버튼을 누를 때마다
      // vault 는 그대로인 채 돈만 빠지고 best 에는 있지도 않은 기록이 쌓인다.
      // 하려던 것이 아니라 실제로 바꾼 것으로 정산해야 돈이 무에서 생기지 않는다.
      const owned = r.vault.some((c) => c.id === ref.id && c.plus === ref.plus);
      if (!owned || r.credits < pay) return r;

      const vault = applyUpgrade(r.vault, ref, result);
      // 같은 카드가 여러 번 오르면 마지막 단계만 남긴다(mergeBest 가 가치로 골라준다).
      // 같은 선수의 +3 과 +5 가 둘 다 도감에 뜨면 자리만 차지한다.
      const best =
        result === "success" ? mergeBest(r.best, [{ id: ref.id, plus: ref.plus + 1 }], byId) : r.best;
      // 스쿼드도 같이 정리한다. 성공은 같은 선수가 오른 카드로 바뀐 것뿐이라 슬롯을
      // 유지하고 값만 올리고(bumpPlus), 유지·파괴는 pruneSquad 가 vault 에서 실제로
      // 사라진 자리만 골라 비운다 - sell()과 같은 "마지막 한 장" 규칙이다.
      const squad = result === "success" ? bumpPlus(r.squad, ref) : pruneSquad(r.squad, vault);
      return settleOver(withSquadValue(r, { ...r, vault, credits: r.credits - pay, best, squad }, byId));
    });
    // 성공하면 오버레이가 다음 단계를 보게 ref 를 올린다. 파괴는 그대로 둬 오버레이가
    // 스스로 "사라졌다"를 표시하게 하고, 유지는 어차피 같은 ref 라 손댈 게 없다.
    if (result === "success") setUpgrading({ id: ref.id, plus: ref.plus + 1 });
  }

  // 스쿼드는 전시용이라 경제에 안 닿는다(squad.ts 주석) - 그래도 커밋된 상태를
  // 다시 확인하는 건 buy·sell·upgrade와 같은 이유다: 픽커가 계산해 넘긴 후보가
  // 그새 낡았을 수 있다(보관함에서 카드가 빠졌거나 다른 자리에 먼저 꽂혔거나).
  function placeInSquad(slotId: string, ref: SlotRef) {
    setRun((r) => {
      const owned = r.vault.some((c) => c.id === ref.id && c.plus === ref.plus);
      if (!owned || isDuplicate(r.squad, slotId, ref.id)) return r;
      return withSquadValue(r, { ...r, squad: { ...r.squad, [slotId]: ref } }, byId);
    });
  }

  function removeFromSquad(slotId: string) {
    setRun((r) => {
      if (!(slotId in r.squad)) return r;
      const squad = { ...r.squad };
      delete squad[slotId];
      return withSquadValue(r, { ...r, squad }, byId);
    });
  }

  // 포메이션을 바꾸면 슬롯 id 가 달라져 기존 배치가 안 맞을 수 있다. squad-panel.tsx가
  // 비우기 전에 확인을 이미 받았으므로 여기서는 그냥 비운다.
  function changeFormation(f: Formation) {
    // 통째로 비우지 않는다. 새 포메이션에도 있는 자리는 그대로 남긴다(carrySquad 주석 참고).
    setRun((r) =>
      r.formation === f
        ? r
        : withSquadValue(r, { ...r, formation: f, squad: carrySquad(r.squad, FORMATION_SLOTS[f], byId) }, byId),
    );
  }

  // 자발적 종료. 파산과 달리 보관함·보유액은 그대로 두고 over 만 켠다.
  function endNow() {
    setRun((r) => ({ ...r, over: true }));
    setEndConfirm(false);
  }

  // 다시하기: 저장된 런을 지우고 새 런으로 갈아끼운다. 열려 있던 오버레이도 같이 닫는다.
  function restart() {
    clearRun(season);
    setUpgrading(null);
    setOpening(null);
    setSquadOpen(false);
    setRun(newRun(season));
  }

  // 위에 뜬 게 없을 때만 결과로 넘어간다. 마지막 카드가 터지면서 파산하면 over 와
  // 강화 결과가 같은 배치에 들어와, 그냥 두면 "파괴됐어요"를 한 번도 못 보여주고
  // 화면이 결과로 튄다. 오버레이를 닫고 나서 결과를 보여준다.
  // 스쿼드 드로어는 "play" 화면에서만 보여준다 - 결과·개봉 연출까지 덮으면 맥락이 안 맞는다.
  const screen: "result" | "opening" | "play" = run.over && !upgrading ? "result" : opening ? "opening" : "play";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-6 lg:max-w-6xl">
      {/* PC는 좌측(헤더+상점+보관함) · 우측(스쿼드 판) 2열, 모바일은 오른쪽 열이
          책갈피 드로어로 접힌다(squad-drawer.tsx). */}
      <div className="flex flex-1 flex-col gap-8 lg:flex-row lg:items-start lg:gap-6">
        {/* 드로어가 펼쳐진 동안은 이쪽이 "뒤 화면" - inert로 클릭·Tab을 다 막는다. */}
        <div inert={squadOpen ? true : undefined} className="flex flex-1 flex-col gap-8">
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {/* 좁은 화면에서 "혼자 / 서"로 끊기지 않게 각 덩어리를 통째로 줄바꿈한다 */}
            <h1 className="flex flex-wrap items-baseline gap-x-1.5 text-lg font-black tracking-tight">
              <span className="whitespace-nowrap">{sport.title}</span>
              <span className="whitespace-nowrap text-zinc-500">혼자서</span>
            </h1>
            <div className="flex items-center gap-3">
              {/* 파산 없이도 끝낼 수 있는 유일한 길. 없으면 수십 번 클릭이 남은 판에 갇힌다. */}
              {!run.over && (
                <button
                  type="button"
                  onClick={() => setEndConfirm(true)}
                  className={`rounded-lg bg-white/8 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/15 ${FOCUS_RING}`}
                >
                  여기까지 하고 결과 보기
                </button>
              )}
              <span className="flex items-baseline gap-1.5 text-base font-black text-amber-300">
                <span className="text-xs font-medium text-zinc-500">보유</span>
                <Coin amount={run.credits} />
              </span>
            </div>
          </header>

          {screen === "result" ? (
            <Result run={run} byId={byId} sport={sport} onRestart={restart} />
          ) : screen === "opening" && opening ? (
            <Opening
              sport={sport}
              pack={opening.pack}
              cards={opening.cards}
              onDone={() => setOpening(null)}
            />
          ) : (
            <>
              <Shop credits={run.credits} sport={sport} onBuy={buy} />

              <VaultGrid
                slots={slots}
                byId={byId}
                sport={sport}
                onSell={sell}
                onUpgrade={setUpgrading}
                upgradeOpen={upgrading !== null}
              />

              {upgrading && byId.get(upgrading.id) && (
                <UpgradeOverlay
                  card={byId.get(upgrading.id)!}
                  sport={sport}
                  plus={upgrading.plus}
                  credits={run.credits}
                  onClose={() => setUpgrading(null)}
                  onUpgrade={(result, pay) => upgrade(upgrading, result, pay)}
                />
              )}
            </>
          )}
        </div>

        {/* ready 를 같이 걸어야 한다. 그렇지 않으면 하이드레이션으로 새 런(빈 스쿼드)이
            저장된 런으로 갈아끼워지는 순간 값이 훌쩍 뛰어 squad-panel 의 상승 이펙트가
            로드하자마자 헛돌린다 - ready 가 켜진 뒤에 첫 마운트하면 그 값을 기준선으로
            잡아서 문제가 안 생긴다. */}
        {screen === "play" && ready && (
          <SquadDrawer open={squadOpen} onOpenChange={setSquadOpen}>
            <SquadPanel
              squad={run.squad}
              formation={run.formation}
              vaultSlots={slots}
              byId={byId}
              prevValue={run.prevSquadValue}
              bestValue={run.bestSquad.value}
              onPlace={placeInSquad}
              onRemove={removeFromSquad}
              onFormationChange={changeFormation}
            />
          </SquadDrawer>
        )}
      </div>

      {endConfirm && (
        <div
          ref={endDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="판 종료 확인"
          onClick={() => setEndConfirm(false)}
          className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-zinc-950 px-6 py-5 ring-1 ring-white/10"
          >
            <div>
              <h4 className="text-base font-bold">여기까지 하고 결과를 보시겠어요?</h4>
              <p className="mt-1 text-sm text-zinc-400">
                되돌릴 수 없어요. 지금 판은 끝나고 최고 기록으로 결과가 남아요.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                ref={endCancelRef}
                type="button"
                onClick={() => setEndConfirm(false)}
                className={`rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-zinc-200 ring-1 ring-white/15 transition-colors hover:bg-white/20 ${FOCUS_RING}`}
              >
                계속할래요
              </button>
              <button
                type="button"
                onClick={endNow}
                className={`rounded-xl bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 ${FOCUS_RING}`}
              >
                여기까지
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
