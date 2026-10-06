# Research：技術決策、可行性驗證與風險

> 目的：在動手實作前確認「每一項規劃在技術上都可行」，並把決策與理由留下來。
> 結論先講：**全部互動皆可行，且不需要圖形庫、動畫庫、路由庫或浮動定位庫**。最大的風險點（伏筆框格跟隨文字、舞台縮放下的座標、人物中心視角版面）都已有可驗證的做法。

---

## 0. 驗證實驗（Spike）結果

> 2026-10-07 在內建瀏覽器實測（Chromium，Noto Serif TC 實際載入）。實驗頁為一次性，未放入倉庫；做法已寫進 contracts 與 tasks。

| # | 驗證什麼 | 方法 | 結果 |
|---|---|---|---|
| S1 | **舞台縮放下，文字錨點的舞台座標是否穩定**（決定伏筆做法） | 1440×720 舞台，340px 寬文字欄內有 3 個雙底線片語；在視窗 1440×720（s=1）、1920×950（s=1.319）、1280×600（s=0.833）各量一次 `getClientRects()` 並換算成舞台座標 | 三組尺寸量到的錨點座標**完全相同**：(209.2, 375.6)、(338.8, 411.6)、(176, 447.6)；跨行片語回報 2 個 rect，取最後一個＝末端。**結論：舞台版下換行是確定性的（舞台座標內排版後再等比縮放），只要用「換算成舞台座標」的量測，位置不會因螢幕尺寸而跑掉。** |
| S2 | **`localPoint()` 通用換算**（拖曳／量測共用） | `k = rect.width / el.offsetWidth; x = (clientX − rect.left)/k`；在 s=1.319 驗證舞台內已知元素左上角，並在舞台內再放一層 `scale(1.5)` 的容器驗證 | 舞台元素回推 (112.00, 238.00)＝預期；巢狀 1.5 倍容器中心回推 (100.00, 50.00)＝預期。**結論：不需要知道任何縮放倍率，也不怕關係圖自身的縮放（zoom）再疊在舞台縮放上。** |
| S3 | **流式版插入「註記列」是否不用量測就能放對位置** | 窄螢幕（容器 327px）下，在錨點後第一個標點之後插入 `display:inline-block; width:100%; height:50px` 的 span | 3 個註記列都**獨立成列**（left=容器左緣、寬=容器寬 327、高 50），緊貼在錨點末行下方 5px，後續文字在其後另起一行。**結論：流式版純靠 CSS 文字流即可，不需要 JS 量測。** ⚠️ 後續追加實驗（S3b）發現 inline-block 在 `text-align:justify` 下會拉伸上一行，**最終改用 `display:block`**，見下一列。 |
| S3b | **註記列與兩端對齊的相互作用** | 同上，逐字量測註記列上方那一行的平均字寬（字級 15px），比較 `inline-block`／`display:block`／`text-align:left` | `inline-block`＋justify：19.0／21.0／**49.1px**（12 個字攤滿整行）；`text-align:left`：15.0；**`display:block`＋justify：15.0px，註記列位置與寬度不變**。→ 註記列一律 `display:block`。完整紀錄與已知排版風險：`docs/設計決策-手機版伏筆註記列位置.md` |
| S4 | **設計稿人物誌篩選列容量** | 在瀏覽器開啟設計稿，量 §4-A 篩選列 | 內容寬 1234／容器 1344（未溢出）。compact 字級放大 ≈7% → ≈1320，逼近上限 → 列為風險 G-08 |
| S5 | **各事件敘述的實際高度** | 25 個事件真實文字，在 340／470 寬、行高 36／29.6／31.5 下量高 | 03 事件 06 在旁註版 216px（compact 252px）→ 加上標題與兩則引言放不下 457px → 列為 G-05，並已有緩解方案（引言事件 07 起顯示） |

**S1 的重要推論（寫入設計）**：因為舞台版內的排版固定在 1440×720 的邏輯座標，**螢幕大小只影響縮放，不影響換行**。所以「文字排版會因螢幕不同而有不同位置」這個問題，在舞台版只會因為**文字內容改變、字型載入、compact 字級切換**而發生；在流式版才會因寬度而換行，而流式版我們用 in-flow 註記列繞過。因此：**用程式量測錨點（而非寫死座標）＋在對的時機重新量測**，就足夠且穩定。

---

## 1. 決策紀錄（Decision / Rationale / Alternatives）

