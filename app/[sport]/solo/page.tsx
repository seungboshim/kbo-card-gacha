import { notFound } from "next/navigation";
import { SPORT, SPORT_KEYS } from "../../_sports/seasons";
import { SeasonList } from "../../_sports/season-list";

// 종목은 kbo/epl 둘뿐이라 시즌 조합처럼 유한하다. 전부 빌드 때 굽는다.
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_KEYS.map((sport) => ({ sport }));
}

export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const s = SPORT[sport as keyof typeof SPORT];
  return { title: s ? `${s.name} 혼자서 · 시즌 고르기` : "카드깡" };
}

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (!(sport in SPORT)) notFound();
  return <SeasonList sport={sport as keyof typeof SPORT} mode="solo" modeLabel="혼자서" />;
}
