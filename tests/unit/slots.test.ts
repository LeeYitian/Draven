import { describe, expect, it } from 'vitest';
import { people } from '../../src/content';
import { GROUP_IDS, WORLD_IDS } from '../../src/content/schema';
import {
  GRID_SLOTS,
  GRID_SLOT_COUNT,
  arrangeByGroup,
  arrangeByOrder,
  arrangeByWorld,
  headingPosition,
  slotPosition,
  type Arrangement,
} from '../../src/features/people/slots';

describe('GRID_SLOTS（5 欄 × 4 列）', () => {
  it('共 20 個，座標＝舞台 (48+欄×274, 188+列×128) 換成卡片區本地座標', () => {
    expect(GRID_SLOT_COUNT).toBe(20);
    expect(GRID_SLOTS).toHaveLength(20);
    expect(slotPosition(0)).toEqual({ x: 0, y: 36 });
    expect(slotPosition(3)).toEqual({ x: 0, y: 36 + 3 * 128 });
    expect(slotPosition(4)).toEqual({ x: 274, y: 36 });
    expect(slotPosition(19)).toEqual({ x: 4 * 274, y: 36 + 3 * 128 });
  });

  it('標準卡 248×116 放進任何 slot 都在卡片區 1344×540 內，且 slot 之間不重疊', () => {
    for (const s of GRID_SLOTS) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.x + 248).toBeLessThanOrEqual(1344);
      expect(s.y + 116).toBeLessThanOrEqual(540);
    }
    for (let i = 0; i < 20; i++)
      for (let j = i + 1; j < 20; j++) {
        const a = GRID_SLOTS[i]!;
        const b = GRID_SLOTS[j]!;
        const overlap = a.x < b.x + 248 && b.x < a.x + 248 && a.y < b.y + 116 && b.y < a.y + 116;
        expect(overlap, `${i} × ${j}`).toBe(false);
      }
  });

  it('欄標題在欄頂端、與卡片同一個左緣', () => {
    expect(headingPosition(0)).toEqual({ x: 0, y: 0 });
    expect(headingPosition(3)).toEqual({ x: 3 * 274, y: 0 });
  });
});

function expectValid(arr: Arrangement) {
  const ids = people.map((p) => p.id).sort();
  expect(Object.keys(arr.slots).sort()).toEqual(ids); // 15 人都有 slot
  const used = Object.values(arr.slots);
  expect(new Set(used).size).toBe(used.length); // 沒有兩人共用一個 slot
  for (const slot of used) {
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThan(20); // 都在 5×4 之內
  }
}

describe('排列：依群體', () => {
  const arr = arrangeByGroup(people, GROUP_IDS);

  it('15 人都在 5×4 內、不重複', () => expectValid(arr));

  it('一個群體一欄，欄內依出場順序；欄標題數量正確', () => {
    expect(arr.headings.map((h) => [h.key, h.column, h.count])).toEqual([
      ['royal', 0, 4],
      ['coven', 1, 4],
      ['cult', 2, 3],
      ['centaur', 3, 2],
      ['deity', 4, 2],
    ]);
    const royal = people.filter((p) => p.group === 'royal').sort((a, b) => a.order - b.order);
    royal.forEach((p, row) => expect(arr.slots[p.id]).toBe(row));
    for (const p of people) {
      const column = GROUP_IDS.indexOf(p.group);
      expect(Math.floor(arr.slots[p.id]! / 4)).toBe(column);
    }
  });
});

describe('排列：依出場順序', () => {
  const arr = arrangeByOrder(people);

  it('15 人都在 5×4 內、不重複，沒有欄標題', () => {
    expectValid(arr);
    expect(arr.headings).toEqual([]);
  });

  it('由左而右、由上而下：第 1–5 位在第一列，第 6 位回到最左欄第二列', () => {
    const sorted = [...people].sort((a, b) => a.order - b.order);
    const pos = (id: string) => slotPosition(arr.slots[id]!);
    expect(pos(sorted[0]!.id)).toEqual({ x: 0, y: 36 });
    expect(pos(sorted[4]!.id)).toEqual({ x: 4 * 274, y: 36 });
    expect(pos(sorted[5]!.id)).toEqual({ x: 0, y: 36 + 128 });
    expect(pos(sorted[14]!.id)).toEqual({ x: 4 * 274, y: 36 + 2 * 128 });
  });
});

describe('排列：依所在世界（G-18：起始世界）', () => {
  const arr = arrangeByWorld(people, WORLD_IDS);

  it('15 人都在 5×4 內、不重複', () => expectValid(arr));

  it('人間 12 人佔 3 欄；地底交界、異界各接在後面；欄標題掛在各世界第一欄', () => {
    const count = (w: string) => people.filter((p) => p.world === w).length;
    expect(count('human')).toBe(12);
    expect(arr.headings).toEqual([
      { key: 'human', column: 0, count: 12 },
      { key: 'underground', column: 3, count: 2 },
      { key: 'otherworld', column: 4, count: 1 },
    ]);
    for (const p of people.filter((q) => q.world === 'human'))
      expect(Math.floor(arr.slots[p.id]! / 4)).toBeLessThan(3);
    for (const p of people.filter((q) => q.world === 'otherworld'))
      expect(Math.floor(arr.slots[p.id]! / 4)).toBe(4);
  });

  it('資料改動時也能容納：世界人數不整除 4 時，下一個世界從下一欄開始', () => {
    const fake = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`,
      group: 'g',
      order: i + 1,
      world: 'human',
    })).concat([{ id: 'u', group: 'g', order: 9, world: 'underground' }]);
    const a = arrangeByWorld(fake, ['human', 'underground']);
    expect(a.headings.map((h) => h.column)).toEqual([0, 2]); // 5 人佔 2 欄
    expect(a.slots['u']).toBe(2 * 4);
  });
});