### R1　技術堆疊
- **決策**：React 19＋TypeScript＋Vite＋Tailwind CSS v4（`@tailwindcss/vite`）＋zustand＋lucide-react；測試 Vitest＋Testing Library＋Playwright；內容驗證 zod＋`yaml`。
- **理由**：README 建議 Vite＋React；Tailwind v4 以 CSS 設定 token（`@theme`），與設計系統的 CSS 變數天然對應；zustand 只有 1 KB 級、沒有 Provider 地獄，適合「頁面／焦點／追蹤／伏筆」這種跨元件狀態。
- **替代**：Redux（過重）、Context only（高頻狀態如拖曳會造成大範圍重繪）。

### R2　Tailwind 主題化
- **決策**：`@theme` 內先 `--color-*: initial`（清掉預設色盤，避免誤用非設計色），再貼入 Classical 的 `--color-*`／`--font-*`／`--shadow-*`／`--radius-*`；`--color-text` 在 Tailwind 命名為 `ink`（避免 `text-text`）。共用樣式用 `@utility`／`@layer components`；版型與字級補償用 `@custom-variant stage|flow|compact`（以 `data-layout`／`data-compact` 屬性驅動，見 R3）。
- **理由**：版型切換不是單純的寬度斷點（還包含直立與倍率門檻），不能用 `md:` 取代；用屬性驅動的自訂 variant，元件可寫 `flow:text-[15px] stage:text-[16px]`。
- 細節見 [design-system.md](design-system.md)。

### R3　舞台＋流式雙版型
- **決策**：`LayoutProvider` 以 `visualViewport`／`resize` 計算 `{mode, s, compact}`，寫到根元素 `data-layout`、`data-compact` 與 CSS 變數 `--stage-scale`；舞台以 `transform: translate(-50%,-50%) scale(s)`（**不加** `will-change: transform`，避免文字模糊）。元件以 Tailwind variant 與 `useLayout()` 兩者並用：樣式差異用 variant，結構差異（如節點座標組、Popover 呈現）用 hook。
- **替代**：方式 B（所有尺寸乘 `--u`）— 每個尺寸都要 `calc()`，與 Tailwind 工具類衝突，否決；CSS container queries 單獨處理 — 無法表達「倍率過小就切流式」，否決。

### R4　座標換算
- **決策**：`localPoint(el, clientX, clientY)`（S2 驗證）取代設計稿的 `toStage(e)`。所有拖曳（節點、光譜、比較滑桿、伏筆）與量測都以「目標容器本身」為參考座標。
- **理由**：不依賴全域倍率，節點拖曳還要疊加關係圖 zoom，這樣最不易出錯。

### R5　Popover：舞台內自製，不用原生 Popover API
- **決策**：`PopoverLayer` 渲染在舞台內最上層（z-index 高於托盤、低於人物誌）；位置＝錨點 rect 以 `localPoint` 換成舞台座標，預設放下方 12px，不足翻上方，水平夾在舞台內；流式版改底部小卡＋scrim。實作 light-dismiss（點外部、Esc）、焦點回到錨點、`role="dialog"`。
- **理由**：原生 top-layer 不受舞台 transform 影響，需手動套倍率與座標換算（設計稿 §0 已警告）；自製後 Popover 自然跟著舞台縮放。DESIGN_README 明示允許「改用舞台內的自製 popover」。
- **風險**：失去 top-layer 的「永遠最上」——不是問題，因為我們掌控 z 序（見 R20 疊層表）。

### R6　內容格式：YAML＋行內標記
- **決策**：每頁一個 YAML（`pages/00…04.yaml`），另有 `people.yaml`、`glossary.yaml`、`hints.yaml`、`ui.yaml`。以自寫 15 行 Vite plugin 載入 YAML（`yaml` 套件）；zod 驗證；長文用 `>-`／`|-` 區塊。行內標記語法見 [contracts/content-markup.md](contracts/content-markup.md)。
- **理由**：結構化內容（事件、節點、連線、引言）比 Markdown 適合；YAML 比 JSON 好維護（可註解、不必逸出引號、不怕尾逗號）。你要求的「用另外的檔案集中管理、每頁各自集中」＝這個目錄結構。
- **替代**：JSON（可行但易錯）、Markdown＋frontmatter（事件／連線表格式難驗證）。若你堅持 JSON，只換 loader，其餘不變。

