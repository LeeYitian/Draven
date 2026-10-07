import { useEffect, useState } from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { Callout } from '../../components/ui';
import { t } from '../../content';
import { useAppStore } from '../../store/store';

/** 獲得提示停留 3 秒；滑鼠移入暫停（contracts §4） */
export const HINT_TOAST_MS = 3000;

/**
 * 獲得新伏筆的提示（任務 T091）：進入主軸時貼在側欄「伏筆」旁（流式版在導覽列上方）。
 * 多個合併成「獲得 N 個新伏筆」，單個顯示關鍵字；側欄徽章同時閃動（Dock 的 HintsBadge）。
 */
export function HintToast() {
  const { mode } = useLayout();
  const toast = useAppStore((s) => s.hints.toast);
  const owned = useAppStore((s) => s.hints.owned.length);
  const dismiss = useAppStore((s) => s.dismissToast);
  const [hover, setHover] = useState(false);

  const token = toast?.token;
  useEffect(() => {
    if (token === undefined || hover) return;
    const timer = window.setTimeout(dismiss, HINT_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [token, hover, dismiss]);

  if (!toast) return null;
  const message =
    toast.count === 1
      ? t('hints.acquiredOne', { keyword: toast.keywords[0] ?? '' })
      : t('hints.acquiredMany', { n: toast.count });
  const content = (
    <>
      <div className="text-[15px] font-semibold">{message}</div>
      <div className="mt-0.5 text-aux text-neutral-700">
        {t('hints.acquiredFooter', { n: owned })}
      </div>
    </>
  );
  const hoverProps = {
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
  };

  if (mode === 'flow') {
    return (
      <div
        role="status"
        data-hint-toast
        className="fixed inset-x-0 bottom-[84px] z-(--z-toast) mx-auto w-[calc(100%-48px)] max-w-[592px]"
        {...hoverProps}
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
      data-hint-toast
      className="absolute z-(--z-toast)"
      style={{ left: 80, top: 90 }}
      {...hoverProps}
    >
      <Callout placement="right" arrowY={26} tone="accent">
        {content}
      </Callout>
    </div>
  );
}
