import { describe, expect, it } from 'vitest';
import { people } from '../../src/content';
import {
  AREA,
  CENTER_RECT,
  CENTER_SLOTS,
  COMPACT,
  assignCenter,
  labelPlacement,
  mergeRelations,
  othersLeft,
  rectsOverlap,
  type PairEdge,
  type Rect,
} from '../../src/features/people/center';
import {
  axesOf,
  centerLayoutAt,
  collectPairEdges,
  matchesFilter,
  relationsAt,
  selectedIds,
} from '../../src/features/people/model';

const order = Object.fromEntries(people.map((p) => [p.id, p.order]));
const ids = people.map((p) => p.id);

const edge = (a: string, b: string, label: string, kind: PairEdge['kind'], rank: number): PairEdge => ({
  a,
  b,
  label,
  kind,
  rank,
});

describe('mergeRelations（依無序配對合併）', () => {
  it('同一對人的多個關係以「・」串接（依出現順序、去重）；方向不影響配對', () => {
    const merged = mergeRelations(
      'elian',
      [
        edge('dravin', 'elian', '養父子', 'relation', 100),
        edge('elian', 'dravin', '照顧・引導', 'key', 205),
        edge('dravin', 'elian', '養父子', 'relation', 300),
      ],
      order,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ otherId: 'dravin', label: '養父子・照顧・引導', kind: 'key' });
  });

  it('線種取最高優先（本篇關鍵 > 關係 > 衝突）', () => {
    const a = mergeRelations('nor', [edge('nor', 'elian', 'x', 'conflict', 1), edge('nor', 'elian', 'y', 'relation', 2)], order);
    expect(a[0]!.kind).toBe('relation');
    const b = mergeRelations('nor', [edge('nor', 'elian', 'x', 'conflict', 1), edge('nor', 'elian', 'y', 'key', 2)], order);
    expect(b[0]!.kind).toBe('key');
  });

  it('不涉及中心的關係被忽略；順序＝線種優先度 → 出現順序 → 人物出場順序', () => {
    const merged = mergeRelations(
      'dravin',
      [
        edge('dravin', 'rumi', 'c', 'conflict', 100),
        edge('dravin', 'fane', 'r2', 'relation', 200),
        edge('dravin', 'elian', 'r1', 'relation', 100),
        edge('dravin', 'elis', 'k', 'key', 900),
        edge('rumi', 'nor', '無關', 'key', 1),
      ],
      order,
    );
    expect(merged.map((m) => m.otherId)).toEqual(['elis', 'elian', 'fane', 'rumi']);
  });

  it('同線種、同出現順序時，依人物出場順序穩定排序', () => {
    const merged = mergeRelations(
      'dravin',
      [edge('dravin', 'nor', 'a', 'relation', 5), edge('dravin', 'fane', 'b', 'relation', 5)],
      order,
    );
    expect(merged.map((m) => m.otherId)).toEqual(['fane', 'nor']); // fane 的 order 2 < nor 的 6
  });
});

describe('collectPairEdges（進度內的關係）', () => {
  it('只取兩端都是人物的連線（群體節點不算）；進度之後的主軸不取', () => {
    const at1 = collectPairEdges(1, [undefined], [], people);
    expect(at1).toEqual([]);
    const edges0 = relationsAt('dravin', 0);
    expect(edges0).toEqual([]); // 進度 0：沒有任何關係
  });

  it('01 的連線：德雷文—法恩（任命特使）出現在進度 1；德雷文—守舊貴族（群體）不出現', () => {
    const rel = relationsAt('dravin', 1);
    const fane = rel.find((r) => r.otherId === 'fane');
    expect(fane?.label).toContain('任命特使・遴選子弟');
    expect(rel.some((r) => r.otherId === 'old-nobles')).toBe(false);
  });

  it('跨主軸補充關係只在兩人都已登場時顯示（維洛 03 才登場：進度 1 看不到德雷文—維洛）', () => {
    expect(relationsAt('dravin', 1).some((r) => r.otherId === 'velo')).toBe(false);
    expect(relationsAt('dravin', 3).some((r) => r.otherId === 'velo')).toBe(true);
    expect(relationsAt('dravin', 1).some((r) => r.otherId === 'lioran')).toBe(false); // 利歐蘭 02 才登場
    expect(relationsAt('dravin', 2).some((r) => r.otherId === 'lioran')).toBe(true);
  });

  it('進度越高關係只增不減（累積）', () => {
    for (const p of people)
      for (let n = 0; n < 4; n++) {
        const lo = relationsAt(p.id, n).map((r) => r.otherId);
        const hi = relationsAt(p.id, n + 1).map((r) => r.otherId);
        for (const id of lo) expect(hi, `${p.id} ${n}→${n + 1}`).toContain(id);
      }
  });
});

