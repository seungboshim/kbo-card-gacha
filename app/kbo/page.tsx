import Game from "../_game/game";
import { loadPool } from "../_sports/pools";

// 탭 제목이 종목별로 갈리게 (레이아웃 기본값은 두 종목을 아우르는 이름이다)
export const metadata = { title: "KBO 카드깡 2026" };

export default async function Page() {
  const pool = await loadPool("kbo-2026");
  return <Game pool={pool} sport="kbo" />;
}
