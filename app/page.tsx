import Link from "next/link";
import { SPORT, SPORT_KEYS, hasLive } from "./_sports/seasons";

// 입구 카드 주색: 리그 색으로 두 카드를 한눈에 가른다.
// 리그 원색(KBO 남색 #0F2B5B, PL 퍼플 #3D195B)은 어두운 배경 위에서 alpha 를 올려도 안 보인다.
// 그래서 같은 색조의 밝은 쪽을 쓴다.
const LEAGUE_COLOR: Record<string, string> = { kbo: "#3B82F6", epl: "#A855F7" };

// ready:false 인 모드는 잠긴 카드로 그린다. 혼자서 모드는 다음 단계에서 열린다.
// 레이아웃을 지금 최종 모양으로 두면 그때 이 값만 뒤집으면 된다.
const MODES = [
  {
    key: "solo",
    title: "혼자서",
    desc: "주어진 돈으로 카드팩을 사고 카드깡을 한 뒤 선수를 강화해봐요",
    ready: false,
  },
  {
    key: "multi",
    title: "여럿이서",
    desc: "친구들과 함께 카드깡하고, 뽑은 카드로 대결해요",
    ready: true,
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-12 px-4 py-10">
      <h1 className="text-center text-2xl font-black tracking-tight sm:text-3xl">카드깡</h1>

      {MODES.map((mode) => (
        <section key={mode.key} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-bold">
              {mode.title}
              {!mode.ready && <span className="ml-2 text-xs font-medium text-zinc-500">곧 열려요</span>}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-400">{mode.desc}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SPORT_KEYS.map((sport) => {
              const color = LEAGUE_COLOR[sport];
              const inner = (
                <>
                  <span aria-hidden="true" className="text-5xl leading-none select-none sm:text-6xl">
                    {SPORT[sport].emblem}
                  </span>
                  <span className="text-base font-bold">{SPORT[sport].name}</span>
                  {hasLive(sport) && (
                    <span className="absolute top-3 right-3 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-400/40 ring-inset">
                      LIVE
                    </span>
                  )}
                </>
              );
              const shell =
                "relative flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border px-6 py-8";
              const style = {
                background: `radial-gradient(130% 100% at 50% -5%, ${color}80 0%, ${color}1f 55%, transparent 80%), rgba(255,255,255,0.03)`,
                borderColor: `${color}99`,
                boxShadow: `0 0 40px -10px ${color}80`,
              };

              return mode.ready ? (
                <Link
                  key={sport}
                  href={`/${sport}/${mode.key}`}
                  // ring(box-shadow 기반)은 카드 자체의 inline box-shadow 글로우에 덮여 안 보인다.
                  // 그래서 별도 속성인 outline 으로 포커스를 표시한다.
                  className={`${shell} transition-transform hover:scale-[1.02] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70`}
                  style={style}
                >
                  {inner}
                </Link>
              ) : (
                // div 에 aria-disabled 를 걸면 스크린리더가 아무것도 안 읽는다. 기본 role 이
                // generic 이라 상태를 실을 자리가 없기 때문이다. disabled 버튼은 role 도
                // 상태도 붙고 Tab 에서도 저절로 빠진다.
                <button
                  key={sport}
                  type="button"
                  disabled
                  aria-label={`${SPORT[sport].name} 혼자서 · 곧 열려요`}
                  className={`${shell} opacity-40`}
                  style={style}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
