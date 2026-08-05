// 라우트가 준비되는 동안 보여줄 대기 화면. 루트에 둬서 자기 loading.tsx 가 없는 하위 경로를
// 다 덮는다.
//
// 지금은 안 보인다. 카드 풀을 저장소 JSON 에서 읽게 바뀌면서 /kbo, /epl 이 정적으로
// 미리 만들어지기 때문이다. 나중에 요청 시점에 그리는 경로가 생기면 그때 다시 쓰인다.
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
