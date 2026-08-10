// 스쿼드(포메이션·타순) 규칙. 순수 함수만 둔다 - React 는 안 쓴다.
//
// 축구는 포메이션 다섯 개마다 슬롯 11개, 야구는 포메이션 없이 고정 19칸이다. 카드
// 한 장이 슬롯 하나에 들어갈 수 있는지는 slot.group 값만 보면 축구/야구가 자동으로
// 갈린다(GK·DF·MF·FW 는 축구 전용, C·IF·OF·DH·SP·RP·CL 은 야구 전용) - 그래서
// canPlace·squadValue 를 종목별로 나누지 않고 함수 하나씩으로 뒀다.

import { cardValue } from "./economy.ts";
import { type Owned, type SlotRef } from "./vault.ts";
import { type Card } from "../_game/deck.ts";

export type SlotGroup = "GK" | "DF" | "MF" | "FW" | "C" | "IF" | "OF" | "DH" | "SP" | "RP" | "CL";

export type Slot = {
  /** 스쿼드 저장(Squad)의 키. "GK", "DF1", "OF2", "SP3" 처럼 짓는다. */
  id: string;
  /** 배치 가능 판정에 쓰는 큰 묶음. */
  group: SlotGroup;
  /** 화면에 적을 짧은 말. */
  label: string;
  /** 필드 위 가로 위치, 0~100. */
  x: number;
  /** 필드 위 세로 위치, 0~100. */
  y: number;
  /**
   * 이 슬롯의 "주 포지션"에 정확히 맞는 role(축구·투수) 또는 pos(타자) 값.
   * 없으면(undefined) 이 슬롯엔 세부 일치라는 개념이 없다는 뜻이라(지명타자·마무리처럼
   * "아무나" 자리) 가치 배수가 절대 안 붙는다.
   */
  exact?: string;
};

const slot = (id: string, group: SlotGroup, label: string, x: number, y: number, exact?: string): Slot =>
  exact === undefined ? { id, group, label, x, y } : { id, group, label, x, y, exact };

export type Formation = "4-3-3" | "4-4-2" | "4-2-3-1" | "3-4-3" | "3-5-2";

export const FORMATIONS: readonly Formation[] = ["4-3-3", "4-4-2", "4-2-3-1", "3-4-3", "3-5-2"];

