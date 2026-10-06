# Contract：版型切換、座標換算與錨點量測

> 對應需求 #4（螢幕大小適應，尤其手機版）與 #6（框格跟隨文字）。以 research.md 的 S1–S3 實驗驗證。

---

## 1. 版型決策（`LayoutProvider`，單一出處）

```ts
interface LayoutState { mode: 'stage' | 'flow'; s: number; compact: boolean; w: number; h: number }

function decide(w: number, h: number): LayoutState {
  const s = Math.min(w / 1440, h / 720);
  const portrait = h > w;
  const flow = w < 1024 || portrait || s < FLOW_SCALE;      // FLOW_SCALE = 0.72（G-01）
  return { mode: flow ? 'flow' : 'stage', s, compact: !flow && s < 0.89, w, h };
}
```
- 輸入：`window.visualViewport ?? window`（`width/height`），監聽 `resize`／`visualViewport.resize`／`orientationchange`；以 `requestAnimationFrame` 合併。
- 輸出寫入：`<html data-layout="stage|flow" [data-compact]>` 與 CSS 變數 `--stage-scale`。
- 初始值同步計算（避免首幀閃爍，不得先渲染再切換）。
- 切換版型時：保留 `page`、`eventIndex`、`focus`、追蹤、伏筆；取消進行中的拖曳；關閉 Popover。

## 2. 舞台版（`mode='stage'`）
- `<Stage>` 固定 1440×720，`position:fixed; left:50%; top:50%; transform: translate(-50%,-50%) scale(s); transform-origin:center`，**不加 `will-change`**。
- 舞台外底色 `bg-surface`；舞台內底色 `bg-bg`。
- 所有版面以舞台 px 寫（Tailwind 任意值 `w-[470px]`／常數檔），**不做**響應式斷點。
- 一屏放得下：頁內任何區塊不得超出 1440×720；溢出區塊自帶 `overflow-y:auto`。

## 3. 流式版（`mode='flow'`）
- 正常捲動頁；容器 `max-w: 640px; mx-auto; px-6`（24px 邊距）；底部固定導覽列（高 64＋safe-area）。
- 字級：內文 15、輔助 12（`--fs-*`）。觸控目標 ≥ 44px。
- 關係圖：容器寬＝100%（≤ 640−48），高度固定比例（預設 342:300 → 依寬度縮放高度，圖例列另加 72px），**節點座標為比例**，節點寬度固定（≥ 340px 容器：96；< 340：88，字級 14/11）。
- 事件列：`position: sticky; top:0`，橫向捲動，目前事件 `scrollIntoView({inline:'center'})`。
- 不處理方向鍵；Popover／托盤為底部面板。

## 4. 座標換算：`localPoint`

```ts
/** client 座標 → 該元素「本地（未縮放）」座標。不需知道任何縮放倍率；可處理祖先的任意層 uniform scale。 */
export function localPoint(el: HTMLElement | SVGElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  const w = (el as HTMLElement).offsetWidth || (el as SVGElement).getBBox?.().width || r.width;
  const k = w ? r.width / w : 1;
  return { x: (clientX - r.left) / k, y: (clientY - r.top) / k, k };
}
```
- **一律以元素本身為基準**：舞台版拖曳節點用「關係圖視口元素」；光譜用「軌道元素」；比較滑桿用「滑桿容器」；伏筆拖曳用「舞台」。
- 疊加關係圖 zoom：`graphPoint = (localPoint(viewport).x - pan.x) / zoom`。
- 單元測試：以假的 `getBoundingClientRect/offsetWidth` 驗證 k=1、k=1.319、巢狀 1.5×（S2 同一組數字）。

## 5. 錨點量測（伏筆框格）

```ts
interface AnchorBox { id: string; endX: number; lineTop: number; lineBottom: number; midY: number }   // 皆為「敘述面板本地座標」

function measureAnchors(panel: HTMLElement): AnchorBox[] {
  return [...panel.querySelectorAll<HTMLElement>('[data-hint]')].map(el => {
    const rects = el.getClientRects();            // 跨行片語有多個 rect
    const last = rects[rects.length - 1];         // 取最後一個＝片語末端
    const p = localPoint(panel, last.right, last.bottom);
    const q = localPoint(panel, last.right, last.top);
    return { id: el.dataset.hint!, endX: p.x, lineTop: q.y, lineBottom: p.y, midY: (p.y + q.y) / 2 };
  });
}
```
- 觸發：`ResizeObserver(panel)`、`document.fonts.ready`＋`fonts.addEventListener('loadingdone')`、`activeEvent` 變更（在 `useLayoutEffect`）、`layout.compact` 或 `mode` 變更。
- 框格 y 防撞：`slots.sort(byY)`；`y[i] = max(y[i], y[i-1] + 28 + 8)`；若最後一個超出面板可用高度，整體上推並再次防撞。
- 弧線：起點 `(endX+2, lineBottom−6)`，沿行距往右至 `slotX−24`，再以三次貝茲曲線彎向框格左緣中點；微擾動以 `hash(id)` 決定（手繪感、每次重畫相同）。
- 同一行多個錨點：弧線 y 依序錯開 3px，避免疊在一起。
- 流式版：`NoteRow`（**`display:block`**）在文字流中，插入點由 `resolveNoteInsertionPoint()` 決定（預設錨點後第一個標點之後；設計決策與已知排版風險見 `docs/設計決策-手機版伏筆註記列位置.md`），弧線只需 `endX`（以列容器為本地座標量一次）；量測失敗時不畫弧線，框格仍可操作。
- 開發除錯：網址加 `?debug=anchors`（寫在 `#` 之前，例如 `/?debug=anchors#/axis/3`）顯示量測框與座標。
- E2E 斷言（SC-002）：在 1920×950、1536×740、1440×795、1366×640、1280×600、2560×1300（含 compact）取各框格的**舞台座標**，彼此差 ≤ 2px；框格矩形兩兩不相交。

## 6. Popover 定位

```ts
function placePopover(anchor: DOMRect, stage: HTMLElement, size: {w:number;h:number}) {
  const a = rectToLocal(stage, anchor);                 // 以 localPoint 換成舞台座標
  let x = clamp(a.left, 16, 1440 - size.w - 16);
  let y = a.bottom + 12;
  let placement: 'below' | 'above' = 'below';
  if (y + size.h > 720 - 16) { y = a.top - 12 - size.h; placement = 'above'; }
  return { x, y, placement };
}
```
- 流式版：`Sheet`（底部），不需定位。
- 開啟時錨點文字切換為「選中」樣式；Esc、點外部、再點同錨點關閉；焦點回到錨點。

## 7. 驗收視窗矩陣（Playwright）
桌機（舞台）：1920×950、1536×740、1440×795、1366×640、1280×600、2560×1300。
流式：390×844、360×740、320×640、768×1024（直立平板）、844×390（橫向手機）、1024×480（倍率過小 → 流式）。
