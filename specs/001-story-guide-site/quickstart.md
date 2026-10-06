# Quickstart：開發、改文字、驗收、部署

> 專案尚未建立（Phase 1 之後才有 `package.json`）；本文件描述**建立後**的標準流程，並列出可直接拿來驗收的情境。

## 1. 開發
```bash
npm install            # 第一次
npm run dev            # 開發伺服器（含 /__kit 元件圖鑑、?debug=anchors 錨點除錯）
npm run check          # lint＋型別＋內容驗證＋單元測試（CI 也跑這個）
npm run e2e            # Playwright 視窗矩陣（需先 npx playwright install）
npm run build          # 產生 dist/（base=/Draven/）
npm run preview        # 在本機預覽 dist（用 /Draven/ 路徑）
```

## 2. 要改文字，只改這裡
| 想改什麼 | 檔案 |
|---|---|
| 00 導言、三個世界、四條主軸 | `src/content/pages/00.yaml` |
| 01–04 的事件敘述、標題、標籤、節點副標、連線文字、圖例 | `src/content/pages/0X.yaml` |
| 人物卡、Popover 階段文字、完整介紹（含劇透） | `src/content/people.yaml` |
| 名詞解釋 | `src/content/glossary.yaml` |
| 伏筆關鍵字、解開後說明、獲得／回收主軸 | `src/content/hints.yaml` |
| 按鈕、提示、aria 標籤等介面文案 | `src/content/ui.yaml` |

在文字中：`{p:id}` 人名、`{t:id}` 名詞、`{x:spectrum|見下方 ↓}` 交叉連結、`{h:hint-id|片語}` 伏筆回收處（規則見 contracts/content-markup.md）。改完執行 `npm run content:check`，錯誤會指出檔案與位置。**不需要動任何 `.tsx`。**

## 3. 校正關係圖節點位置（開發模式）
`npm run dev` → 打開 `http://localhost:5173/?editor=1#/axis/1`（`?editor=1` 寫在 `#` 之前的一般查詢字串）→ 拖曳節點 → 按「複製座標」→ 貼到該頁 YAML 的 `graph.layout.desktop`（或 `flow`）。桌機與流式各自一組。

## 4. 部署
見 `docs/部署教學-GitHub-Pages.md`。日常：`git push origin main` → 1–3 分鐘自動上線。

## 5. 驗收情境（手動，對應 spec 的 Acceptance Scenarios）
**A. 版型與縮放（US1）**
1. 桌機瀏覽器把視窗調到 1920×950／1366×640／1280×600：舞台等比縮放、置中、無捲軸；1280×600 時字級補償（輔助字 14、內文 17）。
2. 把視窗寬度拉到 < 1024，或縮高到使倍率 < 0.72：切成流式版，底部出現導覽列。
3. 手機（或 DevTools 手機模式 390×844、360×740、320×640）：可捲動、無水平捲軸。

**B. 主軸頁（US2）** — 打開 `#/axis/1`
1. →→ 推進事件：敘述淡出淡入、新關係線依序畫出；← 後退：後面的線淡出。
2. 直接點事件 05：02–04 的線立即變暗顯示；點節點「法恩」：事件焦點取消、法恩連線亮起、事件列法恩出場編號金色加底線。
3. 拖曳節點：放開彈回，連線全程跟隨。圖例點「衝突」：衝突線隱藏。
4. 手機：事件列橫向滑、上一個／下一個、關係圖上單指垂直滑動仍能捲頁面；按＋放大後可平移並出現「重設」。

**C. Popover／追蹤（US3）**
1. 點「德雷文」：Popover；在 04 時只顯示到 03 的內容；在 00／01 只有基本身分。
2. 人物誌點艾利安的「追蹤」：回到原頁，側欄區塊閃動，事件格出現書籤；00 與關係圖不標亮。

**D. 人物誌（US4）** — `#/people`
1. 直接進入：全灰階；在 02 打開：彩色＝01–02 出場者。
2. 點標籤「家人」：成員浮起（含灰階的利歐蘭），其餘不動。
3. 點卡片：重排、置中；再點中心卡：原位放大；劇透區塊點擊才顯示。

**E. 伏筆（US5）**
1. 進入 02：徽章 8 並閃動、提示出現。
2. 打開 `#/axis/3`，推進到事件 06：三個框格各自連到雙底線片語；拖「忘了送的禮物」到錯的框：震動並回托盤；到對的：鎖定＋閃動＋說明。
3. 調整視窗尺寸／切換 compact：框格仍貼著各自那一行；手機版框格出現在子句後的註記列，用點選放置。

**F. 專屬（US6）** — 01 光譜、02 比較滑桿（右拉整頁變舊）、03 三界收合、04 遮罩→鏡像卡→明信片（見 spec US6）。

## 6. 常見操作
- 新增一個事件：在該頁 YAML `events` 加一項、`graph.edges` 補 `event: n`、必要時補 `participants`；事件列會自動變成 N+1 等分。
- 新增一個人物：`people.yaml` 加一筆（含 `aliases`、`popover` 4 段）；在需要的頁面 `graph.nodes` 與座標中加入。
- 換明信片插圖：把圖放到 `public/images/postcard-front.jpg`（建議 760×460 以上），不需改程式。
