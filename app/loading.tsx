// 종목 페이지는 서버에서 시즌 기록을 받아온 뒤에야 렌더를 시작한다(revalidate 3600).
// 캐시가 식은 요청 하나는 그동안 화면이 비어서 멈춘 것처럼 보이길래 대기 화면을 둔다.
// 루트에 두면 /kbo, /epl 처럼 자기 loading.tsx가 없는 하위 경로까지 같이 덮는다.
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="flex gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 w-14 animate-pulse rounded-md bg-gradient-to-br from-zinc-700 to-zinc-800 ring-1 ring-white/10"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p role="status" className="text-sm text-zinc-400">
        카드팩 준비 중…
      </p>
    </main>
  );
}
