"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "./use-focus-trap";

const OUTLINE_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

/**
 * 스쿼드 판의 반응형 껍데기. 컴포넌트는 하나만 마운트해두고 CSS 브레이크포인트로
 * 위치만 바꾼다 - lg 이상은 우측에 고정된 패널, 그 아래는 왼쪽 모서리 책갈피 탭 +
 * 슬라이드 드로어다. 두 벌을 따로 마운트하면 픽커가 다루는 슬롯 같은 내부 상태가
 * 둘로 갈라져 동기화가 필요해진다.
 *
 * open 상태를 solo.tsx 가 들고 있는 이유: 드로어가 펼쳐진 동안 "뒤 화면"(헤더·상점·
 * 보관함)에 inert 를 걸어야 하는데, 그 부분은 이 컴포넌트 밖에 있는 형제 엘리먼트라서다.
 */
export function SquadDrawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    // inert 는 포커스·클릭만 막지 스크롤은 안 막아서, 뒤 화면 스크롤은 따로 잠근다.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    // 닫힐 때 되돌아갈 탭 버튼. cleanup 시점엔 언마운트돼 ref가 비어 있을 수 있어 지금 값을 잡아둔다.
    const tab = tabRef.current;
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      tab?.focus();
    };
  }, [open, onOpenChange]);

  return (
    <>
      {/* lg 이상에서는 늘 펼쳐진 우측 패널이라 탭이 필요 없다. */}
      <button
        ref={tabRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="squad-drawer-panel"
        className={`fixed top-1/2 left-0 z-30 -translate-y-1/2 rounded-r-lg bg-zinc-900 px-1.5 py-4 text-xs font-bold tracking-wide text-zinc-300 ring-1 ring-white/10 transition-colors hover:bg-zinc-800 lg:hidden ${OUTLINE_FOCUS}`}
      >
        스쿼드
      </button>

      {open && (
        <div
          aria-hidden="true"
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <div
        id="squad-drawer-panel"
        ref={panelRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "스쿼드" : undefined}
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 z-50 w-[86vw] max-w-sm overflow-y-auto bg-zinc-950 p-4 shadow-2xl ring-1 ring-white/10 transition-transform duration-300 lg:static lg:z-auto lg:w-[380px] lg:shrink-0 lg:translate-x-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </div>
    </>
  );
}
