"use client";

import type { SportConfig } from "./deck";

// 카드팩 색. 종목 색을 따라간다(KBO 노랑 계열, PL 보라 계열). 무늬는 PackShell이 종목별로 가른다.
// grade가 없거나 "normal"이면 이 표를 그대로 쓴다 — 여럿이서 모드가 등급 개념이 없으니 항상 이 갈래다.
const PACK_THEME: Record<string, { base: string; band: string; sub: string; foot: string }> = {
  kbo: {
    base: "bg-[linear-gradient(165deg,#fde68a_0%,#fcd34d_42%,#f59e0b_100%)]",
    band: "bg-[#111827]",
    sub: "text-amber-300",
    foot: "text-yellow-950/75",
  },
  epl: {
    base: "bg-[linear-gradient(165deg,#ddd6fe_0%,#a78bfa_42%,#6d28d9_100%)]",
    band: "bg-[#1e1b4b]",
    sub: "text-violet-300",
    // KBO는 밝은 노랑 위라 어두운 글자가 맞지만, 여기는 아래로 갈수록 짙은 보라라 밝은 글자여야 읽힌다.
    foot: "text-violet-100/85",
  },
};

/**
 * 혼자서 모드 상점 팩 등급(good·platinum) 색. 종목과 무관하게 등급이 색을 정한다 —
 * 종목 무늬(야구공/축구공)는 PackShell 본문에서 그대로 그리고, 여기서는 색만 간섭한다.
 */
const GRADE_THEME: Record<"good" | "platinum", { base: string; band: string; sub: string; foot: string }> = {
  // 건메탈(회청색)에서 짙은 남색으로 떨어지는 그라디언트. 로열블루 밴드가 "밝은 포인트"다.
  good: {
    base: "bg-[linear-gradient(165deg,#6b7280_0%,#3f4655_38%,#161c2c_100%)]",
    band: "bg-[#1e3a8a]",
    sub: "text-cyan-300",
    // 바탕 맨 아래가 그라디언트 중 제일 짙은 남색이라, 위 PACK_THEME.epl과 같은 기준으로 밝은 글자.
    foot: "text-slate-200/85",
  },
  // card.tsx STYLE.LEGEND의 홀로그램 그라디언트·holo-drift를 그대로 재사용한다(어휘를 새로 안 만든다).
  // 흰색이 반이라 전체적으로 밝으므로, 배지가 밴드처럼 짙은 색이어야 "제일 비싼 팩"으로 읽힌다.
  platinum: {
    base: "bg-[repeating-linear-gradient(115deg,#6ee7b7_0px,#ffffff_38px,#d8b4fe_76px,#ffffff_114px,#7dd3fc_152px,#ffffff_190px,#6ee7b7_228px)] bg-[length:200%_200%] animate-[holo-drift_9s_ease-in-out_infinite]",
    band: "bg-[#0b0b0f]",
    sub: "text-cyan-200",
    // 파스텔·흰색만 순환해 어두운 색조가 없다 → 애니메이션 내내 어두운 글자로 둬도 항상 읽힌다.
    foot: "text-zinc-950/80",
  },
};

// 봉지 위·아래 핑킹가위 에지. 톱니는 잘고 촘촘하게.
const TEETH = 34; // 팩 전체 폭 기준 톱니 개수
const TOOTH_D = 1.1; // 톱니 깊이 (높이 %)
const TEAR_STEPS = 11; // 세로로 찢긴 절단면의 요철 개수
const TEAR_D = 3; // 절단면 요철 깊이 (폭 %)

/**
 * 위·아래가 핑킹가위로 잘린 봉지 모양 clip-path.
 * x0~x1 구간만 남기고, tornEdge를 주면 그 쪽 절단면을 세로 요철로 찢긴 것처럼 만든다.
 */
function packClip(x0 = 0, x1 = 100, tornEdge?: "left" | "right") {
  const w = x1 - x0;
  const n = Math.max(2, Math.round((TEETH * w) / 100));
  const step = w / n;
  const x = (i: number) => (x0 + i * step).toFixed(2);
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(`${x(i)}% ${i % 2 ? 0 : TOOTH_D}%`); // 위쪽 톱니: 왼→오
  if (tornEdge === "right")
    for (let i = 1; i < TEAR_STEPS; i++)
      pts.push(`${(x1 - (i % 2 ? TEAR_D : 0)).toFixed(2)}% ${((100 * i) / TEAR_STEPS).toFixed(1)}%`);
  for (let i = n; i >= 0; i--) pts.push(`${x(i)}% ${i % 2 ? 100 : 100 - TOOTH_D}%`); // 아래쪽 톱니: 오→왼
  if (tornEdge === "left")
    for (let i = TEAR_STEPS - 1; i >= 1; i--)
      pts.push(`${(x0 + (i % 2 ? TEAR_D : 0)).toFixed(2)}% ${((100 * i) / TEAR_STEPS).toFixed(1)}%`);
  return `polygon(${pts.join(",")})`;
}