// 좌표는 눈대중이다: y 는 위(상대 골문 쪽, 공격수)가 작고 아래(우리 골문, 골키퍼)가
// 크다. 같은 줄은 x 를 고르게 벌린다. MF 슬롯을 CDM/CM 대 CAM 으로 나눈 건 DF(센터백·
// 풀백)·FW(스트라이커·윙어)처럼 exact 로 "정 포지션" 보너스를 받을 수 있게 하려는
// 것이다 - 안 나누면 미드필더는 어느 자리에 서도 절대 보너스를 못 받아 DF·FW 와
// 형평이 안 맞는다.
export const FORMATION_SLOTS: Record<Formation, readonly Slot[]> = {
  "4-3-3": [
    slot("GK", "GK", "골키퍼", 50, 95, "골키퍼"),
    slot("LB", "DF", "풀백", 12, 75, "풀백"),
    slot("CB1", "DF", "센터백", 37, 78, "센터백"),
    slot("CB2", "DF", "센터백", 63, 78, "센터백"),
    slot("RB", "DF", "풀백", 88, 75, "풀백"),
    slot("CDM", "MF", "미드필더", 50, 62, "미드필더"),
    slot("CML", "MF", "미드필더", 28, 48, "미드필더"),
    slot("CMR", "MF", "미드필더", 72, 48, "미드필더"),
    slot("LW", "FW", "윙어", 18, 15, "윙어"),
    slot("ST", "FW", "스트라이커", 50, 10, "스트라이커"),
    slot("RW", "FW", "윙어", 82, 15, "윙어"),
  ],
  "4-4-2": [
    slot("GK", "GK", "골키퍼", 50, 95, "골키퍼"),
    slot("LB", "DF", "풀백", 12, 75, "풀백"),
    slot("CB1", "DF", "센터백", 37, 78, "센터백"),
    slot("CB2", "DF", "센터백", 63, 78, "센터백"),
    slot("RB", "DF", "풀백", 88, 75, "풀백"),
    slot("LM", "MF", "미드필더", 10, 50, "미드필더"),
    slot("CM1", "MF", "미드필더", 37, 54, "미드필더"),
    slot("CM2", "MF", "미드필더", 63, 54, "미드필더"),
    slot("RM", "MF", "미드필더", 90, 50, "미드필더"),
    slot("ST1", "FW", "스트라이커", 35, 12, "스트라이커"),
    slot("ST2", "FW", "스트라이커", 65, 12, "스트라이커"),
  ],
  "4-2-3-1": [
    slot("GK", "GK", "골키퍼", 50, 95, "골키퍼"),
    slot("LB", "DF", "풀백", 12, 78, "풀백"),
    slot("CB1", "DF", "센터백", 37, 80, "센터백"),
    slot("CB2", "DF", "센터백", 63, 80, "센터백"),
    slot("RB", "DF", "풀백", 88, 78, "풀백"),
    slot("CDM1", "MF", "미드필더", 38, 62, "미드필더"),
    slot("CDM2", "MF", "미드필더", 62, 62, "미드필더"),
    slot("LAM", "MF", "공격형MF", 20, 40, "공격형MF"),
    slot("CAM", "MF", "공격형MF", 50, 36, "공격형MF"),
    slot("RAM", "MF", "공격형MF", 80, 40, "공격형MF"),
    slot("ST", "FW", "스트라이커", 50, 12, "스트라이커"),
  ],
  "3-4-3": [
    slot("GK", "GK", "골키퍼", 50, 95, "골키퍼"),
    slot("CBL", "DF", "센터백", 30, 80, "센터백"),
    slot("CBC", "DF", "센터백", 50, 83, "센터백"),
    slot("CBR", "DF", "센터백", 70, 80, "센터백"),
    slot("LM", "MF", "미드필더", 10, 50, "미드필더"),
    slot("CM1", "MF", "미드필더", 37, 54, "미드필더"),
    slot("CM2", "MF", "미드필더", 63, 54, "미드필더"),
    slot("RM", "MF", "미드필더", 90, 50, "미드필더"),
    slot("LW", "FW", "윙어", 18, 15, "윙어"),
    slot("ST", "FW", "스트라이커", 50, 10, "스트라이커"),
    slot("RW", "FW", "윙어", 82, 15, "윙어"),
  ],
  "3-5-2": [
    slot("GK", "GK", "골키퍼", 50, 95, "골키퍼"),
    slot("CBL", "DF", "센터백", 30, 80, "센터백"),
    slot("CBC", "DF", "센터백", 50, 83, "센터백"),
    slot("CBR", "DF", "센터백", 70, 80, "센터백"),
    slot("LM", "MF", "미드필더", 8, 52, "미드필더"),
    slot("CDM1", "MF", "미드필더", 29, 58, "미드필더"),
    slot("CM", "MF", "미드필더", 50, 50, "미드필더"),
    slot("CDM2", "MF", "미드필더", 71, 58, "미드필더"),
    slot("RM", "MF", "미드필더", 92, 52, "미드필더"),
    slot("ST1", "FW", "스트라이커", 35, 12, "스트라이커"),
    slot("ST2", "FW", "스트라이커", 65, 12, "스트라이커"),
  ],
};

// 야구는 포메이션이 없는 고정 19칸이다. 위에서부터 외야수 → 내야수 → 포수 순이고,
// 지명타자는 수비를 안 서니 포수 옆 자리에 얹는다. 투수진은 야구장 그림 밖 아래쪽에
// 줄지어 놓일 걸 감안해 y 를 80 이상으로 크게 잡는다.
//
// KBO 데이터의 pos 는 내야수·외야수·포수까지만 오고 유격수/2루수 같은 세부 포지션이
// 없다(kbo.ts 주석 참고). 그래서 내야수 4칸·외야수 3칸 모두 exact 가 똑같다 -
// 세부가 없으니 아무 내야수나 아무 내야 슬롯에 서면 다 "정 포지션"이다.
export const BASEBALL_SLOTS: readonly Slot[] = [
  slot("OF1", "OF", "외야수", 20, 12, "외야수"),
  slot("OF2", "OF", "외야수", 50, 8, "외야수"),
  slot("OF3", "OF", "외야수", 80, 12, "외야수"),
  slot("IF1", "IF", "내야수", 25, 42, "내야수"),
  slot("IF2", "IF", "내야수", 42, 38, "내야수"),
  slot("IF3", "IF", "내야수", 58, 38, "내야수"),
  slot("IF4", "IF", "내야수", 75, 42, "내야수"),
  slot("C", "C", "포수", 50, 58, "포수"),
  slot("DH", "DH", "지명타자", 88, 58), // exact 없음: 타자면 아무나
  slot("SP1", "SP", "선발", 10, 80, "선발"),
  slot("SP2", "SP", "선발", 28, 80, "선발"),
  slot("SP3", "SP", "선발", 50, 80, "선발"),
  slot("SP4", "SP", "선발", 72, 80, "선발"),
  slot("SP5", "SP", "선발", 90, 80, "선발"),
  slot("RP1", "RP", "중계", 20, 90, "불펜"),
  slot("RP2", "RP", "중계", 40, 90, "불펜"),
  slot("RP3", "RP", "중계", 60, 90, "불펜"),
  slot("RP4", "RP", "중계", 80, 90, "불펜"),
  slot("CL", "CL", "마무리", 50, 98), // exact 없음: 불펜이면 아무나
];

