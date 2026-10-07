/**
 * 伏筆框格的位置計算（任務 T090；contracts/layout-and-coordinates.md §5、research R8）。
 * 程式不知道文字會在哪一行：在畫面上對 [data-hint] 片語量測 getClientRects()，
 * 換成「敘述面板本地座標」後，框格 y 對齊錨點所在行，弧線從片語最後一行的末端連出。
 * 量測是純 DOM 讀取；防撞與弧線是純函式，可用假資料測試。
 */
import { localPoint } from '../../lib/localPoint';

export interface AnchorBox {
  id: string;
  /** 片語「最後一行」的右端（面板本地座標） */
  endX: number;
  lineTop: number;
  lineBottom: number;
  midY: number;
}

/** 量測面板內所有伏筆回收處（雙底線片語）。跨行片語取最後一個 rect＝片語末端。 */
export function measureAnchors(panel: HTMLElement): AnchorBox[] {
  const boxes: AnchorBox[] = [];
  for (const el of panel.querySelectorAll<HTMLElement>('[data-hint]')) {
    const rects = el.getClientRects();
    const last = rects[rects.length - 1];
    if (!last) continue;
    const bottom = localPoint(panel, last.right, last.bottom);
    const top = localPoint(panel, last.right, last.top);
    boxes.push({
      id: el.dataset.hint!,
      endX: bottom.x,
      lineTop: top.y,
      lineBottom: bottom.y,
      midY: (top.y + bottom.y) / 2,
    });
  }
  return boxes;
}

// ── 框格防撞 ─────────────────────────────────────────────────────
export interface SlotInput {
  id: string;
  /** 錨點所在行的中線（框格以它為中心對齊） */
  anchorMidY: number;
  /** 框格（含解開後說明）的實際高度 */
  height: number;
}

export interface SlotPlacement {
  id: string;
  /** 框格上緣 */
  y: number;
}

export const SLOT_GAP = 8;

/**
 * 框格 y：先對齊錨點所在行，再依 y 排序後防撞（後一個不得壓到前一個：y[i] ≥ y[i-1]＋高度＋間距）；
 * 最後一個若超出可用高度，整體上推（不得高過 minY）後再防撞一次。
 */
export function placeSlots(
  inputs: readonly SlotInput[],
  {
    minY = 0,
    maxY = Infinity,
    gap = SLOT_GAP,
  }: { minY?: number; maxY?: number; gap?: number } = {},
): SlotPlacement[] {
  const sorted = [...inputs].sort((a, b) => a.anchorMidY - b.anchorMidY);
  const ys = sorted.map((s) => Math.max(minY, s.anchorMidY - s.height / 2));
  const spread = () => {
    for (let i = 1; i < sorted.length; i++)
      ys[i] = Math.max(ys[i]!, ys[i - 1]! + sorted[i - 1]!.height + gap);
  };
  spread();
  const last = sorted.length - 1;
  if (last >= 0) {
    const overflow = ys[last]! + sorted[last]!.height - maxY;
    if (overflow > 0) {
      for (let i = 0; i <= last; i++) ys[i] = Math.max(minY, ys[i]! - overflow);
      spread();
    }
  }
  return sorted.map((s, i) => ({ id: s.id, y: ys[i]! }));
}

// ── 手繪感弧線 ───────────────────────────────────────────────────
/** 字串雜湊（穩定、可重現）：同一個 id 每次重畫的弧線完全相同 */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 由 id 決定的擾動，範圍 [-1, 1] */
export function jitter(id: string, salt: number): number {
  return ((hashString(`${id}:${salt}`) % 2001) - 1000) / 1000;
}

export interface Point {
  x: number;
  y: number;
}

const f = (n: number) => Number(n.toFixed(1));

/**
 * 弧線：起點貼在雙底線片語末端，沿行距往右走（微微起伏），到框格左側 24px 處，
 * 再以三次貝茲曲線彎向框格左緣中點。擾動只由 id 決定（手繪感，但每次都一樣）。
 * 起點與框格太近（< 40px）時只畫最後一段曲線。
 */
export function arcPath(start: Point, slotLeft: number, slotMidY: number, id: string): string {
  const end = { x: slotLeft, y: slotMidY };
  const runEnd = slotLeft - 24;
  const length = runEnd - start.x;
  if (length < 16) {
    return `M${f(start.x)} ${f(start.y)} C${f(start.x + 8)} ${f(start.y + 6)} ${f(end.x - 10)} ${f(end.y)} ${f(end.x)} ${f(end.y)}`;
  }
  const w1 = jitter(id, 1) * 2;
  const w2 = jitter(id, 2) * 2;
  const a = { x: start.x + length * 0.4, y: start.y + 5 + w1 };
  const b = { x: runEnd, y: start.y + 4 + w2 };
  return [
    `M${f(start.x)} ${f(start.y)}`,
    `C${f(start.x + 6)} ${f(start.y + 8)} ${f(a.x - 14)} ${f(a.y + 1)} ${f(a.x)} ${f(a.y)}`,
    `C${f(a.x + 20)} ${f(a.y - 2)} ${f(b.x - 22)} ${f(b.y + 2)} ${f(b.x)} ${f(b.y)}`,
    `C${f(b.x + 18)} ${f(b.y - 1)} ${f(end.x - 14)} ${f(end.y)} ${f(end.x)} ${f(end.y)}`,
  ].join(' ');
}

/** 同一行有多個錨點時，弧線起點 y 依序錯開 3px，避免疊在一起 */
export function staggerSameLine(anchors: readonly AnchorBox[]): Record<string, number> {
  const seen = new Map<number, number>();
  const offsets: Record<string, number> = {};
  for (const a of [...anchors].sort((p, q) => p.endX - q.endX)) {
    const lineKey = Math.round(a.lineBottom / 4);
    const n = seen.get(lineKey) ?? 0;
    offsets[a.id] = n * 3;
    seen.set(lineKey, n + 1);
  }
  return offsets;
}