### R7　人名自動辨識
- **決策**：`people.yaml` 為每人定義 `aliases`（含「陛下」等）與 `autoLink: false` 的歧義別名（法恩「特使」、黑影男人「男人」、艾利安「安」）。`RichText` 在渲染時以最長優先比對別名並包成人名連結；歧義別名**只**在作者明確標 `{p:艾利安|安}` 時連結；跳過已在標記內（名詞、伏筆）的片段由 tokenizer 處理巢狀。
- **理由**：`內容準備與設計稿修改.md`「別名」表已列出這些陷阱（錯字、歧義、「東方晨星」同時是稱號與名詞→名詞優先）。

### R8　伏筆框格跟隨文字（需求 #6 的核心）
- **決策（桌機／舞台版）**：
  1. 內容用 `{h:hint-id|片語}` 標回收處 → 渲染為 `<span class="hint-anchor" data-hint="hint-id">`（雙底線樣式）。
  2. `HintSlotLayer` 在 `useLayoutEffect` 內對每個錨點取 `getClientRects()` 的**最後一個 rect**，以 `localPoint(敘述面板)` 換成面板座標 `(ax, lineTop, lineBottom)`。
  3. 框格 x＝旁註欄固定 x（02–04 左欄 620＝文字 470＋旁註欄 150，G-05）；y＝錨點所在行的中線；依 y 排序後做**垂直防撞**（最小間距＝框格高 28＋8，必要時往下推、超出面板底部則整體上推）。
  4. 弧線＝三次貝茲曲線：起點錨點末端 → 沿「行距間」往右 → 彎向框格左緣；控制點加由 `hash(id)` 決定的 ±1.5px 微擾動（手繪感，但每次重畫一致）；同一行兩個錨點的弧線 y 錯開 3px。
  5. **重新量測時機**：敘述面板 `ResizeObserver`、`document.fonts.ready`＋`fonts` 的 `loadingdone`、目前事件變更、`data-compact` 變更、版型切換。
- **決策（流式版）**：`RichText` 在錨點後第一個 `，；。` 之後插入 `NoteRow`（**`display:block`**，不可用 inline-block，見 S3b；插入點由 `resolveNoteInsertionPoint()` 決定，可替換策略，見 `docs/設計決策-手機版伏筆註記列位置.md`）；框格在其中；短弧線用 SVG 畫在該列內（只需錨點 x，量測失敗時退化為不畫弧線仍可用）。S3 驗證可行。
- **流式版為什麼不用量測（回應「手機版是否最難排」）**：框格列本身是**文字流裡的一個元素**（`display:block; height:50px`），由瀏覽器排版引擎負責「它佔一整列、把它後面的文字往下推」。換行、行距、列高都由瀏覽器算，所以**不論螢幕多窄、字型何時載入，它永遠緊接在錨點後的標點之後**，不可能錯位（S3 實測）。難點反而在舞台版：框格在文字**旁邊**而不在文字流裡，才需要量測。流式版唯一還需要量測的是「弧線起點 x」（讓弧線指到雙底線末端），這是純裝飾，失敗也只是少一條弧線。與設計稿的差異：設計稿說插在「那一行」下方，我們改為「錨點後第一個標點之後」，因為「那一行」會隨寬度變動，而標點位置不會。
- **需要的標註**：只需要「回收處片語」這一種標記（`{h:…}`）；**不需要**在文字上標註「可以放框格的位置」或行號。框格位置由錨點量測得到。作者只要保證：① 片語是敘述中的連續文字；② hint-id 存在於 `hints.yaml`；③ 同一事件的片語不重疊。建置驗證會檢查這三點。
- **替代**：寫死座標（設計稿的做法）——換字型、改文字、compact 就會跑掉，否決；把框格塞進段落（設計稿也否決，會被看成原文）。

### R9　關係圖：自寫，不用圖形庫
- **決策**：SVG 連線層＋HTML 節點層，疊在同一個變換容器內；節點座標以**比例（0–1）**儲存（桌機、流式各一組），執行時乘上容器實際尺寸（`ResizeObserver`），因此流式版寬度任意都能拉開。
- **理由**：版面是人工配置（設計稿的座標），不需要力導向；React Flow 等庫要大量客製才能達到設計的純文字節點、線種、逐條畫出、亮暗通道；D3 force 無必要。
- **替代**：React Flow／D3-zoom — 引入 100 KB+ 且仍要覆寫大部分樣式與互動，否決。