const FOOTBALL_GROUPS = new Set<SlotGroup>(["GK", "DF", "MF", "FW"]);

/** 축구 role → 슬롯 대분류. */
const FOOTBALL_ROLE_GROUP: Record<string, SlotGroup> = {
  골키퍼: "GK",
  센터백: "DF",
  풀백: "DF",
  미드필더: "MF",
  공격형MF: "MF",
  윙어: "FW",
  스트라이커: "FW",
};

/**
 * 카드 한 장이 슬롯 하나에 들어갈 수 있는지.
 *
 * 타자가 서는 자리 / 투수가 서는 자리. 야구는 이 둘로만 가른다(아래 canPlace 주석).
 * 포수·내야수·외야수를 슬롯 대분류로 옮기던 표는 걷어냈다 - 이제 그 구분은 배치 제한이
 * 아니라 보너스(matchesExact)에서만 쓰이고, 거기서는 slot.exact 와 card.pos 를 바로 댄다.
 */
const BAT_GROUPS = new Set<SlotGroup>(["C", "IF", "OF", "DH"]);

export function canPlace(card: Card, slot: Slot): boolean {
  if (FOOTBALL_GROUPS.has(slot.group)) return FOOTBALL_ROLE_GROUP[card.role] === slot.group;

  /*
   * 야구는 타자 자리엔 아무 타자나, 투수 자리엔 아무 투수나 넣을 수 있다.
   *
   * 처음엔 포수/내야수/외야수까지 맞춰야 들어가게 막았는데, 그러면 주 포지션 보너스가
   * 아무 일도 안 한다. 외야수는 외야 자리에만 들어갈 수 있으니 들어가는 순간 무조건
   * 보너스라서다(실제로 19칸 중 17칸에 보너스가 붙었고, 안 붙는 건 아무나 받는 지명타자와
   * 마무리 둘뿐이었다).
   *
   * 네이버가 주는 포지션이 외야수·내야수·포수까지뿐이라 더 잘게 나눌 수도 없다(수비 기록
   * 엔드포인트도 없다). 그래서 제한을 풀고 보너스가 구분하게 뒤집었다. 축구에서 풀백을
   * 센터백 자리에 세울 수 있되 보너스를 못 받는 것과 같은 구조다. 카드가 몇 장 없는
   * 초반에도 일단 자리를 채울 수 있다는 이점도 같이 온다.
   */
  const isPitcher = card.role === "선발" || card.role === "불펜";
  return isPitcher ? !BAT_GROUPS.has(slot.group) : BAT_GROUPS.has(slot.group);
}

/** 슬롯이 기대하는 "정 포지션"과 카드가 정확히 맞는지. exact 가 없으면 항상 false. */
export function matchesExact(card: Card, slot: Slot): boolean {
  if (!slot.exact) return false;
  if (FOOTBALL_GROUPS.has(slot.group)) return card.role === slot.exact;
  if (card.role === "타자") return card.pos === slot.exact;
  return card.role === slot.exact; // 투수: exact 는 "선발"|"불펜"
}

/**
 * 주 포지션 일치 보너스. 첫 값 1.2로 잡는다.
 *
 * 근거: 등급 간 가치 차이가 기하평균 2.86배(economy.ts 의 BASE_VALUE)라, 1.2배로는
 * 등급 하나도 못 뒤집는다 - "정 자리에 세우는" 선택이 등급 자체를 무시할 만큼 세지면
 * 안 된다. 대신 같은 등급 안에서 강화 몇 단계 차이는 뒤집을 수 있어야 배치가 의미
 * 있다(강화 초반 구간 배수가 1.09~1.14라 몇 단계 분을 상쇄하는 정도).
 *
 * 조율 기준: 실제로 스쿼드를 짜보고 "포지션 무시하고 아무 데나 꽂아도 차이가 없다"
 * 싶으면 올리고, "등급 낮은 카드가 자리만 맞아서 높은 카드를 이긴다" 싶으면 내린다.
 */
