/**
 * 舞台與版面尺寸常數的「唯一出處」（design-system.md §4）。
 * 來源：設計稿 §0、§1。slot 計算與 CSS 版面都從這裡取值，避免兩處不同步。
 * 單位：舞台座標 px（1440×720 的邏輯畫布）。
 */

/** 舞台邏輯尺寸（2:1）；縮放倍率 s = min(視窗寬/1440, 視窗高/720) */
export const STAGE = { width: 1440, height: 720 } as const;

/** 切換規則（單一出處：LayoutProvider 只讀這裡） */
export const LAYOUT_RULES = {
  /** 視窗寬小於此值 → 流式版 */
  flowBelowWidth: 1024,
  /** 倍率低於此值 → 流式版（避免 1024×480 這類矮視窗的文字過小；clarifications G-01） */
  flowBelowScale: 0.72,
  /** 倍率低於此值 → 舞台加 data-compact（輔助字 13→14、內文 16→17、敘述標題 26→24） */
  compactBelowScale: 0.89,
  /** 流式版容器最大寬（平板直立不會把手機排版拉爆） */
  flowMaxWidth: 640,
} as const;

/** 側欄與內容區（01–04 與 00 共用） */
export const DOCK = { width: 72 } as const;
export const CONTENT = { x: 112, width: 1288 } as const;

/** 主軸頁框架網格（§1-A；01–04 統一，clarifications G-05） */
export const AXIS_FRAME = {
  // 頁首與事件列壓縮（頁首 72→64、事件列 56→44、各段間距收緊），把下方區從 457 加高到 501，給關係圖更多上下空間
  header: { y: 20, height: 64, rightColumnWidth: 460 },
  divider: { y: 92 },
  /** 小標列 36（放大的方向鍵提示） */
  eventLabelRow: { y: 96, height: 36 },
  eventRow: { y: 142, height: 44, gap: 8 },
  lower: {
    y: 194,
    height: 501,
    /** 左欄＝敘述文字 470＋旁註欄 150 */
    leftWidth: 620,
    narrativeTextWidth: 470,
    sidenoteWidth: 150,
    gap: 40,
    /** 右欄（關係圖） */
    rightWidth: 628,
  },
  /** 02 的下方區較矮（比較滑桿佔下方 147），關係圖高度 342 */
  lowerWithCompare: { graphHeight: 342, compareSliderHeight: 147 },
} as const;

/** 關係圖（舞台版）的上下兩條功能列：標題＋控制項在上、圖例在下，都在畫布之外，所以不會蓋到節點（畫布高度＝圖框高度 − 兩條列） */
export const GRAPH_BARS = { top: 40, bottom: 44 } as const;

/** 事件列等分：寬 = (內容寬 − 間距總和) ÷ 事件數 */
export function eventCellWidth(eventCount: number): number {
  const { gap } = AXIS_FRAME.eventRow;
  return (CONTENT.width - gap * (eventCount - 1)) / eventCount;
}

/** 人物誌（§1-C、§4）：卡片區與 slot 網格 */
export const PEOPLE = {
  area: { x: 48, y: 152, width: 1344, height: 540 },
  card: { width: 248, height: 116 },
  compactCard: { width: 168, height: 60 },
  expanded: { width: 600, height: 508 },
  grid: { columns: 5, rows: 4, originX: 48, originY: 188, stepX: 274, stepY: 128 },
} as const;

/** 人物誌 slot 座標（舞台座標）：x = 48 + 欄×274、y = 188 + 列×128 */
export function gridSlot(column: number, row: number): { x: number; y: number } {
  const { originX, originY, stepX, stepY } = PEOPLE.grid;
  return { x: originX + column * stepX, y: originY + row * stepY };
}

/** 動態時間（設計稿 §6-K），單位 ms */
export const MOTION = {
  fadeOut: 120,
  fadeIn: 180,
  edgeDraw: 400,
  edgeDrawGap: 120,
  focus: 180,
  flip: 360,
  expand: 320,
  springBack: 400,
  drawerPeople: 300,
  drawerTray: 240,
  shake: 300,
  flash: 600,
  cardFlip: 600,
} as const;
