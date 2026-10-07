import { useEffect, useState } from 'react';
import { getPerson, t } from '../../content';
import { useAppStore } from '../../store/store';
import { Callout } from '../ui';
import { useLayout } from './LayoutProvider';

/** 追蹤開始的提示停留時間（設計稿 §5-C：2.4 秒後淡出） */
export const TRACK_TOAST_MS = 2400;

/**
 * 追蹤回饋提示（任務 T075）：人物誌關閉後，00 與關係圖不標亮追蹤，所以靠這則提示告知已生效。
 * 舞台版：從側欄追蹤區塊向右彈出；流式版：導覽列上方。與側欄追蹤區塊的閃動（600ms×2）同時發生。
 * 以 trackingFeedback 計數觸發：連續追蹤不同人會重新顯示。
 */
export function TrackToast() {
  const { mode } = useLayout();
  const feedback = useAppStore((s) => s.trackingFeedback);
  const trackedId = useAppStore((s) => s.trackedPersonId);
  const [dismissed, setDismissed] = useState(0);

  useEffect(() => {
    if (feedback === 0 || feedback === dismissed) return;
    const timer = window.setTimeout(() => setDismissed(feedback), TRACK_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [feedback, dismissed]);

  const person = trackedId ? getPerson(trackedId) : undefined;
  if (feedback === 0 || feedback === dismissed || !person) return null;

  const content = (
    <>
      <div className="text-[15px] font-semibold">{t('tracking.now', { name: person.name })}</div>
      <div className="mt-0.5 text-aux text-neutral-700">{t('tracking.hint')}</div>
    </>
  );

  if (mode === 'flow') {
    return (
      <div
        role="status"
        data-track-toast
        className="fixed inset-x-0 bottom-[84px] z-(--z-toast) mx-auto w-[calc(100%-48px)] max-w-[592px]"
      >
        <Callout tone="accent" className="w-full">
          {content}
        </Callout>
      </div>
    );
  }
  return (
    <div
      role="status"
      data-track-toast
      className="absolute z-(--z-toast)"
      style={{ left: 80, top: 160 }}
    >
      <Callout placement="right" arrowY={26} tone="accent">
        {content}
      </Callout>
    </div>
  );
}
