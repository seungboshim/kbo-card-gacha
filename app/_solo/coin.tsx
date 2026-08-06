/**
 * 게임 화폐 금액을 동전 아이콘과 숫자로 보여준다.
 *
 * 단위를 글자로 안 쓰는 이유: 자리마다 문구가 제각각이었다. 보유량엔 단위가 없고,
 * 판매가엔 단위 글자가 붙고, 장당가는 또 달랐다 — 같은 값인데 다르게 읽혔다.
 * 아이콘 하나로 두면 어디서든 같게 보인다.
 *
 * sr-only 로 단위 글자를 하나 남기는 이유: 화면에서는 아이콘이 단위를 말하지만
 * 스크린리더는 이모지를 못 읽거나 "동전"이라고만 읽는다.
 */
export function Coin({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <span aria-hidden="true">🪙</span>
      {amount.toLocaleString()}
      <span className="sr-only">크레딧</span>
    </span>
  );
}
