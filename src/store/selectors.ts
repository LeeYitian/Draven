/**
 * 純函式 selector：劇透規則、登場、焦點亮暗、連線可見性、伏筆（data-model §2.1，憲章 V）。
 * 全部不依賴 React 或 store，皆有單元測試；元件只負責呼叫。
 */
import type { GraphEdge, Person } from '../content/schema.ts';

export type Page = 0 | 1 | 2 | 3 | 4;

/** 主軸頁的焦點：事件與節點互斥，以最後一次點擊為準 */
export type Focus = { type: 'event'; n: number } | { type: 'node'; id: string } | null;

export type EdgeVisualState = 'unrevealed' | 'dim' | 'normal' | 'lit';
export type NodeVisualState = 'normal' | 'focus' | 'dim';

// ── 進度與登場 ───────────────────────────────────────────────────
/** 故事進度＝目前主軸；00＝0。04 遮罩沒打開前只算到 3（clarifications G-14） */
export function progress(page: Page, page04Unlocked: boolean): number {
  return page === 4 && !page04Unlocked ? 3 : page;
}

/** 人物卡登場：累積到目前主軸（firstAppearance.axis ≤ 進度）；進度 0 全部未登場 */
export function isOnStage(
  person: Pick<Person, 'firstAppearance'>,
  currentProgress: number,
): boolean {
  return currentProgress > 0 && person.firstAppearance.axis <= currentProgress;
}

// ── Popover 文字（依進度累積，04 的內容永遠不出現）─────────────────────
export interface PopoverContent {
  base: string;
  /** 讀完第 axis 主軸後的內容（空白段落已跳過） */
  layers: { axis: 1 | 2 | 3; text: string }[];
}

/**
 * 進度 0、1：只有基本身分。進度 n（≥2）：基本身分 + 讀完 01…n-1 的內容（最多到 03）。
 * popover = [基本身分, 讀完 01, 讀完 02, 讀完 03]；空字串＝沒有新內容，直接跳過。
 */
export function popoverText(
  person: Pick<Person, 'popover'>,
  currentProgress: number,
): PopoverContent {
  const layers: PopoverContent['layers'] = [];
  const last = Math.min(currentProgress - 1, 3);
  for (let axis = 1; axis <= last; axis++) {
    const text = person.popover[axis];
    if (text) layers.push({ axis: axis as 1 | 2 | 3, text });
  }
  return { base: person.popover[0], layers };
}

// ── 人物誌劇透：只看讀者自己的點擊，不看進度 ──────────────────────────
export const spoilerKey = (personId: string, axis: number) => `${personId}:${axis}`;

export function spoilerVisible(
  revealed: Readonly<Record<string, boolean>>,
  personId: string,
  axis: number,
): boolean {
  return revealed[spoilerKey(personId, axis)] === true;
}

// ── 關係圖：可見性與亮暗 ──────────────────────────────────────────
/** 可見的線＝背景關係 + 事件序 ≤ 目前事件（累積）。eventIndex 為 0-based */
export function visibleEdges(edges: readonly GraphEdge[], eventIndex: number): GraphEdge[] {
  return edges.filter((e) => e.event === 'bg' || e.event <= eventIndex + 1);
}

const isIncident = (edge: GraphEdge, nodeId: string) => edge.from === nodeId || edge.to === nodeId;

export function edgeState(edge: GraphEdge, eventIndex: number, focus: Focus): EdgeVisualState {
  const visible = edge.event === 'bg' || edge.event <= eventIndex + 1;
  if (!visible) return 'unrevealed';
  if (!focus) return 'normal';
  if (focus.type === 'event') return edge.event === focus.n ? 'lit' : 'dim';
  return isIncident(edge, focus.id) ? 'lit' : 'dim';
}

export function nodeState(
  nodeId: string,
  focus: Focus,
  ctx: { participants: ReadonlySet<string>; edges: readonly GraphEdge[] },
): NodeVisualState {
  if (!focus) return 'normal';
  if (focus.type === 'event') return ctx.participants.has(nodeId) ? 'focus' : 'dim';
  if (nodeId === focus.id) return 'focus';
  // 鄰居＝與焦點節點之間「已畫出」的線的另一端
  const neighbor = ctx.edges.some(
    (e) => (e.from === focus.id && e.to === nodeId) || (e.to === focus.id && e.from === nodeId),
  );
  return neighbor ? 'focus' : 'dim';
}

// ── 事件列標記 ───────────────────────────────────────────────────
/** 追蹤：該人物出場的事件（事件格右上掛書籤）；不影響關係圖 */
export function eventTracked(
  event: { participants: readonly string[] },
  trackedId: string | null,
): boolean {
  return trackedId !== null && event.participants.includes(trackedId);
}

/** 節點焦點：該節點有出場的事件，編號改金色＋底線（不是追蹤） */
export function eventMarkedByNodeFocus(
  event: { participants: readonly string[] },
  focus: Focus,
): boolean {
  return focus?.type === 'node' && event.participants.includes(focus.id);
}

// ── 伏筆 ─────────────────────────────────────────────────────────
export const slotAnswer = (slotHintId: string, keywordHintId: string): boolean =>
  slotHintId === keywordHintId;

/** 進入某主軸時應獲得的伏筆（只含該主軸、且尚未擁有；不補發之前主軸的） */
export function acquirableHints<T extends { id: string; acquire: number }>(
  hints: readonly T[],
  axis: number,
  owned: readonly string[],
): T[] {
  return hints.filter((h) => h.acquire === axis && !owned.includes(h.id));
}
