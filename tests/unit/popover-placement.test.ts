import { describe, expect, it } from 'vitest';
import { placePopover } from '../../src/components/text/placePopover';

const size = { width: 300, height: 120 };
const anchor = (left: number, top: number, width = 60, height = 24) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe('placePopover（舞台座標 1440×720）', () => {
  it('預設放在錨點正下方 12px，左緣對齊錨點', () => {
    const p = placePopover(anchor(100, 330), size);
    expect(p.placement).toBe('below');
    expect(p.x).toBe(100);
    expect(p.y).toBe(330 + 24 + 12);
  });

  it('下方空間不足時翻到錨點上方', () => {
    const p = placePopover(anchor(100, 640), size);
    expect(p.placement).toBe('above');
    expect(p.y).toBe(640 - 12 - 120);
  });

  it('水平方向夾在舞台內（左右各留 16）', () => {
    expect(placePopover(anchor(2, 300), size).x).toBe(16);
    expect(placePopover(anchor(1420, 300), size).x).toBe(1440 - 300 - 16);
  });

  it('上下都放不下（popover 比舞台可用高度還高）時貼著上緣，保證標題可見', () => {
    const tall = { width: 300, height: 700 };
    const p = placePopover(anchor(100, 350), tall);
    expect(p.y).toBe(16);
  });

  it('上方放得下時不會被推到上緣以外', () => {
    const p = placePopover(anchor(100, 600), size);
    expect(p.placement).toBe('above');
    expect(p.y).toBeGreaterThanOrEqual(16);
  });

  it('箭頭指向錨點中心（相對 popover 左緣），並限制在圓角之內', () => {
    const p = placePopover(anchor(100, 300, 60), size);
    // 錨點中心 x=130，popover 左緣 100，箭頭寬 10 → 130-100-5 = 25
    expect(p.arrowX).toBe(25);
    const far = placePopover(anchor(1420, 300, 20), size);
    expect(far.arrowX).toBeLessThanOrEqual(300 - 22);
    expect(far.arrowX).toBeGreaterThanOrEqual(12);
  });

  it('錨點跨很多行（很寬）時，箭頭仍落在 popover 範圍內', () => {
    const p = placePopover(anchor(100, 300, 600), size);
    expect(p.arrowX).toBeGreaterThanOrEqual(12);
    expect(p.arrowX).toBeLessThanOrEqual(300 - 22);
  });
});
