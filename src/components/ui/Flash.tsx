import { type ReactNode } from 'react';

/**
 * 閃動一次（600ms×2）：trigger 改變就重播（以 key 重新掛載）。
 * trigger 為 0 時不閃。「減少動態」時 CSS 不播放（components.css），所以這裡不用另外判斷。
 */
export function Flash({
  trigger,
  className,
  children,
}: {
  trigger: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span key={trigger} className={className} data-flash={trigger > 0 ? '' : undefined}>
      {children}
    </span>
  );
}
