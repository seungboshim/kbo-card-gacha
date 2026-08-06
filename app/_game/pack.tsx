"use client";

import Image from "next/image";
import type { SportConfig } from "./deck";

/**
 * 등급이 주어지면 CSS 그라디언트 대신 그려 넣은 배경 그림을 쓴다.
 * `public/images/card-packs/<종목>-<등급>.png` 여섯 장. 912x1725 라 아래 aspect-[10/19] 와 맞는다.
 *
 * 그림을 깔 때는 종목 무늬(야구공 실밥 / 축구공)를 안 그린다. 그림 안에 이미 실밥과
 * 구장이 들어 있어서 겹치면 지저분해진다.
 *
 * 여섯 장 모두 가운데와 아래가 짙은 남색이라, 워드마크 밴드와 하단 표기는 밝은 글자로
 * 고정한다. 등급별로 색을 나누던 GRADE_THEME 의 글자색은 그림 위에서 안 맞아 안 쓴다.
 *
 * 밴드를 반투명으로 둔 이유: 꽉 찬 색으로 두면 그림 한가운데를 검은 판때기가 덮는다.
 * 여섯 장 다 가운데가 비어 있게 그려져서(워드마크 자리로 그린 것이다) 살짝만 깔아도
 * 글자가 읽힌다.
 */
const ART_TEXT = { band: "bg-black/45", sub: "text-white/75", foot: "text-white/90" };

/**
 * 그림을 깔 때 하단 표기가 앉는 높이. 그림 여섯 장 모두 아래 4분의 1쯤에 구장(다이아몬드,
 * 관중석)이 그려져 있어서, 기본값 11% 로 두면 글자가 그 위에 얹혀 안 읽힌다.
 */
const ART_FOOT_BOTTOM = "bottom-[27%]";

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
  /*
   * 위는 파스텔 스펙트럼, 아래로 갈수록 짙은 남색.
   *
   * 처음엔 레전드 카드의 무지개(흰색이 절반인 repeating-linear-gradient)를 그대로 가져왔는데,
   * 폭 100px짜리 팩에서는 반복 주기(228px)가 한 바퀴도 안 돌아 연한 라벤더 한 덩어리로만
   * 보였다. 짙은 남색인 고급팩보다 오히려 싸 보여서, 제일 비싼 팩이 제일 약한 꼴이 됐다.
   * 주기를 px가 아닌 %로 잡아 팩 폭에 맞게 한 바퀴가 다 들어가게 고쳤다.
   *
   * to_bottom 인 이유는 글자다. 기울이면 밴드(위에서 38%)와 하단 표기(아래에서 11%) 자리에
   * 어떤 색이 오는지가 팩 폭에 따라 달라진다. 세워두면 아래 끝이 항상 짙은 남색이라 하단
   * 표기를 밝은 글자로 고정할 수 있다.
   *
   * holo-drift 로 어른거리게도 해봤는데 걷어냈다. 그러려면 흰 사선 층을 하나 얹어 가로로
   * 흘려야 하는데, PackShell 맨 아래 "비닐 광택"이 이미 같은 사선이라 둘이 겹쳐 팩이
   * 통째로 하얗게 떴다. 반짝임은 그 광택 하나로 충분하다.
   */
  platinum: {
    base: "bg-[linear-gradient(to_bottom,#bbf7d0_0%,#7dd3fc_20%,#c4b5fd_38%,#f0abfc_52%,#818cf8_66%,#3730a3_84%,#1e1b4b_100%)]",
    band: "bg-[#0b0b0f]",
    sub: "text-fuchsia-300",
    // 하단 표기가 앉는 자리(아래에서 11%)는 그라디언트 끝의 짙은 남색이라 밝은 글자가 맞다.
    foot: "text-white/95",
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
  const css = grade === "good" || grade === "platinum" ? GRADE_THEME[grade] : PACK_THEME[sport.key];
  const t = grade ? { ...css, ...ART_TEXT } : css;
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${grade ? "bg-[#0b1020]" : css.base} ${dim ? "brightness-[.45]" : ""} ${animateClass ?? ""}`}
      style={{ clipPath }}
    >
      {/* 그림이 뜨기 전에는 밑색(#0b1020)이 보인다. 그림 여섯 장이 다 짙은 남색 바탕이라
          같은 색으로 맞춰두면 로딩 중에도 팩 모양이 안 깨진다. */}
      {grade && (
        <Image
          src={`/images/card-packs/${sport.key}-${grade}.png`}
          alt=""
          fill
          sizes="(max-width: 640px) 33vw, 140px"
          className="object-cover"
        />
      )}

      {grade ? null : sport.key === "epl" ? (
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
        className={`absolute inset-x-0 text-center text-[7px] leading-tight font-bold sm:text-[9px] ${grade ? ART_FOOT_BOTTOM : "bottom-[11%]"} ${t.foot}`}
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