### R10　逐條畫線動畫
- **決策**：連線皆為**直線**（設計稿如此）。畫出進度 `t∈[0,1]`，終點 `P = A + t(B−A)`，由 `requestAnimationFrame` 驅動（每條 400ms、ease-in-out、條間隔 120ms）；箭頭為自繪三角形 `<path>`，在 `t=1` 後以 CSS 淡入。虛線（衝突／試探）因為是改終點而非 `stroke-dashoffset`，**不會破壞虛線樣式**。`prefers-reduced-motion`→ `t` 直接 1。
- **為什麼不用 `stroke-dashoffset`**：虛線線種會與畫線動畫互相干擾；也不用 SVG `<marker>`，因為 marker 無法隨亮／暗狀態換色與縮放。

### R11　節點拖曳＋回彈
- **決策**：Pointer Events＋`setPointerCapture`；拖曳期間節點位移存在狀態中使連線即時跟隨；放開後以小型彈簧（`rAF`，過衝約 6%、約 400ms）把位移推回 0。流式版停用節點拖曳（與平移衝突）。
- **理由**：CSS transition 無法讓連線同步跟隨，必須由 JS 驅動位移。

### R12　縮放／平移與觸控捲動衝突
- **問題**：關係圖框（342×372）若 `touch-action: none`，手指在圖上就無法捲動頁面。
- **決策**：縮放為 100% 時，容器 `touch-action: pan-y`（單指垂直滑動＝頁面捲動）；使用者按 ＋ 或雙指放大後（zoom > 100%）切為 `touch-action: none` 並出現「重設」，此時單指拖曳＝平移。雙指縮放以兩個 pointer 實作，視為「盡力而為」；**縮放按鈕（＋／−）是保證可用的替代操作**。桌機：滾輪＋Ctrl 縮放、拖曳空白處平移。
- **風險**：不同瀏覽器對 `pointercancel` 的時機略有差異 → 以 Playwright（Chromium＋WebKit 觸控模擬）驗證；失敗則僅保留按鈕縮放。

### R13　人物卡位置與動畫：slot＋transform transition（不需要 FLIP 函式庫）
- **決策**：卡片固定尺寸、一律 `position:absolute; left:0; top:0`，位置由 `transform: translate(x,y)` 決定，x,y 來自「slot 指派」查表；切換排列／中心視角只是換指派，CSS `transition: transform 360ms cubic-bezier(.2,.7,.2,1)` 自動產生位移動畫。
- **理由**：位置是資料已知的，不必量測 DOM 做 FLIP；也就避開了動畫庫的 layout projection 在「被 `transform: scale` 的祖先」內會算錯的已知問題。視覺結果與 FLIP 相同。尺寸變化（標準卡↔精簡卡）以 `width/height` 過渡處理。
- **展開浮層**：從卡片原位 rect（資料已知）用 `transform: scale/translate` 放大到 600×508，transform-origin 取卡片中心；底下加 scrim。

### R14　人物中心視角版面
- **決策**：固定「環繞 slot 表」（見 data-model「CenterSlot」），指派函式 `assignCenterSlots(centerId, progress)` 為純函式；連線為直角折線，由 slot 預先定義的「出線錨點」（中心卡邊緣）與「入線錨點」生成路徑字串；線上文字掛在第一段水平線中點。關係資料＝合併 01…目前主軸的連線＋「跨主軸補充關係」表，依人物配對合併（同一對人的多個關係文字以「・」串接，線種取最高優先）。
- **驗證方式**：單元測試對 15 人×進度 0–4 產生所有指派，斷言卡片矩形不重疊、不超出 1344×540 卡片區、無人遺漏。

### R15　鏡像對照卡 3D
- **決策**：外層 `perspective: 900px`；中層做閒置動畫（CSS keyframes，rotateY ±8°、8s）；內層 `transform-style: preserve-3d` 做翻面（rotateY 0/180、600ms），兩面 `backface-visibility: hidden`；厚度以偏移陰影（`box-shadow: 8px 0 0 -2px neutral-300`）表現。閒置動畫與翻面分在不同元素以免 transform 互相覆蓋。
- **Safari 注意**：祖先若有 `overflow:hidden`＋`filter` 會把 3D 壓平；04 頁沒有 sepia filter（那只在 02），卡片外層不放 `overflow:hidden`。需帶 `-webkit-backface-visibility`。
- `prefers-reduced-motion`：移除閒置 keyframes；翻面改兩面 opacity 交叉淡入。

