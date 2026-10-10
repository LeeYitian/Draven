# Tasks：好讀版
格式同 001。`[手動]`＝需使用者操作。

## Phase 1 純邏輯（先測試）
- [x] T201 `source.ts`：html／md／txt → Block[]（tests/unit/reader-source.test.ts）
- [x] T202 `toc.ts`：錨句比對、nth、順序與缺漏檢查（reader-toc.test.ts）
- [x] T203 `bookmark.ts`：建立與還原（reader-bookmark.test.ts）
- [x] T204 `store/reader.ts`：theme／fontSize／bookmark 持久化與降級

## Phase 2 內容與資產
- [x] T205 `scripts/fetch-emoticons.ts` 並執行；圖片放 `public/images/emoticons/`
- [x] T206 `toc.json`（原 toc.yaml，見 clarifications C-9）初稿（依 full.html 章節）＋ schema＋`content:check` 擴充
- [x] T207 `ui.yaml` 加 `reader.*`、`dock.reader`

## Phase 3 介面
- [x] T208 `BookOpenIcon`（附件 path）＋ SideDock／BottomDock 入口（6 欄）
- [x] T209 路由 `#/read`＋ App 分支（不進 Stage／FlowShell）
- [x] T210 `reader.css`（版面、深淺色代幣、列印隱藏）；`index.html` 字型範圍
- [x] T211 ReaderPage／Article／ReaderBar／ReaderToc／頁尾聲明
- [x] T212 SelectionToolbar＋書籤標記＋還原捲動
- [x] T213 `protect-content.ts` 放行 reader 的 selectstart，加 contextmenu；憲章 v1.2.0

## Phase 4 來源與部署
- [x] T214 `loadNovel.ts`（DEV 本機／PROD Worker）
- [x] T215 `worker/`（index.js、wrangler.toml）＋ `docs/設定worker和KV.md`
- [x] T216 `deploy.yml` 帶入 `VITE_NOVEL_URL`；dist 掃描腳本
- [ ] T217 [手動] Cloudflare：建 KV、部署 Worker、上傳 `full`、設定 Repository variable

> 說明：T217 需要使用者操作（見 docs/設定worker和KV.md B）。T218：`tests/e2e/reader.spec.ts` 16 項通過（含 axe 淺／深色）。T219：`npm run check` 通過；完整 e2e 有 5 項與好讀版無關的既有失敗（perf 3、touch 2，見 clarifications「已知問題」）。

## Phase 5 驗收
- [x] T218 Playwright：桌機／手機 × 淺／深；axe；保護；書籤還原
- [x] T219 `npm run check`、`npm run build`、真機檢查清單
