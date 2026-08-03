// 결과 화면의 카드 대결. 순수 로직만 두고 연출은 game.tsx가 맡는다.
//
// 규칙
// - 카드가 남은 플레이어끼리 각자 스택 맨 앞 카드로 붙는다
// - 등급 점수가 가장 높은 카드만 살아남는다. 최고가 여러 장이면 그 판은 무승부고 그 카드들이 다 산다
// - 최고가 아닌 카드는 파괴돼 사라진다
// - 살아남은 카드는 자기 스택 맨 뒤로 밀려나 한 바퀴 뒤에 다시 나온다
// - 카드가 0장이 되면 탈락. 한 명만 남으면 우승
// - 전원 같은 등급이면 아무도 안 죽어 무한 반복이 되므로, 파괴 없는 판이 한 바퀴
//   이어지면 교착으로 보고 남은 사람들 공동 우승으로 끝낸다
//
// 덱 표현은 결과 화면 스택과 같다. 배열 마지막이 시각적으로 맨 앞(위)이다.

import { scoreOf, type Card } from "./deck.ts";

export type BattleSide = { player: number; card: Card };

export type RoundResult = {
  /** 이번 판에 나온 카드들 (카드가 남은 플레이어만) */
  entries: BattleSide[];
  topScore: number;
  /** 최고 등급 점수를 가진 카드들. 둘 이상이면 무승부 */
  winners: BattleSide[];
  /** 파괴되는 카드들 */
  losers: BattleSide[];
  draw: boolean;
};

export const frontOf = (deck: Card[]): Card | undefined => deck.at(-1);

/** 막배틀: 모두 마지막 한 장(또는 이미 0장)만 남은 판. 여기서는 무승부로 끝내지 않는다. */
export const isFinalRound = (decks: Card[][]): boolean => decks.every((d) => d.length <= 1);

/**
 * 이번 판의 승패를 가린다. 덱을 바꾸지 않는다.
 *
 * 평소엔 등급만 본다(등급 점수는 등급과 1:1이라 같은 비교다). 등급이 같으면 무승부다.
 * 막배틀에서만 활약도(rating)로 한 번 더 갈라 무승부로 끝나는 걸 막는다.
 * rating 은 KBO 는 WAR, EPL 은 역할군 내 순위 기반 합성값이라 종목·역할을 넘는 비교로는
 * 완전히 공평하지 않다. 그래도 막배틀 한정이라 영향이 작고, 이것 말고 쓸 값이 없다.
 */
export function resolveRound(decks: Card[][]): RoundResult | null {
  const entries = decks
    .map((deck, player) => ({ player, card: frontOf(deck) }))
    .filter((e): e is BattleSide => e.card !== undefined);
  if (entries.length === 0) return null;

  const topScore = Math.max(...entries.map((e) => scoreOf(e.card.tier)));
  let winners = entries.filter((e) => scoreOf(e.card.tier) === topScore);

  if (winners.length > 1 && isFinalRound(decks)) {
    const topRating = Math.max(...winners.map((w) => w.card.rating));
    winners = winners.filter((w) => w.card.rating === topRating);
  }

  const won = new Set(winners);
  const losers = entries.filter((e) => !won.has(e));
  return { entries, topScore, winners, losers, draw: winners.length > 1 };
}

/** 판정 결과를 덱에 반영한다. 패자 카드는 사라지고 승자 카드는 맨 뒤로 밀려난다. */
export function applyRound(decks: Card[][], result: RoundResult): Card[][] {
  const lost = new Set(result.losers.map((l) => l.player));
  const won = new Set(result.winners.map((w) => w.player));
  return decks.map((deck, p) => {
    if (lost.has(p)) return deck.slice(0, -1);
    if (won.has(p)) {
      const front = frontOf(deck);
      return front ? [front, ...deck.slice(0, -1)] : deck;
    }
    return deck;
  });
}

export const survivorsOf = (decks: Card[][]): number[] =>
  decks.map((deck, p) => ({ p, n: deck.length })).filter((x) => x.n > 0).map((x) => x.p);

/**
 * 교착 판정 기준. 살아남은 덱 중 가장 긴 것만큼 파괴 없이 지나가면 한 바퀴 돈 것으로 본다.
 * 최소 1로 둬서 덱이 다 비어도 0으로 나눠지지 않게 한다.
 */
export function stalemateLimit(decks: Card[][]): number {
  return Math.max(1, ...decks.map((d) => d.length));
}

export type BattleEnd = { finished: boolean; champions: number[]; stalemate: boolean };

/**
 * 끝났는지 판정한다. quietRounds는 파괴가 0이었던 판이 연속 몇 번인지.
 *
 * 교착(등급이 다 같아 아무도 안 죽는 상태)으로 끝나면 남은 사람 전원이 아니라
 * 카드를 가장 많이 남긴 사람이 우승한다. 동수면 그 사람들이 공동 우승이다.
 */
export function battleEnd(decks: Card[][], quietRounds: number, limit: number): BattleEnd {
  const alive = survivorsOf(decks);
  if (alive.length <= 1) return { finished: true, champions: alive, stalemate: false };
  if (quietRounds >= limit) {
    const most = Math.max(...alive.map((p) => decks[p].length));
    return { finished: true, champions: alive.filter((p) => decks[p].length === most), stalemate: true };
  }
  return { finished: false, champions: [], stalemate: false };
}
