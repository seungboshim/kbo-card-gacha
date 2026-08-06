import { notFound } from "next/navigation";
import Solo from "../../../_solo/solo";
import { loadPool } from "../../../_sports/pools";
import { SEASONS, SPORT, seasonKey, type Season } from "../../../_sports/seasons";

export const dynamicParams = false;

export function generateStaticParams() {
  return SEASONS.map((s) => ({ sport: s.sport, season: s.id }));
}

const find = (sport: string, season: string): Season | undefined =>
  SEASONS.find((s) => s.sport === sport && s.id === season);

export async function generateMetadata({ params }: { params: Promise<{ sport: string; season: string }> }) {
  const { sport, season } = await params;
  const s = find(sport, season);
  return { title: s ? `${SPORT[s.sport].name} 혼자서 ${s.label}` : "카드깡" };
}

export default async function Page({ params }: { params: Promise<{ sport: string; season: string }> }) {
  const { sport, season } = await params;
  const s = find(sport, season);
  if (!s) notFound();
  const pool = await loadPool(seasonKey(s));
  return <Solo pool={pool} sport={s.sport} season={seasonKey(s)} />;
}
