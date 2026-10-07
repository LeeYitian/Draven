import { describe, expect, it } from 'vitest';
import {
  clampPercent,
  nearestIndex,
  snapPosition,
  stepPosition,
} from '../../src/features/extras/spectrum';

// 01 邊界之辯：露米 10、諾爾 30、法恩 50、布倫 75、德雷文 100
const P = [10, 30, 50, 75, 100];

describe('nearestIndex／snapPosition：位置 → 最近立場', () => {
  it('剛好在立場上', () => {
    expect(P.map((p) => nearestIndex(P, p))).toEqual([0, 1, 2, 3, 4]);
  });
  it('兩個立場之間取較近的；正中間取較左的', () => {
    expect(nearestIndex(P, 19)).toBe(0);
    expect(nearestIndex(P, 21)).toBe(1);
    expect(nearestIndex(P, 20)).toBe(0);
    expect(nearestIndex(P, 62.4)).toBe(2); // 50 與 75 的中點是 62.5
    expect(nearestIndex(P, 62.5)).toBe(2);
    expect(nearestIndex(P, 62.6)).toBe(3);
  });
  it('超出兩端取最近的盡頭', () => {
    expect(nearestIndex(P, 0)).toBe(0);
    expect(nearestIndex(P, 999)).toBe(4);
    expect(nearestIndex(P, -5)).toBe(0);
  });
  it('吸附：回傳最近立場的位置', () => {
    expect(snapPosition(P, 44)).toBe(50);
    expect(snapPosition(P, 88)).toBe(100);
    expect(snapPosition(P, 12)).toBe(10);
  });
  it('立場順序不影響結果（內部先排序）', () => {
    expect(snapPosition([100, 10, 50], 44)).toBe(50);
  });
});

describe('stepPosition：鍵盤 ← → 跳到上／下一個立場', () => {
  it('依序往右、往左', () => {
    expect(stepPosition(P, 10, 1)).toBe(30);
    expect(stepPosition(P, 30, 1)).toBe(50);
    expect(stepPosition(P, 75, -1)).toBe(50);
    expect(stepPosition(P, 50, -1)).toBe(30);
  });
  it('在盡頭維持不動', () => {
    expect(stepPosition(P, 100, 1)).toBe(100);
    expect(stepPosition(P, 10, -1)).toBe(10);
  });
  it('停在兩立場之間：往右取下一個較大的、往左取下一個較小的', () => {
    expect(stepPosition(P, 40, 1)).toBe(50);
    expect(stepPosition(P, 40, -1)).toBe(30);
  });
});

describe('clampPercent', () => {
  it('夾在 0–100', () => {
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(48.5)).toBe(48.5);
    expect(clampPercent(140)).toBe(100);
  });
});
