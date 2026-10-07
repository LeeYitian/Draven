import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * 讓元件在「關閉」之後還保留一段時間以播放退場動畫。
 * - open 變 true：立刻掛載（present＝true、closing＝false）；退場途中重新開啟會取消卸載。
 * - open 變 false：closing＝true，等 ms 之後才卸載（present＝false）。
 * - 使用者要求減少動態（或 ms 為 0）：不保留，立刻卸載。
 * 「是否掛載」在渲染期間就算好，所以第一次渲染就是進場狀態，不會閃一格空白。
 */
export function usePresence(open: boolean, ms: number): { present: boolean; closing: boolean } {
  const reduce = useReducedMotion();
  const instant = reduce || ms <= 0;
  const [held, setHeld] = useState(open);

  if (open && !held) setHeld(true);

  useEffect(() => {
    if (open || !held || instant) return;
    const timer = window.setTimeout(() => setHeld(false), ms);
    return () => window.clearTimeout(timer);
  }, [open, held, instant, ms]);

  return { present: open || (held && !instant), closing: !open && held && !instant };
}