describe('CENTER_SLOTS', () => {
  it('14 個，卡片都在 1344×540 內、彼此不重疊、不壓到中心卡', () => {
    expect(CENTER_SLOTS).toHaveLength(14);
    for (const s of CENTER_SLOTS) {
      expect(s.rect.w).toBe(COMPACT.w);
      expect(s.rect.h).toBe(COMPACT.h);
      expect(s.rect.x).toBeGreaterThanOrEqual(0);
      expect(s.rect.y).toBeGreaterThanOrEqual(0);
      expect(s.rect.x + s.rect.w).toBeLessThanOrEqual(AREA.width);
      expect(s.rect.y + s.rect.h).toBeLessThanOrEqual(AREA.height);
      expect(rectsOverlap(s.rect, CENTER_RECT), s.name).toBe(false);
    }
    for (let i = 0; i < 14; i++)
      for (let j = i + 1; j < 14; j++)
        expect(rectsOverlap(CENTER_SLOTS[i]!.rect, CENTER_SLOTS[j]!.rect), `${i}×${j}`).toBe(false);
  });

  it('折線都是水平／垂直線段，起點在中心卡邊緣、終點在該 slot 卡片的邊緣，全程在卡片區內', () => {
    const c = CENTER_RECT;
    for (const s of CENTER_SLOTS) {
      const route = s.route;
      for (let i = 0; i < route.length - 1; i++) {
        const p = route[i]!;
        const q = route[i + 1]!;
        expect(p.x === q.x || p.y === q.y, `${s.name} 第 ${i} 段要水平或垂直`).toBe(true);
      }
      for (const p of route) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(AREA.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(AREA.height);
      }
      const start = route[0]!;
      const onEdge =
        ((start.x === c.x || start.x === c.x + c.w) && start.y >= c.y && start.y <= c.y + c.h) ||
        ((start.y === c.y || start.y === c.y + c.h) && start.x >= c.x && start.x <= c.x + c.w);
      expect(onEdge, `${s.name} 起點在中心卡邊緣`).toBe(true);
      const end = route.at(-1)!;
      const r = s.rect;
      const touches =
        ((end.x === r.x || end.x === r.x + r.w) && end.y >= r.y && end.y <= r.y + r.h) ||
        ((end.y === r.y || end.y === r.y + r.h) && end.x >= r.x && end.x <= r.x + r.w);
      expect(touches, `${s.name} 終點在卡片邊緣`).toBe(true);
    }
  });

  it('折線不穿過其他關係人物的卡片（遠層線繞到卡片列外側）', () => {
    const through = (a: { x: number; y: number }, b: { x: number; y: number }, r: Rect) => {
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const y2 = Math.max(a.y, b.y);
      // 線段與矩形內部相交（貼邊不算）
      return x1 < r.x + r.w && x2 > r.x && y1 < r.y + r.h && y2 > r.y;
    };
    for (const s of CENTER_SLOTS)
      for (const other of CENTER_SLOTS) {
        if (other === s) continue;
        for (let i = 0; i < s.route.length - 1; i++)
          expect(
            through(s.route[i]!, s.route[i + 1]!, other.rect),
            `${s.name} 的線穿過 ${other.name}`,
          ).toBe(false);
      }
  });
});

describe('labelPlacement（線上文字）', () => {
  it('放在最長水平線段的中點、線上方 6px', () => {
    const l = labelPlacement(CENTER_SLOTS[0]!.route); // top-left：(448,212)→(448,90)→(374,90)
    expect(l.anchor).toBe('middle');
    expect(l.y).toBe(84);
    expect(l.x).toBe(411);
    const left1 = labelPlacement(CENTER_SLOTS[2]!.route);
    expect(left1).toMatchObject({ x: 338, y: 234, anchor: 'middle' }); // 與設計稿 C 一致
  });

  it('沒有夠長的水平線段時，放在垂直線段旁：中心右側靠右、左側靠左', () => {
    const bm = labelPlacement(CENTER_SLOTS[8]!.route); // bottom-mid 只有垂直線
    expect(bm.anchor).toBe('start');
    const br = labelPlacement(CENTER_SLOTS[5]!.route); // bottom-right：水平段都很短
    expect(br).toMatchObject({ anchor: 'start', x: 728 }); // 與設計稿 C「擋下黑水・立誓」位置一致
  });
});

