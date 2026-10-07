import { Check } from 'lucide-react';
import type { PointerEvent } from 'react';
import { t } from '../../content';
import type { Hint } from '../../content/schema';
import { cn } from '../../lib/cn';

export interface HintKeywordProps {
  hint: Pick<Hint, 'id' | 'keyword'>;
  state: 'idle' | 'selected' | 'solved';
  /** 流式版的較大觸控尺寸（40 高、14px） */
  large?: boolean;
  /** 拖曳中：原位只留同寬的虛線空位 */
  hole?: { width: number } | null;
  onToggle: (id: string) => void;
  dragHandlers?: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  };
  consumeClick?: () => boolean;
}

/** 伏筆關鍵字（三種狀態：未使用、選中／拖曳中、已解開）。已解開不可選、不可拖。 */
export function HintKeyword({
  hint,
  state,
  large,
  hole,
  onToggle,
  dragHandlers,
  consumeClick,
}: HintKeywordProps) {
  const solved = state === 'solved';
  return (
    <button
      type="button"
      className={cn('hint-keyword', large && 'h-10 text-[14px]')}
      data-state={state}
      // 拖曳中：原位留同寬的虛線空位。元素本身不能卸載——指標捕捉（pointer capture）綁在它身上
      data-hole={hole ? '' : undefined}
      style={hole ? { width: hole.width } : undefined}
      data-hint-keyword={hint.id}
      aria-pressed={solved ? undefined : state === 'selected'}
      aria-disabled={solved || undefined}
      aria-label={t('hints.keywordLabel', { keyword: hint.keyword })}
      onClick={() => {
        if (consumeClick?.()) return;
        if (!solved) onToggle(hint.id);
      }}
      {...dragHandlers}
    >
      {solved && <Check size={13} strokeWidth={2} aria-hidden="true" />}
      {hint.keyword}
    </button>
  );
}
