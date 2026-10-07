import { getHint, t } from '../../content';
import { useAppStore } from '../../store/store';
import { useUiStore } from '../../store/ui';

/**
 * 把關鍵字放進框格（點選與拖曳共用，contracts §5）：
 * 答對 → 鎖定（solved）、框格閃動；答錯 → 框格震動、關鍵字回托盤（選取清除）。
 * 同時送出給螢幕閱讀器的播報與框格的視覺回饋。
 */
export function placeHintAction(slotHintId: string): 'solved' | 'wrong' | 'none' {
  const state = useAppStore.getState();
  const selected = state.hints.selected;
  if (!selected || state.hints.solved.includes(slotHintId)) return 'none';
  const result = state.placeHint(slotHintId);
  const ui = useUiStore.getState();
  if (result === 'solved') {
    ui.giveFeedback(slotHintId, 'solved');
    ui.announce(t('hints.solvedLive', { keyword: getHint(slotHintId)?.keyword ?? '' }));
  } else if (result === 'wrong') {
    ui.giveFeedback(slotHintId, 'wrong');
    ui.announce(t('hints.wrongLive'));
  }
  return result;
}
