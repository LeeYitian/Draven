import { describe, expect, it } from 'vitest';
import { TREE, layoutFlowTree, type TreeCell } from '../../src/features/people/flowTree';

interface R {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlap = (a: R, b: R) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** 把 path（M／V／C）取樣成一串點 */
function sample(path: string, steps = 40): { x: number; y: number }[] {
  const tokens = path.match(/[MVC]|-?\d+(?:\.\d+)?/g)!;
  const pts: { x: number; y: number }[] = [];
  let i = 0;
  let cur = { x: 0, y: 0 };
  while (i < tokens.length) {
    const cmd = tokens[i++]!;
    if (cmd === 'M') {
      cur = { x: +tokens[i++]!, y: +tokens[i++]! };
      pts.push(cur);
    } else if (cmd === 'V') {
      const y = +tokens[i++]!;
      for (let s = 1; s <= steps; s++) pts.push({ x: cur.x, y: cur.y + ((y - cur.y) * s) / steps });
      cur = { x: cur.x, y };
    } else {
      const [x1, y1, x2, y2, x, y] = [0, 1, 2, 3, 4, 5].map(() => +tokens[i++]!);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        pts.push({
          x: u ** 3 * cur.x + 3 * u * u * t * x1! + 3 * u * t * t * x2! + t ** 3 * x!,
          y: u ** 3 * cur.y + 3 * u * u * t * y1! + 3 * u * t * t * y2! + t ** 3 * y!,
        });
      }
      cur = { x: x!, y: y! };
    }
  }
  return pts;
}

const cardRect = (c: TreeCell, w: number): R => ({ x: c.x, y: c.cardTop, w, h: TREE.cardH });
const pillRect = (c: TreeCell, w: number): R => ({ x: c.x, y: c.pillTop, w, h: TREE.pillH });

