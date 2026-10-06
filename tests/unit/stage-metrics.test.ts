import { describe, expect, it } from 'vitest';
import {
  AXIS_FRAME,
  CONTENT,
  DOCK,
  PEOPLE,
  STAGE,
  eventCellWidth,
  gridSlot,
} from '../../src/lib/stage-metrics';

describe('stage-metrics 與設計稿一致', () => {
  it('舞台 1440×720（2:1）', () => {
    expect(STAGE.width / STAGE.height).toBe(2);
  });

  it('側欄 72＋左右邊距＝內容區 x 112、寬 1288，右緣留 40', () => {
    expect(CONTENT.x).toBe(112);
    expect(CONTENT.x + CONTENT.width).toBe(STAGE.width - 40);
    expect(DOCK.width).toBe(72);
  });

  it('下方區：左 620 ＋ 間距 40 ＋ 右 628 ＝ 內容寬 1288（G-05）', () => {
    const { leftWidth, gap, rightWidth, narrativeTextWidth, sidenoteWidth } = AXIS_FRAME.lower;
    expect(leftWidth + gap + rightWidth).toBe(CONTENT.width);
    expect(narrativeTextWidth + sidenoteWidth).toBe(leftWidth);
  });

  it('旁註欄放得下最寬的框格（「放開以放入」148）', () => {
    expect(AXIS_FRAME.lower.sidenoteWidth).toBeGreaterThanOrEqual(148);
  });

  it('下方區底緣 ≤ 舞台底（y238＋高 457＝695，下邊距 25）', () => {
    const { y, height } = AXIS_FRAME.lower;
    expect(y + height).toBe(695);
    expect(STAGE.height - (y + height)).toBe(25);
  });

  it('事件格寬：6 格 208、7 格約 177（設計稿 §6-D）', () => {
    expect(eventCellWidth(6)).toBeCloseTo(208, 5);
    expect(eventCellWidth(7)).toBeCloseTo(177.14, 1);
  });

  it('人物誌 slot：x = 48 + 欄×274、y = 188 + 列×128', () => {
    expect(gridSlot(0, 0)).toEqual({ x: 48, y: 188 });
    expect(gridSlot(4, 3)).toEqual({ x: 48 + 4 * 274, y: 188 + 3 * 128 });
  });

  it('20 個 slot 全部落在卡片區內（含卡片尺寸）', () => {
    const { area, card, grid } = PEOPLE;
    for (let c = 0; c < grid.columns; c++) {
      for (let r = 0; r < grid.rows; r++) {
        const { x, y } = gridSlot(c, r);
        expect(x).toBeGreaterThanOrEqual(area.x);
        expect(x + card.width).toBeLessThanOrEqual(area.x + area.width);
        expect(y + card.height).toBeLessThanOrEqual(area.y + area.height);
      }
    }
  });
});
