import Link from "next/link";
import { notFound } from "next/navigation";
import { SPORT, SPORT_KEYS, seasonsOf } from "../../_sports/seasons";

// 종목은 kbo/epl 둘뿐이라 시즌 조합처럼 유한하다. 전부 빌드 때 굽는다.
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_KEYS.map((sport) => ({ sport }));
}

export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const s = SPORT[sport as keyof typeof SPORT];
  return { title: s ? `${s.name} 여럿이서 · 시즌 고르기` : "카드깡" };
}

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (!(sport in SPORT)) notFound();
  const key = sport as keyof typeof SPORT;
  const seasons = seasonsOf(key);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-8 px-4 py-10">
      <div>
        <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-300">
          ← 카드깡
        </Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight">
          {SPORT[key].emblem} {SPORT[key].name} · 여럿이서
        </h1>
        <p className="mt-1.5 text-sm text-zinc-400">시즌을 골라주세요</p>
      </div>

      <div className="flex flex-col gap-3">
        {seasons.map((s) => (
          <Link
            key={s.id}
            href={`/${sport}/multi/${s.id}`}
            className="rounded-2xl bg-white/5 px-5 py-4 ring-1 ring-white/10 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tabular-nums">{s.label}</span>
              {s.live && (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-400/40 ring-inset">
                  LIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {s.live
                ? "매일 기록이 갱신돼요. 어제보다 등급이 오른 선수는 카드에 표시가 붙어요."
                : "시즌이 끝나 등급이 고정된 카드예요."}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
