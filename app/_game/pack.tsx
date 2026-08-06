"use client";

import Image from "next/image";
import type { SportConfig } from "./deck";

/**
 * 팩 등급. 여럿이서 모드는 등급 개념이 없어 늘 "normal" 이다.
 * 그림 파일 이름의 뒷부분이기도 하다.
 */
export type PackGrade = "normal" | "good" | "platinum";

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
 * 팩을 배경에서 떼어내는 그림자. 두 겹이다.
 *
 * 검은 그림자만으로는 안 된다. 이 앱은 배경이 거의 검고 팩 그림도 짙은 남색이라,
 * 검정 위에 검정을 얹어봤자 아무것도 안 보인다. 그래서 **옅은 빛으로 테두리를 살리고**
 * (첫째 겹) 그 아래에 어두운 그림자를 깔아 바닥에 놓인 느낌만 준다(둘째 겹).
 *
 * box-shadow 가 아니라 filter: drop-shadow 인 이유: 팩 모양은 clip-path 로 잘라내는데
 * box-shadow 는 잘리기 전 네모를 따라가 팩 바깥에 직사각형 그림자가 생긴다.
 * drop-shadow 는 알파 채널을 따라가므로 톱니까지 그대로 따라온다.
 *
 * 감싸는 div 에 거는 이유: filter 는 clip-path 보다 **먼저** 적용된다. 같은 엘리먼트에
 * 둘 다 걸면 그림자가 생겼다가 clip 에 잘려 사라진다.
 */
const PACK_SHADOW =
  "[filter:drop-shadow(0_0_7px_rgba(186,204,232,.30))_drop-shadow(0_7px_12px_rgba(0,0,0,.8))]";

/**
 * 하단 표기가 앉는 높이. 그림 여섯 장 모두 아래 4분의 1쯤에 구장(다이아몬드, 관중석)이
 * 그려져 있어서, 더 내리면 글자가 그 위에 얹혀 안 읽힌다.
 */
const FOOT_BOTTOM = "bottom-[27%]";

/**
 * 비닐 카드팩 껍데기. 여럿이서 모드의 고르기·개봉과 혼자서 모드의 상점·개봉이 같이 쓴다.
 * 겉모습이 같아야 "그 팩을 뜯는다"는 연결이 유지된다.
 * clip 으로 좌/우 조각만 남기면 뜯기 연출에서 두 쪽으로 쪼갤 수 있다.
 *
 * 바탕은 그려 넣은 그림이다(`public/images/card-packs/<종목>-<등급>.png`, 912x1725).
 * 예전에는 종목 색 그라디언트 위에 야구공 실밥·축구공을 CSS 로 그렸는데, 그림에 이미
 * 실밥과 구장이 들어 있어 겹치면 지저분해서 걷어냈다.
 *
 * 글자는 최소한만 남긴다. 가운데에 시즌 표기 하나, 아래에 장수와 등급 안내 한 줄.
 * 그림이 이미 말이 많아서 "카드깡" 워드마크까지 얹으면 시끄럽다.
 */
export function PackShell({
  sport,
  packSize,
  dim,
  clip,
  animateClass,
  grade = "normal",
  note,
}: {
  sport: SportConfig;
  packSize: number;
  dim?: boolean;
  clip?: "left" | "right";
  animateClass?: string;
  grade?: PackGrade;
  /** 하단 표기 둘째 줄. 없으면 "등급 무작위". */
  note?: string;
}) {
  const clipPath = clip === "left" ? CLIP_LEFT : clip === "right" ? CLIP_RIGHT : CLIP_WHOLE;
  return (
    <div className={`absolute inset-0 ${PACK_SHADOW}`}>
      <div
        // 그림이 뜨기 전에는 밑색이 보인다. 여섯 장 다 짙은 남색 바탕이라 같은 색으로
        // 맞춰두면 로딩 중에도 팩 모양이 안 깨진다.
        className={`absolute inset-0 overflow-hidden bg-[#0b1020] ${dim ? "brightness-[.45]" : ""} ${animateClass ?? ""}`}
        style={{ clipPath }}
      >
        <Image
          src={`/images/card-packs/${sport.key}-${grade}.png`}
          alt=""
          fill
          sizes="(max-width: 640px) 33vw, 160px"
          className="object-cover"
        />

        {/* 시즌 표기. 반투명 띠를 아주 얕게 깐다 — 여섯 장 다 이 자리를 비워두고 그린 것이라
            살짝만 있어도 글자가 읽히고, 꽉 채우면 그림 한가운데를 판때기가 덮는다. */}
        <div className="absolute inset-x-[-6%] top-[40%] -rotate-[4deg] bg-black/40 py-1 text-center sm:py-1.5">
          <div className="text-[8px] leading-none font-black tracking-[.22em] text-white/90 sm:text-[11px]">
            {sport.packSub}
          </div>
        </div>

        {/* 하단 표기 */}
        <div
          className={`absolute inset-x-0 ${FOOT_BOTTOM} text-center text-[7px] leading-tight font-bold text-white/85 sm:text-[9px]`}
        >
          선수 카드 {packSize}장
          <br />
          {note ?? "등급 무작위"}
        </div>
      </div>
    </div>
  );
}
