import Game from "../_game/game";
import { type Card } from "../_game/deck";
import { getEplPool } from "../_sports/epl";

export const revalidate = 3600;
// 탭 제목이 종목별로 갈리게 (레이아웃 기본값은 두 종목을 아우르는 이름이다)
export const metadata = { title: "프리미어리그 카드깡 25/26" };

export default async function Page() {
  let pool: Card[] = [];
  let error = "";
  try {
    pool = await getEplPool();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold">기록을 못 가져왔어요</h1>
        <p className="mt-2 text-sm text-zinc-400">{error}</p>
        <p className="mt-1 text-xs text-zinc-600">잠시 뒤에 새로고침해보세요.</p>
      </main>
    );
  }

  return <Game pool={pool} sport="epl" />;
}