const TEAR_X = 80; // 반이 아니라 오른쪽 끄트머리를 뜯는 느낌
const CLIP_WHOLE = packClip();
const CLIP_LEFT = packClip(0, TEAR_X, "right");
const CLIP_RIGHT = packClip(TEAR_X, 100, "left");

/**
 * 비닐 카드팩 껍데기. 여럿이서 모드의 고르기·개봉과 혼자서 모드의 상점·개봉이 같이 쓴다.
 * 겉모습이 같아야 "그 팩을 뜯는다"는 연결이 유지된다.
 * clip 으로 좌/우 조각만 남기면 뜯기 연출에서 두 쪽으로 쪼갤 수 있다.
 */
export function PackShell({
  sport,
  packSize,
  dim,
  clip,
  animateClass,
  grade,
  note,
}: {
  sport: SportConfig;
  packSize: number;
  dim?: boolean;
  clip?: "left" | "right";
  animateClass?: string;
  /** 혼자서 모드 상점 팩 등급. 없으면(여럿이서 모드) 종목 색 그대로 쓴다 — 선택 인자라
   *  game.tsx는 안 고쳐도 그대로 굴러간다. */
  grade?: "normal" | "good" | "platinum";
  /** 하단 표기 둘째 줄. 없으면 "등급 무작위". */
  note?: string;
}) {
  const clipPath = clip === "left" ? CLIP_LEFT : clip === "right" ? CLIP_RIGHT : CLIP_WHOLE;
  const t = grade === "good" || grade === "platinum" ? GRADE_THEME[grade] : PACK_THEME[sport.key];
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${t.base} ${dim ? "brightness-[.45]" : ""} ${animateClass ?? ""}`}
      style={{ clipPath }}
    >
      {sport.key === "epl" ? (
        /* 축구공: 가운데 오각형과 거기서 뻗은 다섯 개 선. 실제 축구공 무늬를 다 그리지 않아도
           이 조합이면 축구공으로 읽힌다. 팩보다 크게 잡아 무늬가 잘려 나가게 둔다. */
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="absolute top-[26%] left-1/2 w-[150%] -translate-x-1/2 -translate-y-1/2 overflow-visible"
        >
          <g fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2.4" strokeLinejoin="round">
            <circle cx="50" cy="50" r="47" />
            <polygon points="50,32 67.1,44.4 60.6,64.6 39.4,64.6 32.9,44.4" fill="rgba(255,255,255,.3)" />
            <path d="M50 32V2M67.1 44.4L95.7 35.2M60.6 64.6L78.2 88.8M39.4 64.6L21.8 88.8M32.9 44.4L4.3 35.2" />
          </g>
        </svg>
      ) : (
        /* 야구공 실밥: 큰 점선 원 테두리의 활 부분만 팩을 지나가게 둔다(좌우 각각, 서로 교차하지 않게) */
        <>
          <div className="absolute top-1/2 -left-[165%] aspect-square w-[190%] -translate-y-1/2 rounded-full border-[3px] border-dashed border-white/50" />
          <div className="absolute top-1/2 -right-[165%] aspect-square w-[190%] -translate-y-1/2 rounded-full border-[3px] border-dashed border-white/50" />
        </>
      )}

      {/* 위·아래 밀봉부: 살짝 짙은 띠 */}
      <div className="absolute inset-x-0 top-0 h-[7%] bg-black/10" />
      <div className="absolute inset-x-0 bottom-0 h-[7%] bg-black/10" />

      {/* 가운데 워드마크 밴드 */}
      <div className={`absolute inset-x-[-6%] top-[38%] -rotate-[4deg] py-1.5 text-center shadow-lg sm:py-2 ${t.band}`}>
        <div className="text-sm leading-none font-black tracking-tight text-white sm:text-xl">카드깡</div>
        <div className={`mt-0.5 text-[6px] leading-none font-bold tracking-[.2em] sm:text-[8px] ${t.sub}`}>
          {sport.packSub}
        </div>
      </div>

      {/* 하단 표기 */}
      <div
        className={`absolute inset-x-0 bottom-[11%] text-center text-[7px] leading-tight font-bold sm:text-[9px] ${t.foot}`}
      >
        선수 카드 {packSize}장
        <br />
        {note ?? "등급 무작위"}
      </div>

      {/* 비닐 광택 */}
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_34%,rgba(255,255,255,.55)_47%,transparent_58%)]" />
    </div>
  );
}
