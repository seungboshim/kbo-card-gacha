// 시즌 키 → 카드 풀. 서버 전용이다. 클라이언트 컴포넌트에서 import 하면 카드 데이터가
// 통째로 브라우저 번들에 들어간다.
//
// 경로에 변수를 넣어 동적으로 import 하면 번들러가 data/ 폴더 전체를 끌어오므로
// 시즌마다 한 줄씩 명시한다. 시즌을 추가할 때 seasons.ts 와 여기 두 곳을 고친다.

import type { Card } from "../_game/deck";
import { SEASONS, seasonKey } from "./seasons";

// 반환 타입을 unknown 으로 받는 이유: tsconfig 의 resolveJsonModule 이 켜져 있어서
// JSON 을 import 하면 파일 내용 그대로의 리터럴 타입이 잡힌다. tier 가 TierKey 가 아니라
// string 으로 추론되므로 Card[] 로 바로 캐스팅하면 타입이 안 겹친다고 거부당한다.
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  "kbo-2026": () => import("../../data/kbo-2026.json"),
  "epl-2526": () => import("../../data/epl-2526.json"),
};

export async function loadPool(key: string): Promise<Card[]> {
  const load = LOADERS[key];
  if (!load) throw new Error(`알 수 없는 시즌: ${key}`);
  return (await load()).default as Card[];
}

// 시즌을 seasons.ts 에 더하고 여기 로더를 빠뜨리는 실수를 빌드에서 잡는다.
// 두 파일을 같이 고쳐야 하는 구조라 한쪽만 고치기 쉽다.
for (const s of SEASONS) {
  if (!LOADERS[seasonKey(s)]) {
    throw new Error(`${seasonKey(s)} 의 JSON 로더가 pools.ts 에 없어요`);
  }
}
