import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../content';
import { useAppStore } from '../../store/store';
import { usePopoverStore } from '../../store/popover';
import { useUiStore } from '../../store/ui';
import { Sheet } from '../../components/ui';

/**
 * 「重置進度」（T125）：清除追蹤、伏筆（獲得與解開）、04 遮罩紀錄與各頁的瀏覽狀態。
 * 先問一次再執行（兩步驟，避免誤觸）；完成後以播報區通知螢幕閱讀器。
 * placement='dock'（舞台版）：按鈕在側欄最下方，詢問的文字與按鈕以浮動面板出現在按鈕右側；
 * placement='cell'（流式版）：底部導覽列「頁面」右邊的一格，詢問以底部面板出現。
 */
export function ResetProgress({ placement = 'dock' }: { placement?: 'cell' | 'dock' }) {
  const [asking, setAsking] = useState(false);
  const reset = useAppStore((s) => s.resetProgress);

  const confirm = () => {
    reset();
    usePopoverStore.setState({ open: null });
    useUiStore.getState().setHintsTray(false);
    useUiStore.getState().announce(t('reset.done'));
    setAsking(false);
  };

  const question = (
    <div
      role="group"
      aria-label={t('reset.button')}
      data-reset-confirm
      className={
        placement === 'dock'
          ? 'absolute bottom-0 left-full z-(--z-popover) ml-3 flex w-[280px] flex-col gap-2 rounded-md border border-divider bg-bg p-3 text-aux text-neutral-700 shadow-md'
          : 'flex flex-col gap-3 text-body text-neutral-700'
      }
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

  if (placement === 'cell') {
    return (
      <>
        <button
          type="button"
          data-reset-progress
          aria-haspopup="dialog"
          className="relative flex min-h-11 flex-col items-center justify-center gap-[3px] text-neutral-800 active:bg-accent-100"
          onClick={() => setAsking(true)}
        >
          <RotateCcw size={20} strokeWidth={1.5} aria-hidden="true" />
          <span className="text-aux">{t('reset.button')}</span>
        </button>
        <Sheet open={asking} onClose={() => setAsking(false)} bottomOffset={76} tone="accent">
          {question}
        </Sheet>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-reset-progress
        aria-expanded={asking}
        className="text-aux text-neutral-600 underline decoration-neutral-400 underline-offset-4 hover:text-accent-800"
        onClick={() => setAsking((v) => !v)}
      >
        {t('reset.button')}
      </button>
      {asking && question}
    </div>
  );
}
