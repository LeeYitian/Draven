/**
 * 關係圖的純幾何（任務 T055）：座標正規化、比例還原、碰撞檢查、連線端點、自繪箭頭、線上文字位置。
 * 不依賴 React 與 DOM；元件只負責呼叫並把結果畫成 SVG／HTML。
 *
 * 為什麼不用 SVG marker 畫箭頭：畫線動畫是「終點插值」（終點從起點長到終點），
 * marker 的方向與位置在線還沒長完時會一起亂跑；自繪箭頭只在線畫完後淡入。
 */
export type Vec = readonly [number, number];
export interface Box {
  w: number;
  h: number;
}

export interface RawLayout {
  /** 設計時的畫布尺寸 */
  size: Vec;
  nodes: Readonly<Record<string, Vec>>;
}

// ── 座標：設計 px ↔ 比例 ↔ 實際 px ─────────────────────────────────
/** 設計座標 ÷ 畫布尺寸 → 0–1 比例（桌機與流式各自一組，任何容器尺寸都共用） */
export function normalizeLayout(layout: RawLayout): Record<string, Vec> {
  const [w, h] = layout.size;
  return Object.fromEntries(
    Object.entries(layout.nodes).map(([id, [x, y]]) => [id, [x / w, y / h] as const]),
  );
}

/** 比例 × 容器實際寬高 → 像素座標（相對容器左上） */
export function projectNodes(
  ratios: Readonly<Record<string, Vec>>,
  width: number,
  height: number,
): Record<string, Vec> {
  return Object.fromEntries(
    Object.entries(ratios).map(([id, [rx, ry]]) => [id, [rx * width, ry * height] as const]),
  );
}

// ── 節點尺寸 ──────────────────────────────────────────────────
/** 節點的名義尺寸（碰撞檢查與初始量測前使用；實際高度由元件量測，副標換行時會較高） */
export function nodeBox(mode: 'stage' | 'flow', containerWidth: number): Box {
  if (mode === 'stage') return { w: 120, h: 56 };
  // 流式：容器 ≥ 340 為 96，較窄為 88（字級同步縮小 15→14、12→11，見 layout 合約 §3）
  return { w: containerWidth >= 340 ? 96 : 88, h: 48 };
}

// ── 碰撞 ──────────────────────────────────────────────────────
const boxOf = (box: Box | Readonly<Record<string, Box>>, id: string): Box =>
  'w' in box && typeof box.w === 'number' ? (box as Box) : (box as Record<string, Box>)[id]!;

/** 兩個以中心點表示的矩形是否重疊（貼齊不算；gap 為要求保留的最小間距） */
export function findOverlaps(
  points: Readonly<Record<string, Vec>>,
  box: Box | Readonly<Record<string, Box>>,
  gap = 0,
): [string, string][] {
  const ids = Object.keys(points);
  const out: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!;
      const b = ids[j]!;
      const [ax, ay] = points[a]!;
      const [bx, by] = points[b]!;
      const ba = boxOf(box, a);
      const bb = boxOf(box, b);
      const overlapX = Math.abs(ax - bx) < (ba.w + bb.w) / 2 + gap;
      const overlapY = Math.abs(ay - by) < (ba.h + bb.h) / 2 + gap;
      if (overlapX && overlapY) out.push([a, b]);
    }
  }
  return out;
}

// ── 連線 ──────────────────────────────────────────────────────
/** 從矩形中心朝 toward 方向射出，與矩形邊界的交點 */
export function rectBoundary(center: Vec, box: Box, toward: Vec): Vec {
  const dx = toward[0] - center[0];
  const dy = toward[1] - center[1];
  if (dx === 0 && dy === 0) return center;
  const tx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  return [center[0] + dx * t, center[1] + dy * t];
}

export interface Endpoint {
  center: Vec;
  box: Box;
}
export interface Segment {
  start: Vec;
  end: Vec;
  length: number;
}

/** 兩個節點之間的直線：起訖都在節點邊界上，各向外留 gap。節點重疊到沒有空間時回傳 null */
export function edgeSegment(from: Endpoint, to: Endpoint, gap = 2): Segment | null {
  const a = rectBoundary(from.center, from.box, to.center);
  const b = rectBoundary(to.center, to.box, from.center);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  // 兩個邊界交點的方向和中心連線相反＝節點互相蓋住
  const cx = to.center[0] - from.center[0];
  const cy = to.center[1] - from.center[1];
  const along = dx * cx + dy * cy;
  const full = Math.hypot(dx, dy);
  if (along <= 0 || full <= gap * 2) return null;
  const ux = dx / full;
  const uy = dy / full;
  return {
    start: [a[0] + ux * gap, a[1] + uy * gap],
    end: [b[0] - ux * gap, b[1] - uy * gap],
    length: full - gap * 2,
  };
}

/** 終點插值：t=0 在 a，t=1 在 b（畫線動畫） */
export function lerpPoint(a: Vec, b: Vec, t: number): Vec {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** 實心三角箭頭：尖端在 tip，朝 from→tip 的方向；回傳 [尖端, 底左, 底右] */
export function arrowHead(tip: Vec, from: Vec, length = 9, width = 8): [Vec, Vec, Vec] {
  const dx = tip[0] - from[0];
  const dy = tip[1] - from[1];
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const bx = tip[0] - ux * length;
  const by = tip[1] - uy * length;
  const hw = width / 2;
  return [tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]];
}

/**
 * 線上文字的中心位置：近水平的線（|dy| ≤ 0.25|dx|）文字放在線上方 8px（設計稿的做法，
 * 避免蓋住兩端箭頭）；斜線與垂直線置中於中點（文字有 6px 白邊，視覺上「穿過」線）。
 * labelOffset 是作者對個別連線的微調（設計座標，直接疊加）。
 */
export function labelPosition(start: Vec, end: Vec, labelOffset: Vec = [0, 0]): Vec {
  const mx = (start[0] + end[0]) / 2;
  const my = (start[1] + end[1]) / 2;
  const dx = Math.abs(end[0] - start[0]);
  const dy = Math.abs(end[1] - start[1]);
  const lift = dy <= dx * 0.25 ? -8 : 0;
  return [mx + labelOffset[0], my + lift + labelOffset[1]];
}

/** 把線段沿自己的方向的「左側」平移 dist（兩條方向相反的平行線各移 +dist 就會分在兩側） */
export function offsetSegment(seg: Segment, dist: number): Segment {
  const dx = seg.end[0] - seg.start[0];
  const dy = seg.end[1] - seg.start[1];
  const d = Math.hypot(dx, dy) || 1;
  const nx = (-dy / d) * dist;
  const ny = (dx / d) * dist;
  return {
    start: [seg.start[0] + nx, seg.start[1] + ny],
    end: [seg.end[0] + nx, seg.end[1] + ny],
    length: seg.length,
  };
}
