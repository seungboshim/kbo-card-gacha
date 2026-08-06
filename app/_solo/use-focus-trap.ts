// 다이얼로그 안에 Tab 을 가둔다.
//
// 왜 필요한가: 처음엔 다이얼로그마다 "열리면 포커스, Escape 로 닫기, 닫히면 원래 자리로"
// 까지만 있었다. 그러면 Tab 은 뒤 화면으로 그냥 걸어나간다. 강화 오버레이에서 Shift+Tab
// 두 번이면 가려진 보관함의 "팔기" 버튼에 닿아, 강화하려던 카드를 그대로 팔 수 있었다.
// 정산 쪽 구멍은 따로 막았지만, 조작 요소가 새는 것 자체를 남겨두면 다음 오버레이에서
// 또 같은 일이 생긴다.

import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * `active` 인 동안 `ref` 안쪽으로 Tab 순환을 가둔다.
 *
 * 초기 포커스·Escape·포커스 복원은 부르는 쪽이 이미 하고 있으므로 건드리지 않는다.
 * 여기서는 Tab 만 본다.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const root = ref.current;
      if (!root) return;

      // 매번 다시 훑는다. 강화 버튼이 잠기거나 확률 패널이 펼쳐지면 목록이 바뀐다.
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;

      // 다이얼로그 밖에 포커스가 있으면(열리자마자 Tab 을 눌렀다든지) 안쪽으로 끌어온다.
      if (!root.contains(here)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (!e.shiftKey && here === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && here === first) {
        e.preventDefault();
        last.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ref, active]);
}
