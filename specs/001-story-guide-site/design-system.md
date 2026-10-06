# 設計系統落地：Tailwind 主題、共用樣式與共用元件

> 對應你的需求 #1：「參考設計版面和元件先定義好 tailwind 的 component 或主題樣式，寫好共用的 component」。
> 來源：`design/_ds/classical-*/styles.css`、設計稿 §6 元件規格 A–K、§1 頁面框架。
> 本檔是**實作前的藍圖**；`src/styles/index.css` 與 `src/components/ui/*` 依此建立（見 tasks.md Phase 2）。

---

## 1. 主題（`src/styles/index.css` 草稿）

```css
@import "tailwindcss";

/* ── 1) 代幣：Classical 設計系統（唯一來源）──────────────── */
@theme {
  --color-*: initial;                 /* 清掉 Tailwind 預設色盤，只能用設計色 */
  --color-transparent: transparent;
  --color-current: currentColor;

  --color-bg: #f3f2f2;                /* 紙色 */
  --color-surface: #eae9e9;           /* 舞台外／plate 襯底 */
  --color-ink: #201f1d;               /* 正文（設計系統的 --color-text） */
  --color-accent: #b68235;
  --color-divider: color-mix(in srgb, #201f1d 16%, transparent);

  --color-neutral-100: #f8f4f4;  --color-neutral-200: #eae7e7;  --color-neutral-300: #d7d3d3;
  --color-neutral-400: #bab6b6;  --color-neutral-500: #9b9797;  --color-neutral-600: #7d7979;
  --color-neutral-700: #605d5d;  --color-neutral-800: #444141;  --color-neutral-900: #2d2b2b;

  --color-accent-100: #fff3e4;   --color-accent-200: #ffe3bf;   --color-accent-300: #facb8d;
  --color-accent-400: #e1ad66;   --color-accent-500: #c28d41;   --color-accent-600: #a06f24;
  --color-accent-700: #7d5411;   --color-accent-800: #5a3b0a;   --color-accent-900: #3a270d;

  --font-heading: "Cormorant Garamond", "Noto Serif TC", serif;
  --font-body:    "Lora", "Noto Serif TC", serif;
  --font-cjk:     "Noto Serif TC", serif;

  --shadow-sm: 0 1px 2px color-mix(in srgb, #2d2b2b 14%, transparent);
  --shadow-md: 0 3px 10px color-mix(in srgb, #2d2b2b 16%, transparent);
  --shadow-lg: 0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent);

  --radius-sm: 2px;  --radius-md: 4px;  --radius-lg: 7px;

  /* 動態（設計稿 §6-K）*/
  --ease-out-soft: cubic-bezier(.2, .7, .2, 1);   /* FLIP／原地放大 */
  --ease-flip: cubic-bezier(.4, 0, .2, 1);        /* 翻面 */
  --animate-flash:  flash 600ms ease-in-out 2;
  --animate-shake:  shake 300ms linear 1;
  --animate-fade-in: fade-in 180ms ease-out both;
  --animate-mirror-idle: mirror-idle 8s ease-in-out infinite;
  @keyframes flash { 0%,100% { box-shadow: 0 0 0 0 transparent } 50% { box-shadow: 0 0 0 4px var(--color-accent-200) } }
  @keyframes shake { 0%,100% { translate: 0 } 20% { translate: -4px } 40% { translate: 4px } 60% { translate: -4px } 80% { translate: 4px } }
  @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
  @keyframes mirror-idle { 0%,100% { transform: rotateY(-8deg) } 50% { transform: rotateY(8deg) } }
}

/* ── 2) 版型與字級補償：由屬性驅動（見 contracts/layout-and-coordinates.md）── */
@custom-variant stage   (&:where([data-layout="stage"], [data-layout="stage"] *));
@custom-variant flow    (&:where([data-layout="flow"],  [data-layout="flow"]  *));
@custom-variant compact (&:where([data-compact],        [data-compact] *));

:root {
  --fs-aux: 13px;  --fs-body: 16px;  --fs-title: 26px;     /* 舞台字級（設計稿 §0）*/
  --z-page: 0; --z-dock: 10; --z-tray: 20; --z-popover: 30; --z-toast: 40; --z-cover: 50; --z-drawer: 60;
}
[data-layout="stage"][data-compact] { --fs-aux: 14px; --fs-body: 17px; --fs-title: 24px; }
[data-layout="flow"] { --fs-aux: 12px; --fs-body: 15px; --fs-title: 21px; }

/* ── 3) 文字保護（N-01）：全站不可選取；細節與限制見 research R25 ── */
@layer base {
  *, *::before, *::after {
    -webkit-user-select: none; user-select: none;
    -webkit-touch-callout: none;
  }
  img { -webkit-user-drag: none; user-drag: none; }
}
@utility allow-select { -webkit-user-select: text; user-select: text; }   /* 預設不使用 */

@utility text-aux   { font-size: var(--fs-aux); }
@utility text-body  { font-size: var(--fs-body); }
@utility text-title { font-size: var(--fs-title); }
@utility tnum { font-feature-settings: "tnum"; }
```