### R16　02 時間感（整頁變舊）
- **決策**：`--age`（0–1）寫在舞台根元素，由比較滑桿更新（以 `rAF` 節流，量化到 1/60 級）。三個層次：① 紙色 `color-mix(in oklch, var(--color-bg), var(--color-accent-200) calc(var(--age) * 42%))`；② 內側暈影（`::after` 覆蓋層，`pointer-events:none`）；③ `filter: sepia(calc(var(--age) * .35))` **只套在內容容器**，側欄與疊層（Popover、托盤、抽屜）放在容器外，不受 filter 影響。
- **效能風險**：`filter` 在拖曳中每格都重繪大面積。緩解：節流＋量化；若實測掉幀，退化為只套①②（不套 sepia）。
- 文字對比：`age=1` 時內文改 `neutral-900`（以 `--age` 在 CSS 內插值）。

### R17　路由與導覽
- **決策**：自寫 hash 路由（約 30 行）：`#/`、`#/axis/{1-4}`、`#/people`。開啟人物誌時以 `history.pushState` 記錄 `returnTo`，瀏覽器「上一頁」＝關閉人物誌；直接進 `#/people` 時 `returnTo='#/'`。
- **理由**：Pages 沒有 SPA 回退，hash 路由不需任何伺服器設定；不需要 react-router。

### R18　狀態與持久化
- **決策**：zustand 分片（nav、axis、graph、tracking、hints、people、ui）；`persist` 僅用於 `tracking`、`hints`（localStorage）與 `page04Unlocked`（sessionStorage）；所有儲存存取包 try/catch（隱私模式不可用時退化為記憶體）。
- **理由**：見 data-model「執行期狀態」。可見性規則寫成純函式 selector（憲章 V）。

### R19　鍵盤合約
- **決策**：單一 `useGlobalKeys` 掛在 `document`：略過 `event.defaultPrevented`、`target` 為 `input/textarea/select/[contenteditable]/[role=slider]/[data-no-arrows]`、人物誌開啟、流式版；執行換頁／推進時 `preventDefault()`。元件（光譜、比較滑桿）自己處理方向鍵並 `preventDefault()`。
- 詳見 [contracts/state-and-events.md](contracts/state-and-events.md)。

### R20　疊層順序（z-index 表）
頁面內容 < 側欄 < 伏筆托盤 < Popover < 獲得提示／追蹤回饋 < 04 劇透遮罩（只蓋頁首以下，側欄不被蓋）< 人物誌抽屜（蓋整個舞台含側欄）。人物誌開啟時其下方 `inert`。以 CSS 變數 `--z-*` 管理。

### R21　字型
- **決策**：沿用設計稿 Google Fonts（Cormorant Garamond 400/500/600、Lora 400/500、Noto Serif TC 400/500/600，`display=swap`）。字型載入前後換行可能改變 → 觸發錨點重新量測（R8）。
- **替代**：`@fontsource`（自行託管，Noto Serif TC 會產生數百個切片檔）。G-27 待確認。

### R22　測試策略
- **單元（Vitest）**：標記解析、別名辨識、可見性 selector（Popover 階段、登場、劇透）、事件→連線可見性、中心視角 slot 指派、排列 slot、伏筆判定與持久化、`localPoint`（以 jsdom 的假 rect）。
- **內容驗證**：`npm run content:check`（zod＋跨檔參照＋標記）。
- **元件／行為（Testing Library）**：鍵盤合約、拖曳替代操作、Popover 開關。
- **E2E／視覺（Playwright）**：固定視窗矩陣（見 plan.md）× 關鍵頁；斷言「無水平捲軸」「伏筆框格座標在各桌機尺寸一致」「框格互不重疊」；觸控（WebKit／Chromium mobile 模擬）驗證點選替代操作與捲動不被關係圖攔截。
- **不做**：像素級截圖比對（字型與抗鋸齒差異大，易誤報）；改以幾何斷言。

