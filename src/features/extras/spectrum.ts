/**
 * 邊界之辯光譜的純計算（T103）：位置（0–100）與立場之間的換算。
 * 立場位置由 pages/01.yaml 的 extras.boundary.stances 給定，依位置由小到大。
 */

const sorted = (positions: readonly number[]) => [...positions].sort((a, b) => a - b);

/** 最近的立場索引（依由小到大排序後的順序）；距離相同時取較左（較小）的那個 */
export function nearestIndex(positions: readonly number[], value: number): number {
  const list = sorted(positions);
  let best = 0;
  for (let i = 1; i < list.length; i++)
    if (Math.abs(list[i]! - value) < Math.abs(list[best]! - value)) best = i;
  return best;
}

/** 放開後吸附的位置＝最近立場的位置 */
export function snapPosition(positions: readonly number[], value: number): number {
  return sorted(positions)[nearestIndex(positions, value)]!;
}

/**
 * 鍵盤 ← → 的目標：往右（dir=1）取「大於目前位置」的第一個立場，往左取「小於目前位置」的第一個；
 * 已在盡頭就維持不動。拖曳到兩個立場之間時也能得到合理的下一站。
 */
export function stepPosition(positions: readonly number[], value: number, dir: 1 | -1): number {
  const list = sorted(positions);
  if (dir === 1) return list.find((p) => p > value + 1e-9) ?? list[list.length - 1]!;
  return [...list].reverse().find((p) => p < value - 1e-9) ?? list[0]!;
}

/** 指標位置夾在 0–100 */
export const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
