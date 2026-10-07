import { describe, expect, it } from 'vitest';
import {
  arcPath,
  hashString,
  jitter,
  measureAnchors,
  placeSlots,
  staggerSameLine,
  type AnchorBox,
} from '../../src/features/hints/measure';

/** 建立假的面板與錨點：面板在 (100,200)，倍率 k；錨點的 rect 為螢幕座標 */
function fakePanel(k: number, anchors: Record<string, { left: number; top: number; right: number; bottom: number }[]>) {
  const panel = document.createElement('div');
  Object.defineProperty(panel, 'offsetWidth', { value: 470 });
  panel.getBoundingClientRect = () =>
    ({ left: 100, top: 200, width: 470 * k, height: 300 * k, right: 100 + 470 * k, bottom: 200 + 300 * k }) as DOMRect;
  for (const [id, rects] of Object.entries(anchors)) {
    const el = document.createElement('span');
    el.dataset.hint = id;
    el.getClientRects = () => rects as unknown as DOMRectList;
    panel.append(el);
  }
  return panel;
}

describe('measureAnchors（假 rect）', () => {
  it('取片語「最後一行」的右端，換成面板本地座標（k=1）', () => {
    const panel = fakePanel(1, {
      a: [
        { left: 300, top: 300, right: 570, bottom: 330 }, // 第一行
        { left: 100, top: 336, right: 230, bottom: 366 }, // 最後一行
      ],
    });
    const [box] = measureAnchors(panel);
    expect(box).toMatchObject({ id: 'a', endX: 130, lineTop: 136, lineBottom: 166, midY: 151 });
  });

  it('舞台縮放 k=1.319 與巢狀倍率下，結果仍是未縮放的本地座標', () => {
    const k = 1.319;
    // 本地 (130, 166) 的點在螢幕上是 (100 + 130k, 200 + 166k)
    const panel = fakePanel(k, {
      a: [{ left: 100 + 20 * k, top: 200 + 136 * k, right: 100 + 130 * k, bottom: 200 + 166 * k }],
    });
    const [box] = measureAnchors(panel);
    expect(box!.endX).toBeCloseTo(130, 5);
    expect(box!.lineBottom).toBeCloseTo(166, 5);
    expect(box!.lineTop).toBeCloseTo(136, 5);
  });

  it('沒有 rect（隱藏中）的錨點略過；依 DOM 順序回傳多個', () => {
    const panel = fakePanel(1, {
      a: [{ left: 120, top: 300, right: 200, bottom: 330 }],
      hidden: [],
      b: [{ left: 120, top: 400, right: 250, bottom: 430 }],
    });
    expect(measureAnchors(panel).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('placeSlots（防撞）', () => {
  const input = (id: string, anchorMidY: number, height = 28) => ({ id, anchorMidY, height });

  it('沒有碰撞時，框格以錨點所在行為中心', () => {
    const r = placeSlots([input('a', 100), input('b', 200)]);
    expect(r).toEqual([
      { id: 'a', y: 86 },
      { id: 'b', y: 186 },
    ]);
  });

  it('太近時後一個往下推：y[i] ≥ y[i-1] ＋ 高度 ＋ 8', () => {
    const r = placeSlots([input('a', 100), input('b', 110), input('c', 115)]);
    expect(r.map((s) => s.y)).toEqual([86, 122, 158]); // 每個差 28＋8＝36
  });

  it('依錨點 y 排序（輸入順序不影響）；高度不同時用各自的高度', () => {
    const r = placeSlots([input('b', 112, 40), input('a', 100, 28)]);
    expect(r.map((s) => s.id)).toEqual(['a', 'b']);
    expect(r[1]!.y).toBeGreaterThanOrEqual(r[0]!.y + 28 + 8);
  });

  it('不會高過 minY；最後一個超出 maxY 時整體上推並仍不重疊', () => {
    const r = placeSlots([input('a', 10), input('b', 20)], { minY: 0 });
    expect(r[0]!.y).toBe(0);
    const pushed = placeSlots([input('a', 300), input('b', 320), input('c', 340)], { maxY: 340 });
    const last = pushed.at(-1)!;
    expect(last.y + 28).toBeLessThanOrEqual(340);
    for (let i = 1; i < pushed.length; i++)
      expect(pushed[i]!.y).toBeGreaterThanOrEqual(pushed[i - 1]!.y + 28 + 8 - 1e-9);
  });

  it('空輸入回傳空陣列', () => {
    expect(placeSlots([])).toEqual([]);
  });
});

describe('arcPath（手繪感弧線，擾動可重現）', () => {
  const start = { x: 300, y: 160 };

  it('同一個 id 每次畫出的路徑完全相同；不同 id 不同', () => {
    const a1 = arcPath(start, 484, 150, 'forgotten-gift');
    const a2 = arcPath(start, 484, 150, 'forgotten-gift');
    const b = arcPath(start, 484, 150, 'spirit-scent');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  it('起點在片語末端，終點在框格左緣中點，路徑全是有限數字', () => {
    const d = arcPath(start, 484, 150, 'x');
    expect(d.startsWith('M300 160')).toBe(true);
    expect(d.trim().endsWith('484 150')).toBe(true);
    for (const n of d.match(/-?\d+(\.\d+)?/g)!) expect(Number.isFinite(Number(n))).toBe(true);
  });

  it('起點離框格太近時退化成單段曲線，仍然連到框格', () => {
    const d = arcPath({ x: 470, y: 160 }, 484, 140, 'x');
    expect(d.match(/C/g)).toHaveLength(1);
    expect(d.trim().endsWith('484 140')).toBe(true);
  });

  it('hashString／jitter：穩定且範圍在 [-1, 1]', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    for (const id of ['a', 'bishop-scent', 'x'.repeat(50)])
      for (let salt = 0; salt < 5; salt++) {
        const j = jitter(id, salt);
        expect(j).toBeGreaterThanOrEqual(-1);
        expect(j).toBeLessThanOrEqual(1);
      }
  });
});

describe('staggerSameLine', () => {
  const box = (id: string, endX: number, lineBottom: number): AnchorBox => ({
    id,
    endX,
    lineTop: lineBottom - 30,
    lineBottom,
    midY: lineBottom - 15,
  });

  it('同一行的多個錨點，由左到右依序錯開 3px；不同行不受影響', () => {
    const off = staggerSameLine([box('a', 120, 166), box('b', 300, 167), box('c', 200, 202)]);
    expect(off).toEqual({ a: 0, b: 3, c: 0 });
  });
});
