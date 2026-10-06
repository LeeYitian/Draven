import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type ChipVariant = 'filter' | 'legend' | 'toggle';
export type LineKind = 'key' | 'relation' | 'conflict' | 'group';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ChipVariant;
  /** 開／選中。legend：關閉＝虛框＋刪除線；filter／toggle：開啟＝金框 */
  pressed: boolean;
  /** 圖例開關前面的線型小樣 */
  lineKind?: LineKind;
  children: ReactNode;
}

/** 篩選標籤、圖例開關、控制項切換鈕（同一個樣式類別，靠 variant 區分） */
export function Chip({
  variant = 'filter',
  pressed,
  lineKind,
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      className={cn('chip', className)}
      data-variant={variant}
      aria-pressed={pressed}
      {...rest}
    >
      {lineKind && <span className="chip-line" data-kind={lineKind} aria-hidden="true" />}
      {children}
    </button>
  );
}