> **原則**：元件只用 `bg-bg`、`text-neutral-700`、`border-accent`、`shadow-md`、`rounded-md`、`text-aux` 這類 token 工具類；出現 `#hex`／`rgb()` 即違反憲章 III（以 lint 規則檢查，T003）。

---

## 2. 共用樣式類別（`@layer components` / `@utility`）

> 這是「設計稿重複出現的樣式」的唯一定義處。React 元件只組合這些類別，不重複寫長串 class。

| 類別 | 對應設計稿 | 狀態 | 要點 |
|---|---|---|---|
| `.eyebrow` | 13px、字距 .2em、neutral-600 的小標（「核心關係」「事件進程」） | — | 同時有 `.eyebrow-accent`（accent-700、字距 .24em） |
| `.display-num` | 64／40／30／24 的 Cormorant 大數字 | 色：accent／neutral-300（骨架） | `tnum` |
| `.btn` `.btn-primary/-secondary/-ghost/-icon` | DS `.btn` | hover＝accent 12%、pressed＝22%、disabled 45% | 外框按鈕，絕不實心填色 |
| `.chip`（標籤／篩選／圖例／開關） | §6-H 篩選標籤、§6-E 圖例、控制項切換鈕 | 預設／hover(neutral-100)／`[aria-pressed=true]`(accent 框＋accent-100)／`[data-off]`(虛框＋刪除線) | 一個類別三種用途，靠 `data-variant` 區分尺寸 |
| `.segmented` | 排列切換（依群體｜依出場順序｜依所在世界） | 選中＝accent-100 底 | 對應 `role=radiogroup` |
| `.kbd` | 方向鍵提示（←→↑↓） | — | 22×20、neutral-400 框 |
| `.hairline` | 髮絲分隔線 | — | `--color-divider` |
| `.plate` | DS `.plate`（明信片正面圖） | — | sepia 濾鏡＋6px surface 襯＋1px 外框 |
| `.link-name` | §6-B 人名 | 預設：neutral-600 點線；hover／開啟中：accent-800＋accent 實線＋accent-100 底 | 不加粗 |
| `.link-term` | §6-B 名詞 | 預設：accent-800＋accent 點線；hover 同上 | |
| `.link-cross` | 「見下方 ↓」 | accent-800＋accent 實線底線；hover accent-600 | |
| `.hint-anchor` | 回收處雙底線 | `text-decoration: underline double accent; text-underline-offset: 5px`；已解開改 neutral-400 | **全站唯一**使用雙線 |
| `.hint-slot` | §6-G 框格（高 28） | `[data-state]`＝`empty`(neutral-400 雙框)／`ready`(accent 雙框＋accent-100＋「放開以放入」)／`solved`(accent 雙框＋✓＋flash)／`wrong`(neutral-700 雙框＋shake) | 3px double |
| `.hint-keyword` | §6-G 關鍵字（高 34） | `idle`／`selected`(accent 1.5px＋shadow-md＋上移 3px)／`solved`(✓、neutral-500、不可拖) | |
| `.bookmark` | 追蹤書籤 10×15（accent-700） | 位置由父層決定（事件格右上、引言左上、側欄追蹤區） | `clip-path` 缺口三角 |
| `.callout` | Popover／獲得提示／追蹤回饋 | 寬 300、1px neutral-300（提示類為 accent）、shadow-md、箭頭 | `[data-placement]` 決定箭頭方向 |
| `.sheet` | 手機底部面板（Popover、托盤） | 圓角 8px 上緣、握把 36×4 | |
| `.scrim` | 人物誌展開／手機 Popover 遮罩 | 72% 紙色（人物誌）／18% 墨色（手機） | |
| `.event-cell` | §6-D 事件格 | `[data-state=upcoming|current|past]`＋`[data-tracked]`＋`[data-hover]` | 上緣線：未到 divider、已過 neutral-500、目前 2px accent |
| `.node` | §6-E 節點 | `[data-state=normal|focus|dim]`、`[data-group]`(虛框)、`[data-dragging]`(shadow-md＋scale 1.04) | 最小寬 120（桌機）／96（流式） |
| `.edge` | §6-E 連線 | `[data-kind=key|relation|conflict]`、`[data-state=dim|normal|lit]` | 本篇關鍵 1.5px accent；亮起 2.5px accent-700 |
| `.person-card` | §6-H 人物卡（248×116） | `[data-on]`＝登場（金頂線）／預設灰階；`[data-selected]`＝浮起；`[data-tracked]`；`[data-center]` | **兩個獨立通道**：登場 ≠ 選中 |
| `.person-card-compact` | 精簡卡 168×60 | 同上 | |
| `.spoiler` | §6-H 劇透區塊 | `[data-revealed]`；遮蔽時渲染灰條不渲染文字 | |
| `.mirror-card` | §6-J 鏡像卡 430×268 | 三層元素（閒置／翻面） | |

