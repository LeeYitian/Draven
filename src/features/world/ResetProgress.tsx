import { useState } from 'react';
import { t } from '../../content';
import { useAppStore } from '../../store/store';
import { usePopoverStore } from '../../store/popover';
import { useUiStore } from '../../store/ui';

/**
 * 「重置進度」（T125）：清除追蹤、伏筆（獲得與解開）、04 遮罩紀錄與各頁的瀏覽狀態。
 * 先問一次再執行（兩步驟，避免誤觸）；完成後以播報區通知螢幕閱讀器。
 */
export function ResetProgress() {
  const [asking, setAsking] = useState(false);
  const reset = useAppStore((s) => s.resetProgress);

  const confirm = () => {
    reset();
    usePopoverStore.setState({ open: null });
    useUiStore.getState().setHintsTray(false);
    useUiStore.getState().announce(t('reset.done'));
    setAsking(false);
  };

  if (!asking) {
    return (
      <button
        type="button"
        data-reset-progress
        className="text-aux text-neutral-600 underline decoration-neutral-400 underline-offset-4 hover:text-accent-800 flow:min-h-11"
        onClick={() => setAsking(true)}
      >
        {t('reset.button')}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('reset.button')}
      data-reset-confirm
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-aux text-neutral-700"
    >
      <span>{t('reset.confirm')}</span>
      <span className="flex gap-2">
        <button type="button" className="btn btn-secondary h-8 px-3" onClick={confirm}>
          {t('reset.yes')}
        </button>
        <button type="button" className="btn btn-ghost h-8 px-3" onClick={() => setAsking(false)}>
          {t('reset.no')}
        </button>
      </span>
    </div>
  );
}
