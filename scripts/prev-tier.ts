// 스냅샷을 새로 구울 때 어제 등급과 비교해 변동을 기록한다.
// 실행부(snapshot.ts)와 갈라둬서 테스트가 네트워크와 파일시스템을 안 타게 한다.

import type { Card } from "../app/_game/deck.ts";

/**
 * 등급이 바뀐 카드에만 prevTier 를 박아서 돌려준다.
 *
 * 비교 기준은 이전 스냅샷의 tier 이지 prevTier 가 아니다. 그래야 어제 내려간 카드가
 * 오늘 그대로일 때 표시가 떨어진다.
 */
export function withPrevTier(fresh: Card[], previous: Card[]): Card[] {
  const before = new Map(previous.map((c) => [c.id, c.tier]));
  return fresh.map((c) => {
    const was = before.get(c.id);
    return was && was !== c.tier ? { ...c, prevTier: was } : c;
  });
}
