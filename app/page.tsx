import { ModeGateway } from "./_home/mode-gateway";
import { SEASONS } from "./_sports/seasons";

export default function Home() {
  const leagues = SEASONS.map((season) => ({
    sport: season.sport,
    seasonId: season.id,
    seasonLabel: season.label,
    leagueLabel: season.sport === "kbo" ? "KBO" : "EPL",
    live: season.live,
  }));

  return <ModeGateway leagues={leagues} />;
}
