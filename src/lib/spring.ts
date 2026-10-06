/**
 * 回彈用的小型彈簧（設計稿 §6-K：節點拖曳放開後回彈，約 400ms、過衝約 6%）。
 *
 * 為什麼不用 CSS transition：拖曳中連線要「跟著節點」，位移必須由 JS 驅動、每一格都更新狀態。
 * 做法：欠阻尼彈簧的解析解（無數值積分，結果與影格率無關），回報進度 p：0 → 過衝 ≈1.06 → 1。
 * 呼叫端自行內插：位置 = 起點 + (終點 − 起點) × p（任何維度都適用）。
 */

/** 阻尼比 ζ=0.67 → 過衝 e^(−ζπ/√(1−ζ²)) ≈ 5.9%；自然頻率 ω=15 rad/s → 約 400ms 內穩定 */
const DAMPING = 0.67;
const OMEGA = 15;
export const SPRING_DURATION_MS = 400;

export function springProgress(seconds: number): number {
  if (seconds <= 0) return 0;
  const decay = DAMPING * OMEGA;
  const omegaD = OMEGA * Math.sqrt(1 - DAMPING * DAMPING);
  return (
    1 -
    Math.exp(-decay * seconds) *
      (Math.cos(omegaD * seconds) + (decay / omegaD) * Math.sin(omegaD * seconds))
  );
}

export interface SpringOptions {
  onDone?: () => void;
  /** 使用者要求減少動態：直接到終點，不播放 */
  reduceMotion?: boolean;
  /** 以下三個供測試注入假時鐘 */
  now?: () => number;
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (id: number) => void;
}

/** 啟動彈簧；回傳取消函式。取消後不再回報、也不呼叫 onDone。 */
export function runSpring(
  onProgress: (progress: number) => void,
  options: SpringOptions = {},
): () => void {
  const now = options.now ?? (() => performance.now());
  const request = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));

  if (options.reduceMotion) {
    onProgress(1);
    options.onDone?.();
    return () => {};
  }

  const start = now();
  let frameId = 0;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const elapsed = now() - start;
    if (elapsed >= SPRING_DURATION_MS) {
      onProgress(1); // 結束時精準對齊終點，避免殘留 1~2% 的誤差
      options.onDone?.();
      return;
    }
    onProgress(springProgress(elapsed / 1000));
    frameId = request(tick);
  };
  frameId = request(tick);

  return () => {
    cancelled = true;
    cancelFrame(frameId);
  };
}
