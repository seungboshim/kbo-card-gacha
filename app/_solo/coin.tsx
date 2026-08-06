/**
 * 크레딧 금액. 단위를 글자 대신 동전으로 말한다.
 *
 * "크레딧"이라는 글자를 안 쓰는 이유: 자리마다 "보유 N", "팔면 N 크레딧", "장당 N" 처럼
 * 문구가 제각각이라 같은 값인데 다르게 읽혔다. 아이콘 하나로 두면 어디서든 같게 보인다.
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
