# Feature Specification：好讀版（小說閱讀模式）

**Feature Branch**：`feature/read-the-article`　**Spec 編號**：002
**Created**：2026-10-10　**Status**：Draft → 已與使用者確認（見 [clarifications.md](clarifications.md)）
**Input**：使用者需求 5 點 + 附件 icon（`icon-好讀版.svg`）+ `src/content/full.html`（Plurk 互動小說匯出，約 16 萬字）

> 本 spec 寫「讀者能做什麼」。做法在 [plan.md](plan.md)；給作者的約定在 [contracts/](contracts/)。
> 憲章（`.specify/memory/constitution.md`）仍適用；本功能需要修訂 IV-b（見 plan.md「Constitution Check」）。

## User Scenarios & Testing

### US1 — 從側欄進入好讀版並閱讀全文（P1）
側欄（桌機：「伏筆」下方；手機：底部導覽列「重置進度」左方）新增「好讀版」按鈕，圖示為附件的翻開書本。點擊進入全頁閱讀模式（路由 `#/read`），顯示 `full.html` 的小說全文。

- **桌機**：置中單欄、行寬約 34–38 字；左側固定目錄欄（視窗夠寬時）；頂部細列有「返回導覽」「目錄」「字級」「深淺色」。
- **手機**：單欄滿版、左右留白；目錄以底部面板開啟；頂列精簡。
- **Acceptance**
  1. 兩種版型下側欄都有「好讀版」按鈕（桌機在伏筆下、手機在重置進度左），圖示與附件一致、粗細 1.5、`currentColor`。
  2. 進入後看到全文，無水平捲軸；「返回導覽」回到進入前的頁面。
  3. 文字原有的段落、換行、斜體、表情圖保留；段落間距與行高符合中文長文閱讀（見 FR-003）。
  4. 全文載入中顯示載入狀態；載入失敗顯示可重試的錯誤訊息，不白屏。

### US2 — 深色模式（P1）
起始值依系統 `prefers-color-scheme`；讀者可手動切換，切換後記住（優先於系統）。
- **Acceptance**：系統為深色時首次進入即深色；手動切到淺色後重整仍為淺色；深色下文字對比 ≥ 7:1（正文）、表情圖不刺眼。

### US3 — 目錄與跳轉（P1）
目錄列出章節標題；點擊後捲到 html 中對應位置。目錄由 `contents/toc.json` 以「錨句」定義（見 [docs/toc-and-source.md](../../docs/toc-and-source.md)），覆蓋 `full.html` 後不必重做。來源若是 md／純文字，`#` 開頭的行自動成為標題與目錄。
- **Acceptance**：點目錄項目捲到正確段落並短暫標示；目前所在章節在目錄中高亮；找不到錨句的項目不會讓頁面壞掉（該項停用，開發模式主控台警告）。

### US4 — 反白記錄閱讀進度（P1）
讀者反白任一段文字，在選取處旁出現浮動按鈕「記錄閱讀進度」。點擊後記錄位置（單一書籤，新的覆蓋舊的），下次開啟好讀版自動捲到該處並標示。
- **Acceptance**
  1. 反白後浮動選項出現（桌機：選取下方；手機：選取下方，避開系統選單）；取消反白即消失。
  2. 點擊後顯示「已記錄」，書籤段落左側出現標記。
  3. 重新整理／隔天再開，自動捲到書籤段落，並提供「從頭開始」。
  4. `full.html` 更新後，仍以書籤文字重新定位；找不到時提示並停在開頭，不報錯。
  5. 瀏覽器儲存不可用（隱私模式）時功能降級為本次工作階段，不丟錯。
  6. 「重置進度」（導覽的進度）**不**清除閱讀書籤。

### US5 — 內容保護與出處聲明（P1）
- 全文不可複製、剪下、拖曳、列印、右鍵選單；為了 US4，**僅在好讀版文章區**允許反白（反白不能複製）。
- 聲明原出處與來源（https://www.plurk.com/p/3ivkr0zpza）固定在**目錄區塊的最底端**（桌機側欄底部、手機目錄面板底部）。
- **誠實限制**：這只擋一般讀者的操作；擋不住檢視原始碼、開發者工具、截圖、閱讀模式。原文改由 Cloudflare Worker 在執行期提供，不在 repo 與靜態檔中，但讀者瀏覽器仍會收到明文。

### US6 — 字級調整（P2）
四段字級（小／中／大／特大），記住選擇；調整時保持目前閱讀位置。

## Requirements

- **FR-001** 側欄入口：桌機 `SideDock`「伏筆」下方；流式 `BottomDock` 於「重置進度」左方（6 欄）；圖示用自訂 `BookOpenIcon`（附件 path），與其他圖示同為 20px／stroke 1.5。
- **FR-002** 路由 `#/read`；分頁標題為「德雷文 · 好讀版」（離開時還原）；未知路徑仍回 `#/`。好讀版不套用舞台縮放（獨立全頁）。
- **FR-003** 閱讀排版：內文襯線體（Noto Serif TC，淺色 400／深色約 350）；字級預設桌機 19px／手機 17px；行高 1.95；字距 0.02em；段距 0.9em，不縮排；行寬 `max-width: 36em`；`line-break: strict`；尊重 `prefers-reduced-motion`。
- **FR-004** 深淺色：`data-reader-theme`；起始＝系統；手動切換存 `reader.theme`。
- **FR-005** 目錄：`toc.json`（title / match / nth / level）＋ md／txt 標題；位置以段落為單位；順序須與文件順序一致。**目錄與原文一樣存在 KV**（`/toc`），更新內容不需 commit；取不到目錄時退回原文標題。
- **FR-006** 書籤：`{ index, quote, total, savedAt }` 存 `reader.bookmark`；還原先以 `quote` 全文比對（就近），失敗退回 `index`（僅在 `total` 相同時），再失敗放棄並提示。
- **FR-007** 保護：好讀版內 `copy/cut/dragstart/contextmenu` 攔截、`@media print` 隱藏全文、圖片不可拖曳；`selectstart` 只放行於 `[data-reader-article]`。
- **FR-008** 出處聲明（目錄區塊底端）文案放 `ui.yaml`（`reader.footer.*`），可由作者改。
- **FR-009** 表情圖：由 `scripts/fetch-emoticons.ts` 下載到 `public/images/emoticons/`，文中以本地路徑顯示；未收錄的圖退回顯示 `alt` 文字。
- **FR-010** 原文來源：開發＝本機 `src/content/full.{html,md,txt}`；正式＝`VITE_NOVEL_URL`（Worker 根網址）下的 `/full` 與 `/toc`（Worker＋KV），Worker 檢查 `Origin`。
- **FR-011** 效能：全文渲染後首次可捲動 < 1.5s（桌機，本機快取後）；書籤還原不造成版面跳動。
- **FR-012** 無障礙：浮動按鈕是 `role=toolbar` 內的 `button`，可鍵盤操作（反白後 Tab 不易取得，另提供「在目前閱讀位置記錄」的頂列按鈕作為替代，記錄視窗頂端第一個可見段落）。

## Success Criteria
- SC-1 兩種版型 × 淺／深色，Playwright 驗收通過；axe 無 serious 以上違規。
- SC-2 單元測試涵蓋：來源解析、目錄解析、書籤還原、儲存降級。
- SC-3 `npm run check`、`npm run build` 通過；`dist/` 中不含小說原文（以特徵字串掃描）。
