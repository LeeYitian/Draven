import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** 方向鍵提示（←→↑↓） */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('kbd', className)}>{children}</kbd>;
}

/** 小標：13px、字距 .2em；accent 版字距 .24em、金色 */
export function Eyebrow({
  accent,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { accent?: boolean }) {
  return <div className={cn(accent ? 'eyebrow-accent' : 'eyebrow', className)} {...rest} />;
}

/** Cormorant 大數字（頁碼、事件編號）；tone="ghost" 為骨架用的淡色 */
export function DisplayNum({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone?: 'ghost';
  className?: string;
}) {
  return (
    <span className={cn('display-num', className)} data-tone={tone}>
      {children}
    </span>
  );
}

/** 髮絲分隔線 */
export function Hairline({ className }: { className?: string }) {
  return <hr className={cn('hairline', className)} />;
}

/** 追蹤書籤標記（位置由父層決定） */
export function Bookmark({ className }: { className?: string }) {
  return <span className={cn('bookmark', className)} aria-hidden="true" />;
}