describe('assignCenter（指派）', () => {
  const rel = (i: number) => ({ otherId: ids[i + 1]!, label: 'x', kind: 'relation' as const, rank: i });

  it('othersLeft：7 人以內 1 欄（x=1150）；8–14 人 2 欄', () => {
    expect(othersLeft(0)).toBe(1150);
    expect(othersLeft(7)).toBe(1150);
    expect(othersLeft(8)).toBe(972);
    expect(othersLeft(14)).toBe(972);
  });

  it('關係人數 0–14 全部情境：每人恰好出現一次、矩形不重疊、不超出卡片區（窮舉）', () => {
    for (let related = 0; related <= 14; related++) {
      const relations = Array.from({ length: related }, (_, i) => rel(i));
      const layout = assignCenter(ids[0]!, relations, ids);
      const placed = [layout.center, ...layout.ring, ...layout.others];
      expect(placed.map((p) => p.id).sort(), `關係 ${related} 人`).toEqual([...ids].sort());
      for (const p of placed) {
        expect(p.rect.x).toBeGreaterThanOrEqual(0);
        expect(p.rect.y).toBeGreaterThanOrEqual(0);
        expect(p.rect.x + p.rect.w, `${p.id} 右緣 @${related}`).toBeLessThanOrEqual(AREA.width);
        expect(p.rect.y + p.rect.h, `${p.id} 下緣 @${related}`).toBeLessThanOrEqual(AREA.height);
      }
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++)
          expect(
            rectsOverlap(placed[i]!.rect, placed[j]!.rect),
            `關係 ${related} 人：${placed[i]!.id} × ${placed[j]!.id}`,
          ).toBe(false);
      expect(layout.ring).toHaveLength(related);
      expect(layout.others).toHaveLength(14 - related);
      expect(layout.othersHeader === null).toBe(related === 14);
    }
  });

  it('依順序填入 slot：第 1 位在左上、第 2 位在右上；中心卡位置固定', () => {
    const layout = assignCenter(ids[0]!, [rel(0), rel(1)], ids);
    expect(layout.center.rect).toEqual(CENTER_RECT);
    expect(layout.ring[0]!.rect).toMatchObject({ x: 206, y: 60 });
    expect(layout.ring[1]!.rect).toMatchObject({ x: 724, y: 60 });
  });

  it('中心人物自己、不在名單中的 id 的關係都被忽略', () => {
    const layout = assignCenter(
      ids[0]!,
      [{ otherId: ids[0]!, label: 'self', kind: 'key', rank: 0 }, { otherId: 'ghost', label: 'g', kind: 'key', rank: 1 }],
      ids,
    );
    expect(layout.ring).toHaveLength(0);
    expect(layout.others).toHaveLength(14);
  });
});

describe('15 人 × 進度 0–4：真實資料的中心視角', () => {
  for (const person of people) {
    it(`${person.name}：進度 0–4 版面都合法（不重疊、不超出、無人遺漏）`, () => {
      for (let progress = 0; progress <= 4; progress++) {
        const layout = centerLayoutAt(person.id, progress);
        const placed = [layout.center, ...layout.ring, ...layout.others];
        expect(placed.map((p) => p.id).sort(), `${person.id}@${progress}`).toEqual([...ids].sort());
        for (const p of placed) {
          expect(p.rect.x).toBeGreaterThanOrEqual(0);
          expect(p.rect.x + p.rect.w).toBeLessThanOrEqual(AREA.width);
          expect(p.rect.y).toBeGreaterThanOrEqual(0);
          expect(p.rect.y + p.rect.h).toBeLessThanOrEqual(AREA.height);
        }
        for (let i = 0; i < placed.length; i++)
          for (let j = i + 1; j < placed.length; j++)
            expect(rectsOverlap(placed[i]!.rect, placed[j]!.rect), `${person.id}@${progress}`).toBe(false);
      }
    });
  }

  it('進度 0（00 或直接進入人物誌）：沒有任何關係，14 人全部在右側', () => {
    for (const p of people) {
      const layout = centerLayoutAt(p.id, 0);
      expect(layout.ring).toHaveLength(0);
      expect(layout.others).toHaveLength(14);
    }
  });
});

describe('篩選標籤', () => {
  it('群體、關係標籤：依人物資料比對（含未登場者）', () => {
    const royal = selectedIds('group:royal');
    expect([...royal].sort()).toEqual(
      people.filter((p) => p.group === 'royal').map((p) => p.id).sort(),
    );
    const family = selectedIds('tag:family');
    expect(family.has('dravin')).toBe(true);
    expect(selectedIds(null).size).toBe(0);
  });

  it('主軸標籤：各主軸事件參與者的聯集（01：德雷文、法恩、艾莉絲、艾利安、布倫、露米、諾爾）', () => {
    expect(axesOf('fane')).toContain(1);
    expect(axesOf('velo')).not.toContain(1);
    const axis1 = selectedIds('axis:1');
    for (const id of ['dravin', 'fane', 'elis', 'elian', 'bren', 'rumi', 'nor']) expect(axis1.has(id)).toBe(true);
    expect(axis1.has('velo')).toBe(false);
    expect(matchesFilter(people[0]!, 'unknown:x')).toBe(false);
  });
});
