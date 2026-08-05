<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 위 규칙을 언제 실제로 적용하나

"모든 코드 전에"로 읽으면 아무도 안 읽는다(이 저장소 작업 이력에서 참조 0건). 이 프로젝트가
Next.js 고유 동작에 실제로 기대는 지점은 넷뿐이니, **그 넷을 건드릴 때만** 해당 문서를 편다.

- 서버/클라이언트 컴포넌트 경계 (`"use client"`, 서버 컴포넌트가 함수 prop 을 못 넘기는 제약)
- 캐싱 (`export const revalidate`, `fetch` 의 `next: { revalidate }`)
- `next/image` 와 `next.config.ts` 의 `remotePatterns`
- App Router 파일 규약 (`page.tsx`, `layout.tsx`, `_` 프리픽스 폴더)

이 넷 밖의 일(상태 관리, Tailwind 클래스, 순수 로직, 테스트)은 문서를 안 봐도 된다.

명령어·구조·코드 관행은 `CLAUDE.md` 에 있다. 이 파일은 Next.js 버전 주의만 담는다.