> 狀態一律以 **`data-*` 屬性**表達（而非一長串條件 class），Tailwind 用 `data-[state=focus]:…` 與 `aria-pressed:…` 撰寫，元件程式碼保持乾淨。

---

## 3. 共用 React 元件（`src/components/`）

### ui/（無業務邏輯）
| 元件 | Props（重點） | 說明 |
|---|---|---|
| `Button` | `variant: primary|secondary|ghost|icon`, `icon?`, `size` | 對應 `.btn` |
| `Chip` | `pressed?`, `off?`, `variant: filter|legend|toggle`, `lineSample?` | 篩選標籤、圖例開關、控制項切換 |
| `Segmented` | `options, value, onChange, disabled?` | 排列切換 |
| `Kbd` | `children` | 方向鍵提示 |
| `Eyebrow` / `DisplayNum` / `Hairline` | — | 版面小元件 |
| `Bookmark` | `className?` | 追蹤書籤標記 |
| `Callout` | `placement, tone: neutral|accent, anchorRect` | Popover／提示的外殼 |
| `Sheet` | `open, onClose` | 手機底部面板 |
| `Scrim` | `tone` | |
| `Spoiler` | `chapter, revealed, onToggle, children` | 未顯示時不渲染 children |
| `FlashOnce` | `trigger` | 以 `key` 重播 flash 動畫（尊重 reduced-motion） |
| `useReducedMotion` | — | hook，回傳布林並訂閱變化 |

### layout/
| 元件 | 說明 |
|---|---|
| `LayoutProvider`／`useLayout()` | 回傳 `{mode:'stage'|'flow', s, compact}`；寫 `data-layout`／`data-compact`／`--stage-scale` |
| `Stage` | 舞台容器（1440×720＋縮放）；`StageSurface` 負責舞台外底色 |
| `FlowShell` | 流式版容器（max-w 640、置中、底部導覽列保留空間） |
| `Dock` | 側欄（舞台版 72px）／底部導覽列（流式版）— 同一組資料（人物誌、伏筆＋徽章、追蹤中、頁面指示）兩種呈現 |
| `PageFrame` | 主軸頁框架網格：頁首／事件列／左欄／右欄（§1-A） |
| `PageHeader` | 大數字＋標題＋核心主題 |

### text/
| 元件 | 說明 |
|---|---|
| `RichText` | 解析行內標記與別名，輸出 `NameLink`／`TermLink`／`CrossLink`／`HintAnchor` 與純文字；**全站所有文字都經過它** |
| `NameLink`／`TermLink`／`CrossLink` | 對應 `.link-*`，點擊呼叫 Popover |
| `HintAnchor` | 輸出帶 `data-hint` 的雙底線 span（量測依據） |
| `PopoverLayer` | 舞台內最上層，管理目前開啟的 Popover（單例），含翻轉定位與 light-dismiss |

### 功能群（features/）
`graph/`（RelationGraph、GraphNode、GraphEdge、GraphLegend、GraphControls、LayerBand）、`axis/`（EventBar、EventCell、NarrativePanel）、`hints/`（HintTray、HintKeyword、HintSlotLayer、HintSlot、HintArc、NoteRow）、`people/`（PeopleDrawer、PersonCard、CompactCard、FilterBar、ArrangeSwitch、CenterView、ExpandedPanel）、`extras/`（BoundarySpectrum、CompareSlider、LayeredGraph、MirrorCard、Postcard、SpoilerCover）。

---

## 4. 設計稿尺寸 → 程式常數（`src/lib/stage-metrics.ts`，唯一出處）

| 常數 | 值 | 來源 |
|---|---|---|
| `STAGE` | 1440×720 | §0 |
| `DOCK_W` | 72 | §1-A |
| `CONTENT_X / CONTENT_W` | 112／1288 | §1-A |
| `HEADER` | y28、h72；右欄 460 | §1-A |
| `EVENT_ROW` | y162、h56、gap 8 | §1-A |
| `LOWER`（01–04 **統一**） | y238、h457；左欄 **620**（敘述文字 470＋旁註欄 150，行高 36）、gap 40、右欄 **628** | G-05 決議與追加（取代設計稿 §1-A 的 470／778 與 §5-B 的 340＋116）；01 的旁註欄留空 |
| `PEOPLE_GRID` | x=48＋欄×274、y=188＋列×128；卡 248×116；精簡 168×60；浮層 600×508 | §1-C、§4 |
| `COMPACT_SCALE` 門檻 | 0.89 | §0 |
| `FLOW_SCALE` 門檻 | 0.72〔暫定 G-01〕 | clarifications |
| `FLOW_MAX_W` | 640〔暫定 G-01〕 | clarifications |

> 這些數字只出現在這一個檔案（及 Tailwind 版型類別中相對應的 `w-[…]`／`h-[…]`），由它同時供應 slot 計算與 CSS 變數，避免兩處不同步。