export const POSITION_BOOST = 1.2;

/** 슬롯 id → 꽂힌 카드. 빈 슬롯은 키가 아예 없다. */
export type Squad = Record<string, Owned>;

/**
 * 스쿼드 가치 = 꽂힌 카드들의 cardValue 합, 정 포지션이면 슬롯 하나당 1.2배.
 * 모르는 슬롯 id 나 풀에서 빠진 선수(byId 에 없음)는 0으로 친다. 반올림은 합산이
 * 끝난 마지막에 한 번만 한다.
 */
export function squadValue(squad: Squad, slots: readonly Slot[], byId: Map<string, Card>): number {
  const slotById = new Map(slots.map((s) => [s.id, s]));
  let total = 0;
  for (const [slotId, owned] of Object.entries(squad)) {
    const slotDef = slotById.get(slotId);
    const card = byId.get(owned.id);
    if (!slotDef || !card) continue;
    const base = cardValue(card.tier, owned.plus);
    total += matchesExact(card, slotDef) ? base * POSITION_BOOST : base;
  }
  return Math.round(total);
}

/** cardId 가 slotId 가 아닌 다른 자리에 이미 꽂혀 있는지. 같은 선수를 두 자리에 못 넣는 규칙의 판정. */
export function isDuplicate(squad: Squad, slotId: string, cardId: string): boolean {
  return Object.entries(squad).some(([id, owned]) => id !== slotId && owned.id === cardId);
}

/**
 * vault 에 더 이상 없는 카드를 스쿼드에서 걷어낸다(id+강화 수치가 정확히 일치하는
 * 사본이 하나도 안 남았을 때만). 판매·강화 파괴로 카드가 실제로 사라졌을 때, 그리고
 * 라이브 시즌에서 선수가 풀에서 방출됐을 때 부르면 된다 - 같은 선수의 다른 강화
 * 수치 사본이 남아 있으면 그 슬롯은 안 건드린다.
 */
export function pruneSquad(squad: Squad, vault: Owned[]): Squad {
  const next: Squad = {};
  for (const [slotId, owned] of Object.entries(squad)) {
    if (vault.some((c) => c.id === owned.id && c.plus === owned.plus)) next[slotId] = owned;
  }
  return next;
}

/**
 * 포메이션을 바꿀 때 새 포메이션에도 있는 자리만 남긴다.
 *
 * 처음엔 통째로 비웠는데 그럴 이유가 없었다. 슬롯 id 를 실제로 대보니 포메이션끼리
 * 꽤 겹친다 - 4백끼리는 GK·LB·CB1·CB2·RB 다섯 칸이 그대로고, 3백끼리도 GK·CBL·
 * CBC·CBR 이 남는다. 4-3-3 에서 4-4-2 로 갈 때 수비를 통째로 다시 짜라는 건 실제
 * 감독이 하는 일과 다르다. 미드필더·공격진만 흩어지는 게 맞다.
 *
 * 남길 때도 canPlace 를 다시 본다. 같은 id 가 살아남아도 그 자리가 기대하는 역할이
 * 포메이션마다 다를 수 있어서다.
 *
 * 다 비우기를 그만두면서 "되돌릴 수 없다"는 확인 대화상자도 같이 없앴다. 잃는 게
 * 없으면 물어볼 것도 없다.
 */
export function carrySquad(squad: Squad, toSlots: readonly Slot[], byId: Map<string, Card>): Squad {
  const slotById = new Map(toSlots.map((s) => [s.id, s]));
  const next: Squad = {};
  for (const [slotId, owned] of Object.entries(squad)) {
    const slotDef = slotById.get(slotId);
    const card = byId.get(owned.id);
    if (slotDef && card && canPlace(card, slotDef)) next[slotId] = owned;
  }
  return next;
}

/**
 * 강화 성공으로 카드가 plus+1 로 바뀌었을 때 스쿼드 슬롯도 새 plus 로 맞춘다. 같은
 * 선수이고 강화는 그 선수가 좋아진 것이지 사라진 게 아니므로 슬롯은 유지한다(파괴는
 * pruneSquad 로 비운다). ref 와 안 맞는 슬롯은 그대로 둔다.
 */
export function bumpPlus(squad: Squad, ref: SlotRef): Squad {
  const next: Squad = {};
  for (const [slotId, owned] of Object.entries(squad)) {
    next[slotId] = owned.id === ref.id && owned.plus === ref.plus ? { id: ref.id, plus: ref.plus + 1 } : owned;
  }
  return next;
}
