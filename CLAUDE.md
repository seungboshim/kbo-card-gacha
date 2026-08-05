# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 명령어

```bash
npm run dev -- -p 3100   # 개발 서버. 로컬 확인은 3100 포트로 연다
npm run build        # 프로덕션 빌드 (타입체크 겸함, 별도 tsc 스크립트 없음)
npm run lint         # eslint (flat config, 인자 없이)
npm test             # node --test deck.test.ts battle.test.ts

node --test deck.test.ts                              # 파일 하나만
node --test --test-name-pattern "레전드" deck.test.ts   # 테스트 하나만
```

테스트는 Node 내장 러너가 `.ts` 를 그대로 실행한다(타입 스트리핑). 별도 러너·트랜스파일러가 없으니
추가하지 말 것. Node 24 기준. 3000 포트는 다른 프로젝트가 쓰고 있을 때가 있어 3100 을 기본으로 둔다.

`npm test`, `npm run build`, `npm run lint` 가 통과해야 "완료"다.

## 구조

두 층으로 갈린다.

- `app/_game/*` — 종목과 무관한 부분. `Card` 타입, 등급 표(`TIERS`), 뽑기(`drawPack`),
  대결 규칙(`battle.ts`), 카드 UI(`card.tsx`), 게임 화면 전체(`game.tsx`)
- `app/_sports/*` — 종목별 어댑터. 성적 API 호출, rating 계산, 표시 문구. 각각 `SportConfig`
  상수(`KBO`, `EPL`)와 `get{Kbo,Epl}Pool(): Promise<Card[]>` 를 내보낸다

새 종목을 붙인다면 `app/_sports/` 에 파일 하나 + `app/<key>/page.tsx` + `game.tsx` 의 `SPORTS`
맵에 등록. `_` 로 시작하는 폴더는 Next.js 라우팅에서 빠진다.

### 서버 → 클라이언트 경계

`app/kbo/page.tsx`, `app/epl/page.tsx` 는 서버 컴포넌트다(`revalidate = 3600`). 풀을 받아
`<Game pool={pool} sport="kbo" />` 로 넘긴다. `SportConfig` 에 함수 필드(`miniStatKeys`)가 있어
직렬화로 못 넘어가므로 **key 문자열만 넘기고 `game.tsx` 가 다시 찾는다**. 이 구조를 깨지 말 것.

### import 확장자

`node --test` 가 닿는 모듈(`deck.ts`, `battle.ts`, `kbo.ts`, `epl.ts`, `epl-names.ts`)끼리는
`from "./deck.ts"` 처럼 확장자를 붙인다. Node 가 해석해야 해서다. `.tsx` 클라이언트 컴포넌트는
번들러만 거치므로 확장자 없이 쓴다. 새 파일이 테스트에서 import 되면 확장자를 붙여야 한다.

### 등급

`assignTiers()` 가 역할군 안에서 rating 내림차순 백분위로 등급을 매긴다. 역할군은 KBO 는
타자·선발·불펜, EPL 은 포지션 7종이다. EPL 만 레전드를 `promoteGlobalLegends()` 로 다시 잡는다
(FotMob 평점은 포지션 간 척도가 같지만 KBO WAR 은 다르다. 각 파일 주석에 근거가 있다).

`TIERS` 의 `pct`(등급 정원)와 `rate`(뽑기 확률)는 **함께 움직여야 한다**. 한쪽만 바꾸면 장당 확률이
역전된다. `deck.ts` 상단 주석 참고.

### 카드 UI

`card.tsx` 한 컴포넌트가 **등급 5종 × 화면(카드깡·배틀·결과) × 크기 3종(`mini`/`compact`/`full`)**
을 전부 그린다. 한 곳을 고치면 다른 조합이 같이 움직이므로, 레이아웃·치수를 바꿀 때는 어느 조합에만
적용할지 먼저 정하고 나머지가 어떻게 변하는지 확인한다. 실제로 레전드 히어로 레이아웃을 넣었다가
일반 카드까지 커졌고, 카드 높이가 등급마다 달라져 한 줄에서 어긋난 적이 있다.

`mini` 는 폭이 165px 안팎이라 다른 크기와 구성이 다르다(대표 스탯 2개만, 팀·포지션 생략).
`mini` 를 안 보고 고치면 여기서 깨진다.

### 대결

`battle.ts` 는 순수 함수만 둔다. 덱은 배열 마지막이 시각적으로 맨 앞이다. `game.tsx` 는 판정을
먼저 하고(`resolveRound`) 덱 반영(`applyRound`)은 연출 타이머가 끝난 뒤에 커밋한다.

### 외부 데이터

- KBO: Naver 스포츠 기록 API(비공식·무인증). 시즌 상수는 `kbo.ts` 의 `SEASON`
- EPL: FotMob 통계 CDN. 시즌마다 `epl.ts` 의 `SEASON_ID` 를 갈아야 한다(찾는 법은 주석에)

선수 사진·팀 로고 호스트는 `next.config.ts` 의 `remotePatterns` 에 등록돼 있어야 뜬다.

## 코드 관행

- **주석은 왜(why)를 적는다.** 튜닝된 상수(`GOAL_BONUS`, `MIN_MINS`, `LEGEND_MIN_MINS`,
  애니메이션 ms, 레이아웃 px)마다 실측 근거가 주석에 붙어 있다. 값을 바꾸면 근거도 같이 고친다.
  근거 없이 상수만 갈지 말 것
- 의존성을 늘리지 않는다. Next + React 만 쓴다
- 커밋 메시지는 한국어 현재형 평서문("~한다", "~로 바꾼다")