### R23　建置與部署
- **決策**：Vite `base` 依模式設定（`production → '/Draven/'`）；`dist/` 由 GitHub Actions 官方 Pages 流程部署（`upload-pages-artifact` → `deploy-pages`）；CI 先跑 `npm run check`（lint＋型別＋內容驗證＋單元測試）。Playwright E2E 另設 workflow（PR 與手動觸發），不擋部署以免拖慢。細節與新手教學見 [../../docs/部署教學-GitHub-Pages.md](../../docs/部署教學-GitHub-Pages.md)。
- **備案**：`gh-pages` 套件手動部署（概念更少），在教學中列為備案。

### R25　文字不可選取、不可複製（N-01）
- **決策（多層防線，皆為純前端）**
  1. **CSS（主力）**：`@layer base { *, *::before, *::after { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; } }`。`user-select: none` 讓瀏覽器不會產生選取範圍（滑鼠拖曳、雙擊選字、三連擊選段落、Ctrl+A 都選不到文字）；`-webkit-touch-callout: none` 擋 iOS 長按出現的「拷貝／查詢」選單。Tailwind 的 `select-none` 也是同樣的宣告，我們直接放在 base 層全域生效。
  2. **事件（保險）**：在 `document` 監聽 `selectstart`、`copy`、`cut`、`dragstart`，一律 `preventDefault()`；`copy` 時另外 `clipboardData.setData('text/plain','')` 清空，避免瀏覽器仍帶出內容（Ctrl+A 後 Ctrl+C）。
  3. **圖片與連結**：`img { -webkit-user-drag: none; pointer-events:none }`（明信片圖等），避免被拖出。
  4. **選擇性（預設關閉）**：攔截 `contextmenu`（右鍵選單）。只能擋住「右鍵→拷貝」，擋不住快捷鍵與工具，且會讓人無法使用瀏覽器基本功能，**不建議開**；以 `ui` 旗標 `protect.contextMenu` 留作開關。
- **為什麼 CSS 為主**：事件攔截可被關閉 JavaScript 或換瀏覽器繞過，CSS 是瀏覽器原生行為，最穩；兩者疊加。
- **不影響什麼**：點擊、拖曳（反而更好：拖曳伏筆關鍵字、節點、滑桿時不會誤選到文字）、鍵盤操作、螢幕閱讀器朗讀（它讀的是 DOM／無障礙樹，不是「選取」）、瀏覽器內建搜尋（Ctrl+F 找得到）。本站沒有 `input`／`textarea`，因此不需要例外；若日後加入表單，用 `.allow-select` 覆寫。
- **做不到的事（必須誠實說明）**：① 「檢視原始碼」與開發者工具看得到全部文字——YAML 內容會被打包進 JS，等同公開；② 截圖、翻拍、OCR；③ 瀏覽器閱讀模式、「另存網頁」、關閉 CSS／JS；④ 螢幕閱讀器與無障礙工具。**所以這是防止一般讀者隨手複製，不是加密。** 若要更強（例如把文字畫成圖片／canvas），代價是搜尋、無障礙、翻譯、縮放品質全部變差，且內容仍可被截圖，不建議。
- **無障礙取捨**：不用 `aria-hidden` 或移除文字來「保護」，避免傷害視障讀者；保護只做在「選取與複製」這一層。
- **驗證**：單元測試 `copy`／`selectstart` 被取消；Playwright 以三連擊與 Ctrl+A 後 `getSelection().toString()` 應為空（SC-008）。

### R24　效能
- 關係圖重繪只由 `rAF` 驅動的進度與拖曳位移觸發，節點／連線以 `memo` 切分；內容一次載入（YAML 打包進 bundle，總量 < 100 KB）；各頁專屬元件以 `React.lazy` 分割（例如 04 的 3D 卡）。不使用虛擬化（每頁最多約 11 節點、15 張卡）。

---

## 2. 可行性矩陣（互動 × 技術 × 風險 × 結論）

