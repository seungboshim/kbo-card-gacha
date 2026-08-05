import Link from "next/link";
import { SPORT, seasonsOf, type Season } from "./seasons";

/**
 * 시즌 고르기 목록. 여럿이서·혼자서 두 모드가 같이 쓴다.
 * 시즌이 하나뿐이어도 이 화면을 보여준다. PL 26/27 이 곧 열리고 KBO 2026 도 내년이면
 * 지난 시즌이 된다. 시즌이 하나인 상태는 지금 이 순간뿐이다.
 */
export function SeasonList({
  sport,
  mode,
  modeLabel,
}: {
  sport: Season["sport"];
  mode: "solo" | "multi";
  modeLabel: string;
}) {
  const seasons = seasonsOf(sport);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-8 px-4 py-10">
      <div>
        <Link
          href="/"
          className="rounded text-sm text-zinc-500 transition-colors outline-none hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-white/70"
        >
          ← 카드깡
        </Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight">
          {SPORT[sport].emblem} {SPORT[sport].name} · {modeLabel}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-400">시즌을 골라주세요</p>
      </div>

      <div className="flex flex-col gap-3">
        {seasons.map((s) => (
          <Link
            key={s.id}
            href={`/${sport}/${mode}/${s.id}`}
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
