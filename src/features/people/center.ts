/**
 * 人物中心視角（任務 T079，G-17／research R14）：關係合併、環繞 slot 指派與直角折線。
 * 純函式，不依賴 React 或 DOM；所有座標是「卡片區」（1344×540）的本地座標。
 *
 * 版面（取自設計稿 C，推廣成固定 slot 表）：
 * - 中心卡 248×116 固定在 (436, 212)。
 * - 有關係的人物改為精簡卡 168×60，依優先順序放進 14 個環繞 slot（上、左、右、下，近／遠兩層）。
 * - 沒有直接關係的人物疊在右側，7 個一欄（超過 7 個時 2 欄），透明度 0.7。
 * - 前 6 個 slot 都在 x ≤ 928，所以「沒有關係」需要 2 欄（≥ 8 人）時，環繞人物（≤ 6 人）不會撞上。
 */
import type { Point } from './slots';

export type RelationKind = 'key' | 'relation' | 'conflict';

/** 線種優先度：本篇關鍵 > 關係 > 衝突（數字小的優先） */
export const KIND_PRIORITY: Record<RelationKind, number> = { key: 0, relation: 1, conflict: 2 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const AREA = { width: 1344, height: 540 } as const;
export const CENTER_RECT: Rect = { x: 436, y: 212, w: 248, h: 116 };
export const COMPACT = { w: 168, h: 60 } as const;
export const OTHERS = { perColumn: 7, gapY: 10, columnGap: 10, headerY: 30, firstY: 60, rightMargin: 26 };

// ── 關係合併 ─────────────────────────────────────────────────────

/** 一條「人與人」的關係（來自各主軸的連線或跨主軸補充關係） */
export interface PairEdge {
  a: string;
  b: string;
  label: string;
  kind: RelationKind;
  /** 排序用：越小越早出現（主軸×100＋事件序；補充關係放最後） */
  rank: number;
}

export interface MergedRelation {
  otherId: string;
  /** 同一對人的多個關係文字以「・」串接（去重，依出現順序） */
  label: string;
  /** 同一對人取優先度最高的線種 */
  kind: RelationKind;
  rank: number;
}

/**
 * 以 centerId 為中心，把所有涉及他的關係依「對象」合併，並排好指派順序：
 * 線種優先度 → 出現順序 → 人物出場順序（穩定）。
 */
export function mergeRelations(
  centerId: string,
  edges: readonly PairEdge[],
  personOrder: Readonly<Record<string, number>>,
): MergedRelation[] {
  const byOther = new Map<string, PairEdge[]>();
  for (const edge of edges) {
    if (edge.a !== centerId && edge.b !== centerId) continue;
    const other = edge.a === centerId ? edge.b : edge.a;
    if (other === centerId) continue;
    const list = byOther.get(other) ?? [];
    list.push(edge);
    byOther.set(other, list);
  }
  const merged: MergedRelation[] = [];
  for (const [otherId, list] of byOther) {
    const sorted = [...list].sort((x, y) => x.rank - y.rank);
    const labels: string[] = [];
    for (const e of sorted) if (!labels.includes(e.label)) labels.push(e.label);
    merged.push({
      otherId,
      label: labels.join('・'),
      kind: sorted.reduce<RelationKind>(
        (best, e) => (KIND_PRIORITY[e.kind] < KIND_PRIORITY[best] ? e.kind : best),
        sorted[0]!.kind,
      ),
      rank: sorted[0]!.rank,
    });
  }
  return merged.sort(
    (x, y) =>
      KIND_PRIORITY[x.kind] - KIND_PRIORITY[y.kind] ||
      x.rank - y.rank ||
      (personOrder[x.otherId] ?? 0) - (personOrder[y.otherId] ?? 0),
  );
}

// ── 環繞 slot ───────────────────────────────────────────────────

export interface CenterSlot {
  name: string;
  rect: Rect;
  /** 折線：從中心卡邊緣出發，最後一點在關係人物卡的邊緣（畫小圓點） */
  route: readonly Point[];
}

const slot = (name: string, x: number, y: number, route: readonly [number, number][]): CenterSlot => ({
  name,
  rect: { x, y, ...COMPACT },
  route: route.map(([px, py]) => ({ x: px, y: py })),
});

/**
 * 14 個環繞 slot，依「填入順序」排列：近層先、前 6 個都不碰右側（見檔頭說明）。
 * 路線的設計原則：同一邊的線各走自己的垂直通道、互不交叉；遠層線繞到卡片列的外側
 * （上方 y=30、下方 y=515／528）再轉進卡片。
 */
export const CENTER_SLOTS: readonly CenterSlot[] = [
  slot('top-left', 206, 60, [[448, 212], [448, 90], [374, 90]]),
  slot('top-right', 724, 60, [[600, 212], [600, 90], [724, 90]]),
  slot('left-1', 30, 150, [[436, 240], [240, 240], [240, 180], [198, 180]]),
  slot('left-2', 30, 300, [[436, 275], [240, 275], [240, 330], [198, 330]]),
  slot('bottom-left', 190, 420, [[440, 328], [440, 450], [358, 450]]),
  slot('bottom-right', 760, 420, [[684, 310], [720, 310], [720, 450], [760, 450]]),
  slot('right-1', 930, 150, [[684, 240], [900, 240], [900, 180], [930, 180]]),
  slot('right-2', 930, 300, [[684, 275], [900, 275], [900, 330], [930, 330]]),
  slot('bottom-mid', 480, 440, [[564, 328], [564, 440]]),
  slot('top-far-left', 30, 60, [[480, 212], [480, 30], [114, 30], [114, 60]]),
  slot('top-far-right', 922, 60, [[568, 212], [568, 30], [1006, 30], [1006, 60]]),
  slot('bottom-far-left', 12, 420, [[466, 328], [466, 515], [96, 515], [96, 480]]),
  slot('bottom-far-right', 958, 420, [[680, 328], [680, 515], [1042, 515], [1042, 480]]),
  slot('bottom-far-right-2', 1156, 420, [[664, 328], [664, 528], [1240, 528], [1240, 480]]),
];

export interface LabelPlacement {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/**
 * 線上文字位置：放在「最長的水平線段」的中點、線上方 6px；
 * 沒有夠長（≥ 70）的水平線段、或文字（依字數估寬）比線段還寬、會蓋到線段兩端的人物卡時，
 * 放在最長垂直線段的旁邊（中心偏右的線在右側）。
 */
export const LABEL_CHAR_WIDTH = 14;
export function labelPlacement(route: readonly Point[], text = ''): LabelPlacement {
  let bestH: { len: number; x: number; y: number } | null = null;
  let bestV: { len: number; x: number; y: number } | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const p = route[i]!;
    const q = route[i + 1]!;
    const dx = Math.abs(q.x - p.x);
    const dy = Math.abs(q.y - p.y);
    if (dy === 0 && dx > 0 && (!bestH || dx > bestH.len))
      bestH = { len: dx, x: (p.x + q.x) / 2, y: p.y };
    if (dx === 0 && dy > 0 && (!bestV || dy > bestV.len))
      bestV = { len: dy, x: p.x, y: (p.y + q.y) / 2 };
  }
  const textWidth = text.length * LABEL_CHAR_WIDTH;
  if (bestH && bestH.len >= 70 && (textWidth === 0 || textWidth <= bestH.len - 12))
    return { x: bestH.x, y: bestH.y - 6, anchor: 'middle' };
  const v = bestV ?? bestH!;
  const centerX = CENTER_RECT.x + CENTER_RECT.w / 2;
  return v.x >= centerX
    ? { x: v.x + 8, y: v.y, anchor: 'start' }
    : { x: v.x - 8, y: v.y, anchor: 'end' };
}

// ── 指派 ─────────────────────────────────────────────────────────

export interface Placed {
  id: string;
  rect: Rect;
}
export interface RingPlacement extends Placed {
  relation: MergedRelation;
  route: readonly Point[];
  label: LabelPlacement;
}
export interface CenterLayout {
  center: Placed;
  ring: RingPlacement[];
  others: Placed[];
  /** 「沒有直接關係」小標的位置；沒有這類人物時為 null */
  othersHeader: Point | null;
}

/** 「沒有直接關係」欄的左緣：1 欄靠右（設計稿 x=1150）；2 欄時再往左一欄 */
export function othersLeft(count: number): number {
  const columns = Math.max(1, Math.ceil(count / OTHERS.perColumn));
  return (
    AREA.width - OTHERS.rightMargin - columns * COMPACT.w - (columns - 1) * OTHERS.columnGap
  );
}

/**
 * 指派中心視角的所有位置。
 * @param relations 已合併並排好順序（mergeRelations）；人物不在 allIds 中的會被忽略
 * @param allIds 全部人物 id（含中心）；沒有關係者依此順序排在右側
 */
export function assignCenter(
  centerId: string,
  relations: readonly MergedRelation[],
  allIds: readonly string[],
): CenterLayout {
  const known = new Set(allIds);
  const related = relations.filter((r) => known.has(r.otherId) && r.otherId !== centerId);
  const ring: RingPlacement[] = related.slice(0, CENTER_SLOTS.length).map((relation, i) => {
    const s = CENTER_SLOTS[i]!;
    return {
      id: relation.otherId,
      rect: s.rect,
      relation,
      route: s.route,
      label: labelPlacement(s.route, relation.label),
    };
  });
  const placedIds = new Set([centerId, ...ring.map((r) => r.id)]);
  const otherIds = allIds.filter((id) => !placedIds.has(id));
  const left = othersLeft(otherIds.length);
  const others: Placed[] = otherIds.map((id, i) => ({
    id,
    rect: {
      x: left + Math.floor(i / OTHERS.perColumn) * (COMPACT.w + OTHERS.columnGap),
      y: OTHERS.firstY + (i % OTHERS.perColumn) * (COMPACT.h + OTHERS.gapY),
      ...COMPACT,
    },
  }));
  return {
    center: { id: centerId, rect: CENTER_RECT },
    ring,
    others,
    othersHeader: others.length > 0 ? { x: left, y: OTHERS.headerY } : null,
  };
}

/** 兩個矩形是否重疊（貼齊不算） */
export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
