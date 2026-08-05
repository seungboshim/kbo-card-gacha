import { notFound } from "next/navigation";
import Game from "../../../_game/game";
import { loadPool } from "../../../_sports/pools";
import { SEASONS, SPORT, seasonKey, type Season } from "../../../_sports/seasons";

// 매니페스트에 없는 주소는 404. 시즌 조합이 유한하므로 전부 빌드 때 굽는다.
export const dynamicParams = false;

export function generateStaticParams() {
  return SEASONS.map((s) => ({ sport: s.sport, season: s.id }));
}

const find = (sport: string, season: string): Season | undefined =>
  SEASONS.find((s) => s.sport === sport && s.id === season);

export async function generateMetadata({ params }: { params: Promise<{ sport: string; season: string }> }) {
  const { sport, season } = await params;
  const s = find(sport, season);
  return { title: s ? `${SPORT[s.sport].name} 카드깡 ${s.label}` : "카드깡" };
}

export default async function Page({ params }: { params: Promise<{ sport: string; season: string }> }) {
  const { sport, season } = await params;
  const s = find(sport, season);
  // dynamicParams=false 라 여기까지 안 오지만, s 를 좁히려면 필요하다.
  if (!s) notFound();
  const pool = await loadPool(seasonKey(s));
  return <Game pool={pool} sport={s.sport} />;
}
