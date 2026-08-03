import Link from "next/link";
import { KBO } from "./_sports/kbo";
import { EPL } from "./_sports/epl";

const SPORTS = [KBO, EPL];

// 입구 카드 주색: 리그 색으로 두 카드를 한눈에 가른다.
// 리그 원색(KBO 남색 #0F2B5B, PL 퍼플 #3D195B)은 어두운 배경 위에서 alpha 를 올려도 안 보인다.
// 그래서 같은 색조의 밝은 쪽을 쓴다.
const LEAGUE_COLOR: Record<string, string> = { kbo: "#3B82F6", epl: "#A855F7" };

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-10 px-4 py-10 text-center">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">카드깡</h1>
        <p className="mt-2 text-sm text-zinc-400">종목을 골라 카드팩을 열어보세요</p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        {SPORTS.map((s) => {
          const color = LEAGUE_COLOR[s.key];
          return (
            <Link
              key={s.key}
              href={`/${s.key}`}
              className="relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border px-6 py-10 transition hover:scale-[1.02] active:scale-[.98]"
              style={{
                background: `radial-gradient(130% 100% at 50% -5%, ${color}80 0%, ${color}1f 55%, transparent 80%), rgba(255,255,255,0.03)`,
                borderColor: `${color}99`,
                boxShadow: `0 0 40px -10px ${color}80`,
              }}
            >
              {/* 시즌 텍스트 자리: 엠블럼을 크게, 낮은 opacity로 뒤에 깔고 그 위에 시즌을 읽히게 둔다 */}
              <div className="relative flex h-20 w-full items-center justify-center sm:h-24">
                <span aria-hidden="true" className="pointer-events-none absolute text-7xl opacity-15 select-none sm:text-8xl">
                  {s.emblem}
                </span>
                <span className="relative text-3xl font-black tabular-nums sm:text-4xl">{s.seasonLabel}</span>
              </div>
              <span className="relative text-lg font-bold">{s.title}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