| 互動 | 做法 | 風險 | 結論 |
|---|---|---|---|
| A1 換頁／A2 逐事件／鍵盤 | hash 路由＋zustand＋全域鍵盤合約（R17、R19） | 低 | ✅ |
| A3 人物誌抽屜／A4 伏筆托盤 | 舞台內疊層＋`inert`＋`returnTo` | 低 | ✅ |
| B1 人名 Popover／B2 名詞 | 舞台內自製＋`localPoint`（R5） | 低（要處理邊界翻轉） | ✅ |
| B3 追蹤 | 事件參與者資料＋書籤標記 | 低 | ✅ |
| B4 獲得伏筆／B5 對答案 | Pointer Events 拖曳＋點選替代＋框格狀態機 | 中（框格跟隨文字） | ✅ 見 R8、S1–S3 |
| C1 逐條畫線 | 直線終點插值＋自繪箭頭（R10） | 低 | ✅ |
| C2/C3 焦點亮暗 | 派生 selector＋CSS opacity 過渡 | 低 | ✅ |
| C5 節點拖曳回彈 | Pointer＋rAF 彈簧（R11） | 低 | ✅ |
| C6 縮放平移 | 變換容器＋滾輪／雙指／按鈕（R12） | 中（觸控與頁面捲動衝突） | ✅ 以按鈕為保證 |
| C7/C8 圖例／標籤開關 | 狀態＋CSS | 低 | ✅ |
| D1 交叉連結 | 舞台版直接閃動；流式 `scrollIntoView`＋閃動 | 低 | ✅ |
| D2 光譜 | 自製 slider（role、方向鍵合約） | 低 | ✅ |
| D3 比較滑桿＋時間感 | `--age` 三層（R16） | 中（filter 效能） | ✅ 有退化方案 |
| D4 三界分層 | 層帶高度過渡＋節點垂直置中 | 中（收合時跨層線改接層頭） | ✅ |
| D5 劇透遮罩 | 覆蓋層＋`inert`＋sessionStorage | 低 | ✅ |
| D6 鏡像卡 3D | CSS 3D 三層元素（R15） | 中（Safari 壓平 3D） | ✅ |
| D7 明信片 | 2 面翻轉；素材待提供 | 低 | ✅ 占位圖 |
| E1 登場／E2 標籤 | 資料派生＋兩個獨立視覺通道 | 低 | ✅ |
| E3 中心視角／E4 排列 | slot 表＋transform 過渡（R13、R14） | **中高**（演算法需定義） | ✅ 純函式＋窮舉單元測試 |
| E5 劇透顯示 | 不渲染 DOM 的遮蔽區塊 | 低 | ✅ |
| 任意螢幕適應 | 雙版型＋比例座標＋`localPoint`（R3、R4、R9） | 中 | ✅ S1、S2 |
| 內容集中管理 | YAML＋標記＋建置驗證（R6、R7） | 低 | ✅ |
| GitHub Pages | Actions 官方流程＋hash 路由（R23） | 低 | ✅ |

---

## 3. 風險登記（Risk Register）

| ID | 風險 | 可能性 | 影響 | 緩解 |
|---|---|---|---|---|
| K1 | 02–04 左欄放不下（旁註欄＋引言） | 已緩解（G-05：左欄 620／關係圖 628） | 低 | 敘述文字回到 470 寬，最長事件 5 行×36＝180px；專屬區塊保留 `overflow-y:auto`；T121 以 Playwright 斷言「無溢出」；代價是 03「人間」層 6 節點需拆兩列 |
| K2 | 字型載入或 compact 造成換行改變，框格錯位 | 中 | 中 | R8 的重新量測時機；e2e 在 compact 下斷言 |
| K3 | 02 時間感 `filter` 掉幀 | 中 | 低 | 節流量化；退化為只改紙色與暈影 |
| K4 | iOS Safari 3D 翻面與文字模糊 | 中 | 低 | 不套 `will-change`；真機檢查；退化為淡入淡出 |
| K5 | 觸控下關係圖攔截頁面捲動 | 中 | 中 | R12 規則；按鈕縮放保證可用 |
| K6 | 中心視角人數多時版面擠 | 中 | 中 | 12 slot＋遠層；窮舉測試 |
| K7 | 內容量增加導致事件列標題截斷 | 低 | 低 | 設計稿已規定截斷＋title；compact 時允許多一行 |
| K8 | Pages 免費方案要求公開倉庫，原稿全文會公開 | ✅ 已處理（2026-10-07） | — | `contents/`、`docs/` 已從歷史移除並列入 `.gitignore`、遠端已強制覆蓋（D-01）；`specs/` 內的原文引句仍在版控，待你決定 |
| K11 | 「不可複製」被誤認為能防止所有複製 | 中 | 中 | R25 已明示限制；spec FR-092 聲明；不為此犧牲無障礙 |
| K9 | Google Fonts 在特定地區無法載入 | 低 | 中 | 字型 fallback 到系統襯線；G-27 備案自行託管 |
| K10 | 作者新增內容時標記寫錯 | 中 | 中 | 建置期驗證並指出檔案與位置 |
