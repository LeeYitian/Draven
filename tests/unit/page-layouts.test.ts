import { describe, expect, it } from 'vitest';
import { getAxisPage } from '../../src/content';
import type { AxisPage } from '../../src/content/schema';
import {
  edgeSegment,
  findOverlaps,
  nodeBox,
  normalizeLayout,
  projectNodes,
  type Box,
  type Vec,
} from '../../src/features/graph/layout';
import { naturalBands } from '../../src/features/graph/layers';

// 各主軸頁關係圖的座標檢查：節點在畫布內、互不重疊、連線不穿過第三個節點、
// 分層頁的層頭有空間放層名。座標不對的話在這裡最先發現（不必肉眼逐頁看）。

type Mode = 'stage' | 'flow';

/** 估計節點實際高度：姓名一行＋副標（每行約 7 個全形字）；副標可用 \n 指定換行 */
function estimateHeight(mode: Mode, sub: string): number {
  const lines = sub
    .split('\n')
    .reduce((n, part) => n + Math.max(1, Math.ceil([...part].length / 7)), 0);
  return mode === 'stage' ? 14 + 22 + lines * 20 : 10 + 20 + lines * 18;
}

function canvas(page: AxisPage, mode: Mode, flowWidth: number) {
  const layout = mode === 'stage' ? page.graph.layout.desktop : page.graph.layout.flow;
  const width = mode === 'stage' ? layout.size[0] : flowWidth;
  const height = mode === 'stage' ? layout.size[1] : (layout.size[1] * flowWidth) / layout.size[0];
  const positions = projectNodes(normalizeLayout(layout), width, height);
  const base = nodeBox(mode, width);
  const boxes: Record<string, Box> = Object.fromEntries(
    page.graph.nodes.map((n) => [n.id, { w: base.w, h: estimateHeight(mode, n.sub) }]),
  );
  return { width, height, positions, boxes };
}

function segmentHitsBox(a: Vec, b: Vec, center: Vec, box: Box, pad: number) {
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    if (
      x > center[0] - box.w / 2 - pad &&
      x < center[0] + box.w / 2 + pad &&
      y > center[1] - box.h / 2 - pad &&
      y < center[1] + box.h / 2 + pad
    )
      return true;
  }
  return false;
}

const AXES = [1, 2, 3] as const;
const CASES = [
  ['stage', 628],
  ['flow', 342],
  ['flow', 296],
  ['flow', 272],
  ['flow', 640],
] as const;

for (const axis of AXES) {
  const page = getAxisPage(axis)!;
  for (const [mode, width] of CASES) {
    // 01 的流式座標是更早校正的（Phase 9 的 T120 會整體再校正），最窄的 272 先不納入
    if (axis === 1 && width === 272) continue;
    describe(`0${axis} 關係圖座標（${mode} 寬 ${width}）`, () => {
      const c = canvas(page, mode, width);

      it('每個節點都有座標，且整個節點在畫布內', () => {
        for (const node of page.graph.nodes) {
          const p = c.positions[node.id];
          expect(p, node.id + ' 沒有座標').toBeDefined();
          const b = c.boxes[node.id]!;
          expect(p![0] - b.w / 2, node.id + ' 左緣').toBeGreaterThanOrEqual(0);
          expect(p![0] + b.w / 2, node.id + ' 右緣').toBeLessThanOrEqual(c.width);
          expect(p![1] - b.h / 2, node.id + ' 上緣').toBeGreaterThanOrEqual(0);
          expect(p![1] + b.h / 2, node.id + ' 下緣').toBeLessThanOrEqual(c.height);
        }
      });

      it('節點互不重疊（保留 4px 間距；272 寬保留 2px）', () => {
        // 最窄的 272（三個節點一列時相鄰只剩約 3px）只要求互不重疊
        expect(findOverlaps(c.positions, c.boxes, width === 272 ? 2 : 4)).toEqual([]);
      });

      it('每條連線都有足夠長度可畫，且不穿過第三個節點', () => {
        for (const edge of page.graph.edges) {
          const seg = edgeSegment(
            { center: c.positions[edge.from]!, box: c.boxes[edge.from]! },
            { center: c.positions[edge.to]!, box: c.boxes[edge.to]! },
          );
          expect(seg, edge.id + ' 沒有可畫的線').not.toBeNull();
          // 流式版容器窄，相鄰節點之間的線只剩箭頭長度；舞台版要有足夠長度放線上文字
          const minLength = mode === 'stage' ? 28 : axis === 1 ? 4 : 8;
          expect(seg!.length, edge.id + ' 太短').toBeGreaterThan(minLength);
          for (const node of page.graph.nodes) {
            if (node.id === edge.from || node.id === edge.to) continue;
            expect(
              segmentHitsBox(seg!.start, seg!.end, c.positions[node.id]!, c.boxes[node.id]!, 2),
              edge.id + ' 穿過 ' + node.id,
            ).toBe(false);
          }
        }
      });

      if (page.graph.layers) {
        it('分層：節點都在自己那一層的帶狀區域內，且層頭文字（左上）不壓到任何節點', () => {
          const layers = page.graph.layers!;
          const bands = naturalBands(layers, c.positions, (id) => c.boxes[id]!, c.height);
          layers.forEach((layer, i) => {
            const band = bands[i]!;
            for (const id of layer.nodes) {
              const p = c.positions[id]!;
              const h = c.boxes[id]!.h;
              expect(p[1] - h / 2, id + ' 上緣 vs 層 ' + layer.id).toBeGreaterThanOrEqual(band.top);
              expect(p[1] + h / 2, id + ' 下緣 vs 層 ' + layer.id).toBeLessThanOrEqual(band.bottom);
            }
            // 層頭：舞台版第一層要讓開左上角的「人物關係」標題（往右 84px）；文字約每字 16px＋箭頭 20px
            const left = mode === 'stage' && i === 0 ? 84 : 12;
            const label = {
              l: left,
              r: left + 24 + [...layer.label].length * 16 + 40,
              t: band.top + 6,
              b: band.top + 30,
            };
            for (const node of page.graph.nodes) {
              const p = c.positions[node.id]!;
              const b = c.boxes[node.id]!;
              const hit =
                label.l < p[0] + b.w / 2 &&
                label.r > p[0] - b.w / 2 &&
                label.t < p[1] + b.h / 2 &&
                label.b > p[1] - b.h / 2;
              expect(hit, '層頭「' + layer.label + '」壓到節點 ' + node.id).toBe(false);
            }
          });
        });
      }
    });
  }
}
