/**
 * 02 比較滑桿的純計算（T107、T109）。位置是把手在容器上的百分比（0–100）。
 */
export const COMPARE_DEFAULT = 50;
const RANGE_MIN = 20;
const RANGE_MAX = 80;
/** 流式版：把手不論拖到哪一邊，窄側至少要有這麼寬（px），才放得下標題與首句 */
export const NARROW_MIN_PX = 96;
/** 鍵盤 ← → 每次移動 */
export const KEY_STEP = 10;
/** 寬側／窄側的強調門檻：把手離中線超過這個百分點才切換 */
const EMPHASIS_THRESHOLD = 5;

/** 容器寬度（px）下，把手可拖的範圍：舞台版 20–80；流式版再依「窄側 ≥ 96px」收窄 */
export function compareRange(width: number): [number, number] {
  const guard = width > 0 ? (NARROW_MIN_PX / width) * 100 : 0;
  const min = Math.max(RANGE_MIN, guard);
  const max = Math.min(RANGE_MAX, 100 - guard);
  return min <= max ? [min, max] : [50, 50];
}

export function clampCompare(position: number, width: number): number {
  const [min, max] = compareRange(width);
  return Math.min(max, Math.max(min, position));
}

/** 鍵盤移動一格（夾在可拖範圍內） */
export function stepCompare(position: number, dir: 1 | -1, width: number): number {
  return clampCompare(position + dir * KEY_STEP, width);
}

/**
 * 陳舊度 age（0–1）：50% 以左（含預設）為 0；往右到「可拖上限」為 1，中間線性。
 * 以實際上限正規化，所以任何寬度下拉到最右都是 1。
 */
export function ageOf(position: number, width: number): number {
  const [, max] = compareRange(width);
  if (max <= 50) return 0;
  return Math.min(1, Math.max(0, (position - 50) / (max - 50)));
}

/** 哪一側是寬側（字放大）；接近中線時兩側一樣 */
export function emphasisOf(position: number): 'left' | 'right' | null {
  if (position >= 50 + EMPHASIS_THRESHOLD) return 'left';
  if (position <= 50 - EMPHASIS_THRESHOLD) return 'right';
  return null;
}

/** 窄側只留首句：取到第一個句尾標點（連同緊接的右引號） */
export function firstSentence(quote: string): { text: string; more: boolean } {
  const match = /^[^。！？]*[。！？]」?/.exec(quote);
  const text = match?.[0] ?? quote;
  return { text, more: text.length < quote.length };
}

/** 把 age 量化成 1/50 的階梯：拖曳時不必每個像素都更新整頁的樣式 */
export const quantizeAge = (age: number): number => Math.round(age * 50) / 50;
