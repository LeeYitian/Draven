import { describe, expect, it } from 'vitest';
import {
  COLLAPSED_HEIGHT,
  collapseTargets,
  headerAnchor,
  layoutLayers,
  naturalBands,
  toggleOnly,
} from '../../src/features/graph/layers';
import type { Vec } from '../../src/features/graph/layout';

// 三層：人間（兩列 4 個節點）、地底交界（2 個）、異界（1 個）；畫布高 457、節點高 56
const LAYERS = [
  { id: 'human', nodes: ['a', 'b', 'c', 'd'] },
  { id: 'border', nodes: ['e', 'f'] },
  { id: 'other', nodes: ['g'] },
];
const POS: Record<string, Vec> = {
  a: [100, 60],
  b: [300, 60],
  c: [100, 130],
  d: [300, 130],
  e: [150, 250],
  f: [350, 250],
  g: [250, 400],
};
const H = 457;
const boxOf = () => ({ w: 120, h: 56 });
const layout = (collapse: Record<string, number> = {}) =>
  layoutLayers({ layers: LAYERS, positions: POS, boxOf, height: H, collapse });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('naturalBands：展開時各層的帶狀區域', () => {
  const bands = naturalBands(LAYERS, POS, boxOf, H);
  it('第一層從 0、最後一層到畫布底；相鄰兩層無縫相接', () => {
    expect(bands[0]!.top).toBe(0);
    expect(bands[2]!.bottom).toBe(H);
    expect(bands[0]!.bottom).toBe(bands[1]!.top);
    expect(bands[1]!.bottom).toBe(bands[2]!.top);
  });
  it('分界在兩層內容的中點：人間最下緣 158、地底最上緣 222 → 190', () => {
    expect(bands[0]!.bottom).toBe((130 + 28 + (250 - 28)) / 2);
  });
});

describe('layoutLayers', () => {
  it('沒有收合：節點停在作者寫的位置，層高加起來等於畫布高', () => {
    const l = layout();
    expect(l.positions).toEqual(POS);
    expect(sum(l.bands.map((b) => b.height))).toBeCloseTo(H, 6);
    expect(l.bands.map((b) => b.t)).toEqual([0, 0, 0]);
  });

  it('收合一層：該層高 46、節點收進層中心；其他層依原本比例分到剩下的高度，總高不變', () => {
    const open = layout();
    const l = layout({ other: 1 });
    expect(l.bands[2]!.height).toBe(COLLAPSED_HEIGHT);
    expect(sum(l.bands.map((b) => b.height))).toBeCloseTo(H, 6);
    const ratio = (b: { height: number }[]) => b[0]!.height / b[1]!.height;
    expect(ratio(l.bands)).toBeCloseTo(ratio(open.bands), 6);
    // 收合層的節點在層中心
    expect(l.positions.g![1]).toBeCloseTo(l.bands[2]!.top + COLLAPSED_HEIGHT / 2, 6);
    // 展開層仍包含自己的節點（沒有跑出帶狀區域）
    for (const id of ['a', 'e']) {
      const layerIndex = id === 'a' ? 0 : 1;
      const b = l.bands[layerIndex]!;
      expect(l.positions[id]![1]).toBeGreaterThan(b.top);
      expect(l.positions[id]![1]).toBeLessThan(b.top + b.height);
    }
    // x 不變
    expect(l.positions.a![0]).toBe(100);
  });

  it('「只看地底」：人間與異界收合，地底交界的節點被推到畫布中央', () => {
    const l = layout({ human: 1, other: 1 });
    expect(l.bands[0]!.height).toBe(COLLAPSED_HEIGHT);
    expect(l.bands[2]!.height).toBe(COLLAPSED_HEIGHT);
    expect(l.bands[1]!.height).toBeCloseTo(H - 2 * COLLAPSED_HEIGHT, 6);
    // 地底交界兩個節點的內容中心就是它們的 y（250）→ 放到層中心
    expect(l.positions.e![1]).toBeCloseTo(l.bands[1]!.top + l.bands[1]!.height / 2, 6);
    expect(l.positions.f![1]).toBeCloseTo(l.positions.e![1], 6);
  });

  it('動畫中途（t 在 0 與 1 之間）每一格都是合法版面：總高不變、層高單調', () => {
    let previous = layout().bands[2]!.height;
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const l = layout({ other: t });
      expect(sum(l.bands.map((b) => b.height))).toBeCloseTo(H, 6);
      expect(l.bands[2]!.height).toBeLessThan(previous + 1e-9);
      previous = l.bands[2]!.height;
    }
    expect(layout({ other: 0.5 }).bands[2]!.t).toBe(0.5);
  });

  it('全部收合時仍不產生 NaN', () => {
    const l = layout({ human: 1, border: 1, other: 1 });
    for (const p of Object.values(l.positions)) expect(Number.isFinite(p[1])).toBe(true);
  });

  it('記錄每個節點所在的層', () => {
    expect(layout().layerOf).toMatchObject({ a: 'human', e: 'border', g: 'other' });
  });
});

describe('collapseTargets／toggleOnly', () => {
  it('布林 → t 目標值', () => {
    expect(collapseTargets(LAYERS, { other: true })).toEqual({ human: 0, border: 0, other: 1 });
  });
  it('只看某層：其他層收合；再切一次全部展開', () => {
    const once = toggleOnly(LAYERS, {}, 'border');
    expect(once).toEqual({ human: true, border: false, other: true });
    expect(toggleOnly(LAYERS, once, 'border')).toEqual({
      human: false,
      border: false,
      other: false,
    });
  });
  it('已有部分收合時，「只看某層」先成為只看該層', () => {
    expect(toggleOnly(LAYERS, { other: true }, 'border')).toEqual({
      human: true,
      border: false,
      other: true,
    });
    expect(toggleOnly(LAYERS, { border: true }, 'border')).toEqual({
      human: true,
      border: false,
      other: true,
    });
  });
});

describe('headerAnchor：連到已收合層的線改連層頭邊緣', () => {
  const band = { top: 300, height: 46 };
  it('另一端在上方：連到層頭上緣；在下方：連到下緣；x 沿用節點', () => {
    expect(headerAnchor(band, 250, 100)).toEqual([250, 300]);
    expect(headerAnchor(band, 250, 400)).toEqual([250, 346]);
  });
});
