import Link from "next/link";
import { KBO } from "./_sports/kbo";
import { EPL } from "./_sports/epl";

// 종목별 짧은 표시 이름. SportConfig.title은 "KBO 카드팩 개봉전"처럼 문장형이라 여기 입구에선 안 쓴다.
const NAME: Record<string, string> = { kbo: "KBO", epl: "프리미어리그" };

const SPORTS = [KBO, EPL];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-10 px-4 py-10 text-center">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">카드깡</h1>
        <p className="mt-2 text-sm text-zinc-400">종목을 골라 카드팩을 열어보세요</p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        {SPORTS.map((s) => (
          <Link
            key={s.key}
            href={`/${s.key}`}
            className="flex flex-col items-center gap-3 rounded-2xl bg-white/5 px-6 py-10 ring-1 ring-white/10 transition hover:scale-[1.02] hover:bg-white/10 active:scale-[.98]"
          >
            <span className="text-5xl">{s.emblem}</span>
            <span className="text-lg font-bold">{NAME[s.key]}</span>
            <span className="text-sm text-zinc-500 tabular-nums">{s.seasonLabel}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
