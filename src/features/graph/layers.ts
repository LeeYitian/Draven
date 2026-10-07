/**
 * 分層關係圖的純幾何（02 的「長生者／凡人」分區、03 的「人間／地底交界／異界」三層）。
 *
 * 作者在內容檔只寫「展開狀態」的節點座標；各層的帶狀區域由它推出來：
 * 相鄰兩層之間的分界＝上一層最下緣與下一層最上緣的中點。沒有收合時，節點就停在作者寫的位置。
 *
 * 收合（只有 03）：收合的層高度變成 COLLAPSED_HEIGHT、節點隱藏；剩下的高度由展開的層依原本的高度比例分配，
 * 展開層裡的節點跟著所在層的中心移動（「重新垂直置中」）。
 * collapse 以 0–1 的「收合程度」t 表示，300ms 動畫就是 t 在 0 與 1 之間插值，中途的每一格都是合法的版面。
 */
import type { Box, Vec } from './layout';

export const COLLAPSED_HEIGHT = 46;
/** 「只看地底」要留下的那一層（03 的「地底交界」） */
export const UNDERGROUND_LAYER = 'border';

export interface LayerInput {
  id: string;
  nodes: readonly string[];
}

export interface LayerBand {
  id: string;
  /** 帶狀區域在畫布上的位置與高度 */
  top: number;
  height: number;
  /** 收合程度：0＝完全展開，1＝完全收合 */
  t: number;
}

export interface LayeredLayout {
  bands: LayerBand[];
  /** 套用收合後的節點中心 */
  positions: Record<string, Vec>;
  /** 節點所在層的 id */
  layerOf: Record<string, string>;
}

interface Natural {
  id: string;
  /** 展開時的帶狀區域（上緣、下緣） */
  top: number;
  bottom: number;
  center: number;
  /** 節點內容（上下緣）的中心；收合時節點以它為準置中 */
  contentCenter: number;
}

/** 展開狀態下各層的帶狀區域；節點的上下緣取自 boxOf，分界取兩層內容的中點 */
export function naturalBands(
  layers: readonly LayerInput[],
  positions: Readonly<Record<string, Vec>>,
  boxOf: (id: string) => Box,
  height: number,
): Natural[] {
  const content = layers.map((layer) => {
    let top = Infinity;
    let bottom = -Infinity;
    for (const id of layer.nodes) {
      const p = positions[id];
      if (!p) continue;
      const h = boxOf(id).h;
      top = Math.min(top, p[1] - h / 2);
      bottom = Math.max(bottom, p[1] + h / 2);
    }
    return { id: layer.id, top, bottom };
  });
  return content.map((c, i) => {
    const top = i === 0 ? 0 : (content[i - 1]!.bottom + c.top) / 2;
    const bottom = i === content.length - 1 ? height : (c.bottom + content[i + 1]!.top) / 2;
    return {
      id: c.id,
      top,
      bottom,
      center: (top + bottom) / 2,
      contentCenter: (c.top + c.bottom) / 2,
    };
  });
}

/**
 * 依各層的收合程度 t（0–1）排版。
 * 第 i 層高度 h_i = 46·t_i + (1−t_i)·k·natural_i，k 使所有層的高度剛好填滿畫布。
 */
export function layoutLayers(params: {
  layers: readonly LayerInput[];
  positions: Readonly<Record<string, Vec>>;
  boxOf: (id: string) => Box;
  height: number;
  collapse: Readonly<Record<string, number>>;
}): LayeredLayout {
  const { layers, positions, boxOf, height, collapse } = params;
  const natural = naturalBands(layers, positions, boxOf, height);
  const t = natural.map((n) => Math.min(1, Math.max(0, collapse[n.id] ?? 0)));
  const expandedWeight = natural.reduce((sum, n, i) => sum + (1 - t[i]!) * (n.bottom - n.top), 0);
  const free = height - t.reduce((sum, ti) => sum + COLLAPSED_HEIGHT * ti, 0);
  const k = expandedWeight > 0 ? free / expandedWeight : 1;

  const bands: LayerBand[] = [];
  let cursor = 0;
  natural.forEach((n, i) => {
    const h = COLLAPSED_HEIGHT * t[i]! + (1 - t[i]!) * k * (n.bottom - n.top);
    bands.push({ id: n.id, top: cursor, height: h, t: t[i]! });
    cursor += h;
  });

  // 完全展開時節點停在作者的位置（參考點＝展開時的層中心）；一有層收合，參考點就漸漸移到「內容中心」，
  // 讓節點在放大後的層裡垂直置中。m 是目前最大的收合程度，所以動畫中途也是連續的。
  const m = Math.max(0, ...t);
  const out: Record<string, Vec> = {};
  const layerOf: Record<string, string> = {};
  layers.forEach((layer, i) => {
    const band = bands[i]!;
    const center = band.top + band.height / 2;
    for (const id of layer.nodes) {
      const p = positions[id];
      if (!p) continue;
      layerOf[id] = layer.id;
      // 展開時：沿用作者的位置相對於層中心的偏移；收合時偏移縮到 0（節點收進層頭）
      const n = natural[i]!;
      const reference = n.center + (n.contentCenter - n.center) * m;
      out[id] = [p[0], center + (p[1] - reference) * (1 - band.t)];
    }
  });
  return { bands, positions: out, layerOf };
}

/** 收合目標（布林）→ 各層的 t 目標值 */
export const collapseTargets = (
  layers: readonly LayerInput[],
  collapsed: Readonly<Record<string, boolean>>,
): Record<string, number> => Object.fromEntries(layers.map((l) => [l.id, collapsed[l.id] ? 1 : 0]));

/**
 * 「只看地底」：把其他層全部收合，只留 keep 那一層；再按一次（已經是這個狀態）就全部展開。
 */
/** 目前是不是「只看 keep 這一層」：只有 keep 展開、其餘全部收合 */
export function isOnly(
  layers: readonly LayerInput[],
  collapsed: Readonly<Record<string, boolean>>,
  keep: string,
): boolean {
  return layers.every((l) => (l.id === keep ? !collapsed[l.id] : !!collapsed[l.id]));
}

/**
 * 「只看地底」：把其他層全部收合，只留 keep 那一層；再按一次（已經是這個狀態）就全部展開。
 */
export function toggleOnly(
  layers: readonly LayerInput[],
  collapsed: Readonly<Record<string, boolean>>,
  keep: string,
): Record<string, boolean> {
  const only = isOnly(layers, collapsed, keep);
  return Object.fromEntries(layers.map((l) => [l.id, only ? false : l.id !== keep]));
}

/**
 * 一條連到「已收合層」的線，改連到層頭邊緣：
 * 回傳（在收合層裡的）錨點——x 沿用該節點原本的 x，y 取層頭面向另一端的邊緣。
 */
export function headerAnchor(
  band: Pick<LayerBand, 'top' | 'height'>,
  nodeX: number,
  otherY: number,
): Vec {
  const mid = band.top + band.height / 2;
  return [nodeX, otherY < mid ? band.top : band.top + band.height];
}
