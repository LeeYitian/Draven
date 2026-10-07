/**
 * 人物誌的卡片位置（任務 T078，research R13）：位置全由「slot 指派」決定。
 * 5 欄 × 4 列共 20 個 slot；排列方式（群體／出場順序／所在世界）只是不同的指派表，
 * 元件把 slot 換成座標、以 CSS transform 過渡產生位移動畫，不需要量測 DOM。
 * 座標是「卡片區」的本地座標（卡片區左上＝舞台 (48, 152)，見 PEOPLE.area）。
 */
import { PEOPLE, gridSlot } from '../../lib/stage-metrics';

export const GRID_COLUMNS = PEOPLE.grid.columns;
export const GRID_ROWS = PEOPLE.grid.rows;
export const GRID_SLOT_COUNT = GRID_COLUMNS * GRID_ROWS;

export interface Point {
  x: number;
  y: number;
}

/** slot 編號＝欄 × 4 ＋列（欄優先）；回傳卡片區本地座標 */
export function slotPosition(index: number): Point {
  const column = Math.floor(index / GRID_ROWS);
  const row = index % GRID_ROWS;
  const stage = gridSlot(column, row);
  return { x: stage.x - PEOPLE.area.x, y: stage.y - PEOPLE.area.y };
}

export const GRID_SLOTS: readonly Point[] = Array.from({ length: GRID_SLOT_COUNT }, (_, i) =>
  slotPosition(i),
);

/** 欄標題（群體名稱／世界名稱）所在的位置：欄的頂端，與卡片區同一個左緣 */
export function headingPosition(column: number): Point {
  return { x: gridSlot(column, 0).x - PEOPLE.area.x, y: 0 };
}

export interface ArrangeInput {
  id: string;
  group: string;
  order: number;
  world: string;
}

export interface Heading {
  /** 群體或世界的 id；元件以 ui 文案取名稱 */
  key: string;
  column: number;
  count: number;
}

export interface Arrangement {
  /** personId → slot 編號 */
  slots: Record<string, number>;
  headings: Heading[];
}

const byOrder = <T extends { order: number }>(list: readonly T[]) =>
  [...list].sort((a, b) => a.order - b.order);

/** 把一串人依序塞進「欄優先」的連續欄位；回傳每人的 slot 編號 */
function fillColumns(
  people: readonly ArrangeInput[],
  firstColumn: number,
): { slots: Record<string, number>; columns: number } {
  const slots: Record<string, number> = {};
  people.forEach((p, i) => {
    slots[p.id] = firstColumn * GRID_ROWS + i;
  });
  return { slots, columns: Math.max(1, Math.ceil(people.length / GRID_ROWS)) };
}

/** 依群體：一個群體一欄（欄標題＝群體名），欄內依出場順序 */
export function arrangeByGroup(
  people: readonly ArrangeInput[],
  groupOrder: readonly string[],
): Arrangement {
  const slots: Record<string, number> = {};
  const headings: Heading[] = [];
  groupOrder.forEach((group, column) => {
    const members = byOrder(people.filter((p) => p.group === group));
    members.forEach((p, row) => {
      slots[p.id] = column * GRID_ROWS + row;
    });
    headings.push({ key: group, column, count: members.length });
  });
  return { slots, headings };
}

/** 依出場順序：由左而右、由上而下（列優先）排成 5 欄，沒有欄標題 */
export function arrangeByOrder(people: readonly ArrangeInput[]): Arrangement {
  const slots: Record<string, number> = {};
  byOrder(people).forEach((p, i) => {
    slots[p.id] = (i % GRID_COLUMNS) * GRID_ROWS + Math.floor(i / GRID_COLUMNS);
  });
  return { slots, headings: [] };
}

/**
 * 依所在世界（G-18：用「起始」所在世界）：人間可佔多欄，其餘世界各一欄起算。
 * 欄標題掛在每個世界的第一欄；人間 12 人剛好 3 欄 × 4 列。
 */
export function arrangeByWorld(
  people: readonly ArrangeInput[],
  worldOrder: readonly string[],
): Arrangement {
  const slots: Record<string, number> = {};
  const headings: Heading[] = [];
  let column = 0;
  for (const world of worldOrder) {
    const members = byOrder(people.filter((p) => p.world === world));
    if (members.length === 0) continue;
    const filled = fillColumns(members, column);
    Object.assign(slots, filled.slots);
    headings.push({ key: world, column, count: members.length });
    column += filled.columns;
  }
  return { slots, headings };
}
