import { useEffect, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type ScrimTone = 'paper' | 'ink' | 'cover';

/** 遮罩（人物誌展開＝paper、手機 Popover＝ink、04 劇透遮罩＝cover） */
export function Scrim({
  tone,
  onClick,
  className,
}: {
  tone: ScrimTone;
  onClick?: MouseEventHandler;
  className?: string;
}) {
  return (
    <div className={cn('scrim', className)} data-tone={tone} onClick={onClick} aria-hidden="true" />
  );
}

export interface CalloutProps {
  /** callout 相對錨點的位置，決定箭頭方向 */
  placement?: 'below' | 'above' | 'right';
  tone?: 'neutral' | 'accent';
  /** 箭頭左緣相對 callout 左緣（px），placePopover 會算出來 */
  arrowX?: number;
  arrowY?: number;
  role?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** Popover／提示的外殼：寬 300、箭頭指向錨點、shadow-md */
export function Callout({
  placement,
  tone = 'neutral',
  arrowX,
  arrowY,
  className,
  style,
  children,
  ...rest
}: CalloutProps) {
  const vars: Record<string, string> = {};
  if (arrowX !== undefined) vars['--arrow-x'] = `${arrowX}px`;
  if (arrowY !== undefined) vars['--arrow-y'] = `${arrowY}px`;
  return (
    <div
      className={cn('callout', className)}
      data-placement={placement}
      data-tone={tone}
      style={{ ...vars, ...style } as CSSProperties}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** 面板標題元素的 id（無障礙） */
  labelledBy?: string;
  tone?: 'neutral' | 'accent';
  /** 面板底部距離視窗底部的偏移（留給底部導覽列） */
  bottomOffset?: number;
  children: ReactNode;
}

/** 手機底部面板（Popover、托盤）：附遮罩，Esc 或點遮罩關閉 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  tone = 'neutral',
  bottomOffset = 0,
  children,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-(--z-popover)" onClick={onClose}>
        <Scrim tone="ink" />
      </div>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="sheet fixed inset-x-0 z-(--z-popover) mx-auto max-w-[640px]"
        data-tone={tone}
        style={{ bottom: bottomOffset }}
      >
        {children}
      </div>
    </>
  );
}
