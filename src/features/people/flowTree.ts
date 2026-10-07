/**
 * 手機版人物中心視角的版面（設計稿「手機 人物中心」的決議版：標籤掛在卡上、連線直接連到標籤）。
 * 純函式：只算幾何，不依賴 React 或 DOM。座標單位 px，寬度由容器實際寬決定（272–592 都能用）。
 *
 * 結構（由上到下）：上半區（關係人物）→ 中心卡 → 下半區（關係人物）→「沒有直接關係」。
 * - 兩欄，每個人 = 卡片＋掛在卡上的關係膠囊（外框＝線種）；上半區膠囊在卡片下緣、下半區膠囊在卡片上緣，
 *   都朝向中心。
 * - 線從中心卡的邊緣出發、連到膠囊：離中心最近的一列從膠囊中央連入（弧線），
 *   更遠的列走兩欄之間的中縫、連到膠囊內側邊緣（每一列各自錯開，不重疊）。
 * - 人數 n：下半區 ceil(n/2)、上半區 floor(n/2)（設計稿 9 人＝上 4 下 5）；依優先順序輪流分配，
 *   越前面的越靠近中心；某區人數為奇數時，最後一個置中。
 * 常數取自設計稿（寬 342 時卡寬 160、欄距 22、上半區列距 130、下半區列距 120）。
 */
export const TREE = {
  gutter: 22,
  cardH: 46,
  pillH: 22,
  pillGap: 4,
  /** 上半區：最近一列的卡片上緣距離中心卡 180；列距 130；最上方留 20 */
  upNear: 180,
  upPitch: 130,
  upTop: 20,
  /** 下半區：最近一列的膠囊上緣距離中心卡下緣 40；列距 120 */
  downNear: 40,
  downPitch: 120,
  /** 離中心最近一列的線，在中心卡邊緣上的起點偏離中線的距離 */
  nearOffset: 71,
  /** 中縫線：離中線的距離，每遠一列再錯開 4 */
  gutterBase: 3,
  gutterStep: 4,
} as const;

export type TreeGroup = 'up' | 'down';

export interface TreeCell {
  /** 在關係人物清單（已排好優先順序）中的位置 */
  index: number;
  group: TreeGroup;
  /** 0＝離中心最近的一列 */
  row: number;
  col: 0 | 1;
  centered: boolean;
  /** 卡片左緣（所屬半區的本地座標；寬度＝cardW） */
  x: number;
  /** 卡片上緣（所屬半區的本地座標） */
  cardTop: number;
  /** 膠囊上緣（所屬半區的本地座標；寬度＝cardW、高度＝pillH） */
  pillTop: number;
  /** 線的 SVG path（所屬半區的本地座標）：上半區起點在底邊（中心卡上緣）、下半區起點在頂邊 */
  path: string;
}

export interface FlowTree {
  width: number;
  cardW: number;
  centerX: number;
  upHeight: number;
  downHeight: number;
  cells: TreeCell[];
}

const f = (n: number) => Number(n.toFixed(2));

/** 排出 count 位關係人物的版面；width 是容器內容寬 */
export function layoutFlowTree(count: number, width: number): FlowTree {
  const cardW = (width - TREE.gutter) / 2;
  const centerX = width / 2;
  const downCount = Math.ceil(count / 2);
  const upCount = Math.floor(count / 2);
  const upRows = Math.ceil(upCount / 2);
  const downRows = Math.ceil(downCount / 2);
  const upHeight = upRows === 0 ? 0 : TREE.upTop + (upRows - 1) * TREE.upPitch + TREE.upNear;
  const blockH = TREE.pillH + TREE.pillGap + TREE.cardH;
  const downHeight = downRows === 0 ? 0 : TREE.downNear + (downRows - 1) * TREE.downPitch + blockH + 8;

  const cells: TreeCell[] = [];
  for (let i = 0; i < count; i++) {
    const group: TreeGroup = i % 2 === 0 ? 'down' : 'up';
    const j = Math.floor(i / 2); // 這一區的第幾位
    const groupCount = group === 'down' ? downCount : upCount;
    const row = Math.floor(j / 2);
    const col = (j % 2) as 0 | 1;
    const centered = groupCount % 2 === 1 && j === groupCount - 1;
    const x = centered ? (width - cardW) / 2 : col === 0 ? 0 : cardW + TREE.gutter;
    const cellCenter = x + cardW / 2;
    const side = col === 0 ? -1 : 1;
    const gutterX = centerX + side * (TREE.gutterBase + TREE.gutterStep * (row - 1));

    if (group === 'down') {
      const pillTop = TREE.downNear + row * TREE.downPitch;
      const cardTop = pillTop + TREE.pillH + TREE.pillGap;
      const pc = pillTop + TREE.pillH / 2;
      let path: string;
      if (centered) path = `M${f(centerX)} 0 V${f(pillTop)}`;
      else if (row === 0) {
        const sx = centerX + side * TREE.nearOffset;
        path = `M${f(sx)} 0 C${f(sx)} 20 ${f(cellCenter)} ${f(pillTop - 20)} ${f(cellCenter)} ${f(pillTop)}`;
      } else {
        const edgeX = col === 0 ? x + cardW : x;
        path = `M${f(gutterX)} 0 V${f(pc - 21)} C${f(gutterX)} ${f(pc - 6)} ${f(gutterX)} ${f(pc)} ${f(edgeX)} ${f(pc)}`;
      }
      cells.push({ index: i, group, row, col, centered, x, cardTop, pillTop, path });
    } else {
      const cardTop = upHeight - TREE.upNear - row * TREE.upPitch;
      const pillTop = cardTop + TREE.cardH + TREE.pillGap;
      const pillBottom = pillTop + TREE.pillH;
      const pc = pillTop + TREE.pillH / 2;
      let path: string;
      if (centered) path = `M${f(centerX)} ${f(upHeight)} V${f(pillBottom)}`;
      else if (row === 0) {
        const sx = centerX + side * TREE.nearOffset;
        path = `M${f(sx)} ${f(upHeight)} C${f(sx)} ${f(upHeight - 50)} ${f(cellCenter)} ${f(pillBottom + 48)} ${f(cellCenter)} ${f(pillBottom)}`;
      } else {
        const edgeX = col === 0 ? x + cardW : x;
        path = `M${f(gutterX)} ${f(upHeight)} V${f(pc + 29)} C${f(gutterX)} ${f(pc + 9)} ${f(gutterX)} ${f(pc)} ${f(edgeX)} ${f(pc)}`;
      }
      cells.push({ index: i, group, row, col, centered, x, cardTop, pillTop, path });
    }
  }
  return { width, cardW, centerX, upHeight, downHeight, cells };
}
