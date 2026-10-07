import { useEffect, useRef, useState } from 'react';

const DURATION = 300;
const ease = (x: number) => 1 - Math.pow(1 - x, 3); // ease-out cubic

const same = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys(b).every((k) => a[k] === b[k]);

/**
 * 分層收合的 300ms 高度動畫：目標值（0＝展開、1＝收合）改變時，各層的 t 以 rAF 逐格插值；
 * 版面（layers.ts）每一格都是合法版面，所以節點與連線會一路跟著動。「減少動態」時直接到位。
 */
export function useLayerTween(
  target: Readonly<Record<string, number>>,
  reduceMotion: boolean,
): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>({ ...target });
  const current = useRef<Record<string, number>>({ ...target });
  const key = JSON.stringify(target);

  useEffect(() => {
    const goal = JSON.parse(key) as Record<string, number>;
    if (reduceMotion || same(current.current, goal)) {
      current.current = goal;
      // 非同步更新：避免在 effect 本體同步 setState
      const id = requestAnimationFrame(() => setShown(goal));
      return () => cancelAnimationFrame(id);
    }
    const from = { ...current.current };
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION);
      const e = ease(progress);
      const next: Record<string, number> = {};
      for (const id of Object.keys(goal))
        next[id] = (from[id] ?? 0) + (goal[id]! - (from[id] ?? 0)) * e;
      current.current = progress >= 1 ? goal : next;
      setShown(current.current);
      if (progress < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [key, reduceMotion]);

  return reduceMotion ? { ...target } : shown;
}
