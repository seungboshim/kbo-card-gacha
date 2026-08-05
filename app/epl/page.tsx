import Game from "../_game/game";
import { loadPool } from "../_sports/pools";

// 탭 제목이 종목별로 갈리게 (레이아웃 기본값은 두 종목을 아우르는 이름이다)
export const metadata = { title: "프리미어리그 카드깡 25/26" };

export default async function Page() {
  const pool = await loadPool("epl-2526");
  return <Game pool={pool} sport="epl" />;
}