describe('layoutFlowTree（手機版人物中心：標籤掛在卡上、線連到標籤）', () => {
  it('寬 342、9 人：與設計稿一致（上 4 下 5；上半區高 330；卡寬 160、欄距 22）', () => {
    const tree = layoutFlowTree(9, 342);
    expect(tree.cardW).toBe(160);
    expect(tree.upHeight).toBe(330);
    expect(tree.cells.filter((c) => c.group === 'up')).toHaveLength(4);
    expect(tree.cells.filter((c) => c.group === 'down')).toHaveLength(5);
    const up = tree.cells.filter((c) => c.group === 'up');
    expect(up.map((c) => c.cardTop).sort((a, b) => a - b)).toEqual([20, 20, 150, 150]); // 設計稿 20／150
    const down = tree.cells.filter((c) => c.group === 'down');
    expect(down.map((c) => c.pillTop).sort((a, b) => a - b)).toEqual([40, 40, 160, 160, 280]); // 460／580／700 − 420
    const last = down.find((c) => c.centered)!;
    expect(last.x).toBe(91); // 最後一個置中
    expect(last.path).toBe('M171 0 V280'); // 設計稿「M171 420 V700」
  });

  it('越前面（優先順序越高）的人越靠近中心；上下輪流分配', () => {
    const tree = layoutFlowTree(9, 342);
    expect(tree.cells.slice(0, 4).map((c) => [c.group, c.row])).toEqual([
      ['down', 0],
      ['up', 0],
      ['down', 0],
      ['up', 0],
    ]);
    expect(tree.cells[8]!.group).toBe('down');
    expect(tree.cells[8]!.row).toBe(2);
  });

  it('0 人：沒有半區；1 人：只有下半區且置中', () => {
    expect(layoutFlowTree(0, 342)).toMatchObject({ cells: [], upHeight: 0, downHeight: 0 });
    const one = layoutFlowTree(1, 342);
    expect(one.upHeight).toBe(0);
    expect(one.cells[0]).toMatchObject({ group: 'down', centered: true });
  });

  for (const width of [272, 296, 342, 480, 592]) {
    it(`寬 ${width}、關係 0–14 人：所有卡片與膠囊都在容器內、互不重疊；膠囊在卡片朝向中心的那一側`, () => {
      for (let n = 0; n <= 14; n++) {
        const tree = layoutFlowTree(n, width);
        const rects: { id: string; group: string; r: R }[] = [];
        for (const c of tree.cells) {
          rects.push({ id: `${c.index}c`, group: c.group, r: cardRect(c, tree.cardW) });
          rects.push({ id: `${c.index}p`, group: c.group, r: pillRect(c, tree.cardW) });
          const h = c.group === 'up' ? tree.upHeight : tree.downHeight;
          for (const r of [cardRect(c, tree.cardW), pillRect(c, tree.cardW)]) {
            expect(r.x).toBeGreaterThanOrEqual(-0.01);
            expect(r.x + r.w).toBeLessThanOrEqual(width + 0.01);
            expect(r.y).toBeGreaterThanOrEqual(0);
            expect(r.y + r.h, `n=${n} #${c.index}`).toBeLessThanOrEqual(h);
          }
          // 上半區：膠囊在卡片下方（朝向中心）；下半區：膠囊在卡片上方
          if (c.group === 'up') expect(c.pillTop).toBeGreaterThan(c.cardTop);
          else expect(c.pillTop).toBeLessThan(c.cardTop);
        }
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++)
            if (rects[i]!.group === rects[j]!.group)
              expect(overlap(rects[i]!.r, rects[j]!.r), `n=${n} ${rects[i]!.id}×${rects[j]!.id}`).toBe(false);
      }
    });

    it(`寬 ${width}：每條線從中心卡邊緣出發（上半區在底邊、下半區在頂邊）、在中心卡寬 200 之內，終點落在自己膠囊的邊緣上`, () => {
      for (let n = 1; n <= 14; n++) {
        const tree = layoutFlowTree(n, width);
        for (const c of tree.cells) {
          const pts = sample(c.path);
          const start = pts[0]!;
          const end = pts.at(-1)!;
          expect(start.y).toBe(c.group === 'up' ? tree.upHeight : 0);
          expect(Math.abs(start.x - tree.centerX), `n=${n} #${c.index}`).toBeLessThanOrEqual(100);
          const p = pillRect(c, tree.cardW);
          const onPill =
            end.x >= p.x - 0.5 &&
            end.x <= p.x + p.w + 0.5 &&
            end.y >= p.y - 0.5 &&
            end.y <= p.y + p.h + 0.5;
          expect(onPill, `n=${n} #${c.index} 終點在膠囊上`).toBe(true);
          // 全程在所屬半區內
          const h = c.group === 'up' ? tree.upHeight : tree.downHeight;
          for (const q of pts) {
            expect(q.x).toBeGreaterThanOrEqual(-0.5);
            expect(q.x).toBeLessThanOrEqual(width + 0.5);
            expect(q.y).toBeGreaterThanOrEqual(-0.5);
            expect(q.y).toBeLessThanOrEqual(h + 0.5);
          }
        }
      }
    });

    it(`寬 ${width}：線不穿過別人的卡片或膠囊，也不穿過自己的卡片`, () => {
      for (let n = 1; n <= 14; n++) {
        const tree = layoutFlowTree(n, width);
        for (const c of tree.cells) {
          const pts = sample(c.path, 60);
          for (const other of tree.cells) {
            if (other.group !== c.group) continue;
            const own = other.index === c.index;
            const boxes = own
              ? [cardRect(other, tree.cardW)]
              : [cardRect(other, tree.cardW), pillRect(other, tree.cardW)];
            for (const b of boxes)
              for (const q of pts) {
                // 內縮 1px：線貼著邊緣不算穿過
                const inside = q.x > b.x + 1 && q.x < b.x + b.w - 1 && q.y > b.y + 1 && q.y < b.y + b.h - 1;
                expect(inside, `n=${n} 線#${c.index} 穿過 #${other.index}`).toBe(false);
              }
          }
        }
      }
    }, 30_000);
  }

  it('同一半區內不同列的中縫線各自錯開（不重疊）', () => {
    const tree = layoutFlowTree(14, 342);
    const gutterXs = tree.cells
      .filter((c) => c.group === 'down' && c.row >= 1 && !c.centered)
      .map((c) => `${c.col}:${c.path.split(' ')[0]}`);
    expect(new Set(gutterXs).size).toBe(gutterXs.length);
  });
});
