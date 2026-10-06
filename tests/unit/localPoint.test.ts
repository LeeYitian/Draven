import { describe, expect, it } from 'vitest';
import { localPoint, rectToLocal } from '../../src/lib/localPoint';

/** 以假元素模擬「被 transform: scale 縮放過」的元素：offsetWidth 是本地寬，rect 是縮放後的螢幕矩形 */
function fakeEl(opts: {
  left: number;
  top: number;
  offsetWidth: number;
  scale: number;
  offsetHeight?: number;
}) {
  const { left, top, offsetWidth, scale } = opts;
  const offsetHeight = opts.offsetHeight ?? offsetWidth / 2;
  return {
    offsetWidth,
    offsetHeight,
    getBoundingClientRect: () => ({
      left,
      top,
      width: offsetWidth * scale,
      height: offsetHeight * scale,
      right: left + offsetWidth * scale,
      bottom: top + offsetHeight * scale,
      x: left,
      y: top,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;
}

describe('localPoint', () => {
  it('倍率 1：直接減去左上角', () => {
    const stage = fakeEl({ left: 100, top: 50, offsetWidth: 1440, scale: 1 });
    const p = localPoint(stage, 212, 288);
    expect(p.x).toBeCloseTo(112, 6);
    expect(p.y).toBeCloseTo(238, 6);
    expect(p.k).toBeCloseTo(1, 6);
  });

  it('倍率 1.319（1920×950）：與 research S2 相同數字', () => {
    const s = 1.319;
    const stage = fakeEl({ left: 10, top: 0, offsetWidth: 1440, scale: s });
    // 舞台內本地座標 (112,238) 的元素左上角，在螢幕上的位置
    const p = localPoint(stage, 10 + 112 * s, 238 * s);
    expect(p.x).toBeCloseTo(112, 4);
    expect(p.y).toBeCloseTo(238, 4);
    expect(p.k).toBeCloseTo(s, 6);
  });

  it('倍率 0.833（1280×600）', () => {
    const s = 0.833;
    const stage = fakeEl({ left: 40, top: 0, offsetWidth: 1440, scale: s });
    const p = localPoint(stage, 40 + 466 * s, 381 * s);
    expect(p.x).toBeCloseTo(466, 4);
    expect(p.y).toBeCloseTo(381, 4);
  });

  it('巢狀縮放：舞台 1.319 × 關係圖內再 1.5，仍得到正確本地座標', () => {
    // 內層元素本地寬 200；螢幕上實際倍率 = 1.319 × 1.5
    const total = 1.319 * 1.5;
    const inner = fakeEl({
      left: 300,
      top: 120,
      offsetWidth: 200,
      offsetHeight: 100,
      scale: total,
    });
    const p = localPoint(inner, 300 + 100 * total, 120 + 50 * total);
    expect(p.x).toBeCloseTo(100, 4);
    expect(p.y).toBeCloseTo(50, 4);
    expect(p.k).toBeCloseTo(total, 6);
  });

  it('offsetWidth 為 0（尚未排版）時退化為 k=1，不得產生 NaN／Infinity', () => {
    const el = fakeEl({ left: 0, top: 0, offsetWidth: 0, scale: 1 });
    const p = localPoint(el, 30, 40);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(p.k).toBe(1);
  });
});

describe('rectToLocal', () => {
  it('把螢幕矩形換成元素本地座標（供 Popover 定位）', () => {
    const s = 1.319;
    const stage = fakeEl({ left: 10, top: 20, offsetWidth: 1440, scale: s });
    const anchor = {
      left: 10 + 100 * s,
      top: 20 + 330 * s,
      width: 60 * s,
      height: 20 * s,
    } as DOMRect;
    const r = rectToLocal(stage, anchor);
    expect(r.left).toBeCloseTo(100, 4);
    expect(r.top).toBeCloseTo(330, 4);
    expect(r.width).toBeCloseTo(60, 4);
    expect(r.height).toBeCloseTo(20, 4);
    expect(r.right).toBeCloseTo(160, 4);
    expect(r.bottom).toBeCloseTo(350, 4);
  });
});
