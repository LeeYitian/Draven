import { describe, expect, it } from 'vitest';
import {
  arrowHead,
  edgeSegment,
  findOverlaps,
  labelPosition,
  lerpPoint,
  nodeBox,
  normalizeLayout,
  projectNodes,
  rectBoundary,
} from '../../src/features/graph/layout';
import { AxisPageSchema } from '../../src/content/schema';
import page01 from '../../src/content/pages/01.yaml';

describe('座標正規化與還原', () => {
  const raw = { size: [628, 457] as const, nodes: { a: [314, 228.5] as const, b: [628, 0] as const } };

  it('設計座標 ÷ 畫布尺寸＝比例', () => {
    const r = normalizeLayout(raw);
    expect(r.a).toEqual([0.5, 0.5]);
    expect(r.b).toEqual([1, 0]);
  });

  it('比例 × 容器實際尺寸＝像素；原尺寸下還原成原座標', () => {
    const r = normalizeLayout(raw);
    expect(projectNodes(r, 628, 457).a).toEqual([314, 228.5]);
    expect(projectNodes(r, 300, 200).a).toEqual([150, 100]);
  });
});

describe('節點尺寸', () => {
  it('舞台版固定；流式版容器寬 ≥ 340 為 96，較窄為 88', () => {
    expect(nodeBox('stage', 628).w).toBe(120);
    expect(nodeBox('flow', 342).w).toBe(96);
    expect(nodeBox('flow', 340).w).toBe(96);
    expect(nodeBox('flow', 339).w).toBe(88);
    expect(nodeBox('flow', 272).w).toBe(88);
  });
});

describe('節點碰撞檢查', () => {
  it('不重疊回傳空；重疊回傳成對的 id', () => {
    const box = { w: 100, h: 50 };
    expect(findOverlaps({ a: [50, 25], b: [200, 25] }, box)).toEqual([]);
    expect(findOverlaps({ a: [50, 25], b: [120, 40] }, box)).toEqual([['a', 'b']]);
  });

  it('剛好貼齊不算重疊；加 gap 後視為過近', () => {
    const box = { w: 100, h: 50 };
    expect(findOverlaps({ a: [50, 25], b: [150, 25] }, box)).toEqual([]);
    expect(findOverlaps({ a: [50, 25], b: [150, 25] }, box, 8)).toEqual([['a', 'b']]);
  });
});

describe('01 頁座標：容器夠寬就不重疊', () => {
  const page = AxisPageSchema.parse(page01);
  const ids = page.graph.nodes.map((n) => n.id);

  it('桌機：寬 628×高 457（含 8px 間距）', () => {
    const ratios = normalizeLayout(page.graph.layout.desktop);
    const points = projectNodes(ratios, 628, 457);
    expect(findOverlaps(points, nodeBox('stage', 628), 8)).toEqual([]);
    for (const id of ids) {
      const [x, y] = points[id]!;
      const { w, h } = nodeBox('stage', 628);
      expect(x - w / 2).toBeGreaterThanOrEqual(0);
      expect(x + w / 2).toBeLessThanOrEqual(628);
      expect(y - h / 2).toBeGreaterThanOrEqual(0);
      expect(y + h / 2).toBeLessThanOrEqual(457);
    }
  });

  it('流式：容器寬 272（最窄）到 640，高度依 342:300 縮放，節點都不重疊也不出界', () => {
    const ratios = normalizeLayout(page.graph.layout.flow);
    for (const width of [272, 296, 312, 320, 339, 340, 342, 400, 500, 592]) {
      const height = (width * 300) / 342;
      const points = projectNodes(ratios, width, height);
      const box = nodeBox('flow', width);
      expect(findOverlaps(points, box), `寬 ${width}`).toEqual([]);
      for (const id of ids) {
        const [x] = points[id]!;
        expect(x - box.w / 2, `${id} 左緣 @${width}`).toBeGreaterThanOrEqual(0);
        expect(x + box.w / 2, `${id} 右緣 @${width}`).toBeLessThanOrEqual(width);
      }
    }
  });
});

describe('連線幾何', () => {
  const box = { w: 120, h: 56 };

  it('矩形邊界交點：水平、垂直、斜向', () => {
    expect(rectBoundary([100, 100], box, [300, 100])).toEqual([160, 100]);
    expect(rectBoundary([100, 100], box, [100, 0])).toEqual([100, 72]);
    // 斜向：先碰到上下緣（|dy|/h 較大）
    const [x, y] = rectBoundary([0, 0], box, [280, 140]);
    expect(y).toBeCloseTo(28, 5);
    expect(x).toBeCloseTo(56, 5);
  });

  it('端點從兩個節點的邊界出發，兩端各留 gap', () => {
    const seg = edgeSegment({ center: [100, 100], box }, { center: [300, 100], box }, 2)!;
    expect(seg.start).toEqual([162, 100]);
    expect(seg.end).toEqual([238, 100]);
    expect(seg.length).toBeCloseTo(76, 5);
  });

  it('兩節點重疊（中心距離太近）→ 沒有可畫的線', () => {
    expect(edgeSegment({ center: [100, 100], box }, { center: [120, 100], box }, 2)).toBeNull();
  });

  it('終點插值：t=0 在起點，t=1 在終點，t=0.5 在中點', () => {
    expect(lerpPoint([0, 0], [100, 40], 0)).toEqual([0, 0]);
    expect(lerpPoint([0, 0], [100, 40], 0.5)).toEqual([50, 20]);
    expect(lerpPoint([0, 0], [100, 40], 1)).toEqual([100, 40]);
  });

  it('自繪箭頭：尖端在終點、底邊與連線垂直、長度 9 寬 8', () => {
    const [tip, left, right] = arrowHead([100, 50], [0, 50]);
    expect(tip).toEqual([100, 50]);
    expect(left[0]).toBeCloseTo(91, 5);
    expect(right[0]).toBeCloseTo(91, 5);
    expect(Math.abs(left[1] - right[1])).toBeCloseTo(8, 5);
    expect((left[1] + right[1]) / 2).toBeCloseTo(50, 5);
  });

  it('箭頭朝向隨連線方向旋轉（垂直線）', () => {
    const [tip, left, right] = arrowHead([50, 100], [50, 0]);
    expect(tip).toEqual([50, 100]);
    expect(left[1]).toBeCloseTo(91, 5);
    expect(Math.abs(left[0] - right[0])).toBeCloseTo(8, 5);
  });
});

describe('線上文字位置', () => {
  it('近水平的線：文字放在線上方；斜線與垂直線：文字置中於線的中點', () => {
    expect(labelPosition([0, 100], [200, 100])).toEqual([100, 92]);
    expect(labelPosition([100, 0], [100, 200])).toEqual([100, 100]);
    expect(labelPosition([0, 0], [200, 200])).toEqual([100, 100]);
  });

  it('labelOffset 直接疊加（設計座標的微調）', () => {
    expect(labelPosition([100, 0], [100, 200], [10, -6])).toEqual([110, 94]);
  });
});
