// 보관함의 모양과 줄 세우는 순서를 다룬다. 값・등급을 "정하는" 일은 여전히
// economy.ts(가치)와 deck.ts(등급 순위) 몫이고, 여기서는 그 결과를 읽어 칸을
// 정렬만 한다 - 보관함의 모양과 순서는 한 덩어리라 따로 파일을 만들지 않았다.
//
// 저장은 카드 한 장이 한 항목인 평평한 배열이다. 칸(같은 선수 + 같은 강화 수치)은
// 화면에서만 만든다. 배열로 두는 이유는 강화 때문이다. 세 장 중 한 장만 성공하면 그
// 한 장이 칸에서 빠져나와 새 칸이 되어야 하는데, 배열이면 그게 저절로 된다.

import { tierRankOf, type Card } from "../_game/deck.ts";
import { cardValue } from "./economy.ts";

/** 보관함에 든 카드 한 장. 카드 데이터는 선수 id 로 풀에서 찾는다. */
export type Owned = { id: string; plus: number };

/** 화면에 보이는 칸. 같은 선수 + 같은 강화 수치를 묶은 것. */
export type Slot = { id: string; plus: number; count: number };

/** 어느 칸인지 가리키는 키. */
export type SlotRef = { id: string; plus: number };

const same = (a: SlotRef, b: SlotRef) => a.id === b.id && a.plus === b.plus;

/** 평평한 배열을 칸으로 묶는다. 처음 나온 순서를 지킨다. */
export function toSlots(vault: Owned[]): Slot[] {
  const slots: Slot[] = [];
  for (const c of vault) {
    const hit = slots.find((s) => same(s, c));
    if (hit) hit.count += 1;
    else slots.push({ id: c.id, plus: c.plus, count: 1 });
  }
  return slots;
}

/** 칸에서 n 장을 뺀다. 가진 것보다 많이 요청하면 있는 만큼만 뺀다. */
export function takeFrom(vault: Owned[], ref: SlotRef, n: number): Owned[] {
  let left = n;
  return vault.filter((c) => {
    if (left > 0 && same(c, ref)) {
      left -= 1;
      return false;
    }
    return true;
  });
}

export type UpgradeResult = "success" | "keep" | "destroy";

/**
 * 강화 결과를 보관함에 반영한다. 칸에 여러 장이 있어도 **한 장에만** 걸린다.
 * 없는 칸을 가리키면 아무 일도 안 한다.
 */
export function applyUpgrade(vault: Owned[], ref: SlotRef, result: UpgradeResult): Owned[] {
  if (result === "keep") return vault;
  const i = vault.findIndex((c) => same(c, ref));
  if (i === -1) return vault;
  const next = [...vault];
  if (result === "destroy") next.splice(i, 1);
  else next[i] = { id: ref.id, plus: ref.plus + 1 };
  return next;
}

/** 보관함 정렬 기준. "acquired" 가 기본값이고 toSlots 가 이미 지키는 순서 그대로다. */
export type SortBy = "acquired" | "tier" | "value" | "plus";

/**
 * 칸을 기준에 맞게 줄 세운 새 배열을 돌려준다. **원본은 손대지 않는다.**
 *
 * 나머지 세 기준은 Array.prototype.sort 하나로 푼다 - 최신 V8 은 안정 정렬이라
 * 비교값이 같은 칸들은 원래 순서(=획득순)가 그대로 유지된다. 그래서 마지막
 * tiebreak 을 따로 안 챙겨도 같은 값이 여러 개일 때 화면이 렌더마다 안 흔들린다.
 * 이 성질을 쓰려면 정렬 대상이 매번 같은 배열이어야 하므로, sort 를 원본에 걸지
 * 않고 복사본에 건다.
 *
 * byId 에 없는 id(방출된 선수 등)는 가치 0 · 등급 순위 0 으로 본다. VaultGrid 가
 * 그 칸을 렌더에서 건너뛰어 화면엔 안 보이지만, 값을 안 매기면 undefined 가
 * 비교식에 번져 정렬 전체가 NaN 으로 깨진다.
 */
export function sortSlots(slots: Slot[], by: SortBy, byId: Map<string, Card>): Slot[] {
  if (by === "acquired") return [...slots];

  const valueOf = (s: Slot) => {
    const card = byId.get(s.id);
    return card ? cardValue(card.tier, s.plus) : 0;
  };
  const rankOf = (s: Slot) => {
    const card = byId.get(s.id);
    return card ? tierRankOf(card.tier) : 0;
  };

  const copy = [...slots];
  if (by === "value") return copy.sort((a, b) => valueOf(b) - valueOf(a));
  if (by === "plus") return copy.sort((a, b) => b.plus - a.plus || valueOf(b) - valueOf(a));
  return copy.sort((a, b) => rankOf(b) - rankOf(a) || valueOf(b) - valueOf(a));
}
