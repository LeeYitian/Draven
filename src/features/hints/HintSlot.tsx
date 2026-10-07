import { Check } from 'lucide-react';
import { useEffect, type CSSProperties, type KeyboardEvent, type Ref } from 'react';
import { getHint, t } from '../../content';
import { useAppStore } from '../../store/store';
import { useUiStore } from '../../store/ui';
import { placeHintAction } from './actions';

/** 答錯震動 300ms；答對光暈閃動 600ms×2（CSS），回饋在這之後由框格自己清掉 */
const FEEDBACK_MS = { wrong: 300, solved: 1200 } as const;

export type SlotState = 'empty' | 'ready' | 'solved' | 'wrong';

/** 框格目前的狀態：已解開＞答錯回饋＞有關鍵字被選中（可以放置）＞空 */
export function useSlotState(hintId: string): {
  state: SlotState;
  dragging: boolean;
  flashing: boolean;
} {
  const solved = useAppStore((s) => s.hints.solved.includes(hintId));
  const selected = useAppStore((s) => s.hints.selected);
  const feedback = useUiStore((s) => s.hintFeedback);
  const dragging = useUiStore((s) => s.hintDragging);
  const mine = feedback?.slotId === hintId ? feedback : null;

  // 回饋播完就清掉（計時在 callback 中改外部 store，不經過 React state）
  const token = mine?.token;
  const kind = mine?.kind;
  useEffect(() => {
    if (token === undefined || !kind) return;
    const timer = window.setTimeout(
      () => useUiStore.getState().clearFeedback(token),
      FEEDBACK_MS[kind],
    );
    return () => window.clearTimeout(timer);
  }, [token, kind]);

  if (solved) return { state: 'solved', dragging, flashing: kind === 'solved' };
  if (kind === 'wrong') return { state: 'wrong', dragging, flashing: false };
  return { state: selected ? 'ready' : 'empty', dragging, flashing: false };
}

export interface HintSlotProps {
  hintId: string;
  /** 本頁第幾處（無障礙標籤） */
  index: number;
  /** 容器（定位用）；舞台版由 HintSlotLayer 量測高度 */
  cellRef?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
}

/**
 * 伏筆框格（任務 T094）：四種狀態——空、可以放置、答對鎖定、答錯。
 * 點選：先在托盤選關鍵字，再點框格（或聚焦框格按 Enter）；舞台版也可拖曳關鍵字放進來（命中測試看 data-hint-slot）。
 * 答對後關鍵字固定在框格內，框格下方淡入「解開後說明」。
 */
export function HintSlot({ hintId, index, cellRef, className, style }: HintSlotProps) {
  const hint = getHint(hintId);
  const { state, dragging, flashing } = useSlotState(hintId);
  const selected = useAppStore((s) => s.hints.selected);
  if (!hint) return null;

  const onActivate = () => {
    if (selected) placeHintAction(hintId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  };

  let label: string;
  if (state === 'solved') label = hint.keyword;
  else if (state === 'wrong') label = t('hints.slotWrong');
  else if (state === 'ready') label = dragging ? t('hints.slotReady') : t('hints.slotTap');
  else label = t('hints.slotEmpty');

  return (
    <div ref={cellRef} className={className} style={style} data-hint-cell={hintId}>
      <div
        role="button"
        tabIndex={0}
        className="hint-slot"
        data-hint-slot={hintId}
        data-state={state}
        data-shake={state === 'wrong' || undefined}
        data-flash={flashing || undefined}
        aria-label={t('hints.slotState', {
          label: t('hints.slotLabel', { n: index + 1 }),
          state: label,
        })}
        aria-disabled={state === 'solved' || undefined}
        onClick={onActivate}
        onKeyDown={onKeyDown}
      >
        {state === 'solved' && <Check size={13} strokeWidth={2} aria-hidden="true" />}
        {label}
      </div>
      {state === 'solved' && (
        <p className="hint-explain" data-hint-explain={hintId}>
          {hint.explain}
        </p>
      )}
    </div>
  );
}
