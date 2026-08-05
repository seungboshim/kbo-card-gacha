// 보관함의 모양만 다룬다. 값이나 확률은 economy.ts 가 맡는다.
//
// 저장은 카드 한 장이 한 항목인 평평한 배열이다. 칸(같은 선수 + 같은 강화 수치)은
// 화면에서만 만든다. 배열로 두는 이유는 강화 때문이다. 세 장 중 한 장만 성공하면 그
// 한 장이 칸에서 빠져나와 새 칸이 되어야 하는데, 배열이면 그게 저절로 된다.

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
