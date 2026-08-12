import { notFound, redirect } from "next/navigation";
import { SPORT, SPORT_KEYS, defaultSeasonOf, type Season } from "../../_sports/seasons";

// 종목은 kbo/epl 둘뿐이라 시즌 조합처럼 유한하다. 전부 빌드 때 굽는다.
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_KEYS.map((sport) => ({ sport }));
}

export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const s = SPORT[sport as keyof typeof SPORT];
  return { title: s ? `${s.name} 여럿이서 · squad gacha` : "squad gacha" };
}

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (!(sport in SPORT)) notFound();
  const season = defaultSeasonOf(sport as Season["sport"]);
  if (!season) notFound();
  redirect(`/${sport}/multi/${season.id}`);
}
