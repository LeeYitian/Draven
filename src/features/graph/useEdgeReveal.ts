import { useEffect, useMemo, useState } from 'react';
import type { GraphEdge } from '../../content/schema';
import { MOTION } from '../../lib/stage-metrics';
import { useAppStore, type AxisKey } from '../../store/store';

/** 畫線進度的緩動：開頭快、結尾慢，線尖像被「牽出來」 */
export const easeDraw = (p: number) => 1 - (1 - p) ** 2;

const NONE: Readonly<Record<string, number>> = {};
const STEP = MOTION.edgeDraw + MOTION.edgeDrawGap;

/** 第 index 條線在經過 elapsed ms 時的進度（0–1）：依序各 400ms、間隔 120ms */
export const drawProgress = (elapsed: number, index: number): number =>
  Math.min(1, Math.max(0, (elapsed - index * STEP) / MOTION.edgeDraw));

interface Animation {
  ids: string[];
}

/**
 * 畫線動畫（contracts/state-and-events.md §3）：
 * - 向前推進到事件 n：只對 edge.event === n 的線播放；更早的線立即出現。
 * - 一次跳多個事件（G-13）：中間事件的線不播（store 只對「目標事件」發出動畫）。
 * - 進入主軸第一次播事件 01；再次進入不重播（掛載時先記下目前的動畫序號，不當成新事件）。
 * - 回退：由 CSS 把 unrevealed 的線淡出 120ms。reduced-motion：不播放。
 *
 * 回傳每條「正在畫」的線的進度（0–1）；不在表中的線＝已畫完（進度 1）。
 * 新動畫在「渲染期間」登記（先於繪製），所以不會閃現整條線。
 */
export function useEdgeReveal(
  axis: AxisKey,
  edges: readonly GraphEdge[],
  reduceMotion: boolean,
): Readonly<Record<string, number>> {
  const animateEvent = useAppStore((s) => s.animateEvent);
  const [handled, setHandled] = useState(animateEvent?.token ?? 0);
  const [animation, setAnimation] = useState<Animation | null>(null);
  const [elapsed, setElapsed] = useState(0);

  if (animateEvent && animateEvent.axis === axis && animateEvent.token !== handled) {
    setHandled(animateEvent.token);
    const ids = edges.filter((e) => e.event === animateEvent.n).map((e) => e.id);
    if (reduceMotion || ids.length === 0) {
      setAnimation(null);
    } else {
      setAnimation({ ids });
      setElapsed(0);
    }
  }

  useEffect(() => {
    if (!animation) return;
    const total = (animation.ids.length - 1) * STEP + MOTION.edgeDraw;
    const startAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const ms = now - startAt;
      setElapsed(ms);
      if (ms < total) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animation]);

  return useMemo(() => {
    if (!animation) return NONE;
    const out: Record<string, number> = {};
    animation.ids.forEach((id, i) => {
      const p = drawProgress(elapsed, i);
      if (p < 1) out[id] = p;
    });
    return out;
  }, [animation, elapsed]);
}
