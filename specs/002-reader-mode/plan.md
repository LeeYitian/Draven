# Plan：好讀版

## 架構
```
src/features/reader/
  source.ts         純函式：原文(html/md/txt) → Block[]；自寫極小 tokenizer，不用 DOMParser（Node 與瀏覽器共用）
  toc.ts            純函式：Block[] + toc.yaml → 目錄（錨句比對）
  bookmark.ts       純函式：選取 → Bookmark；Bookmark + Block[] → 段落 index
  loadNovel.ts      DEV：本機檔（import.meta.glob，僅 DEV）；PROD：fetch(VITE_NOVEL_URL)
  ReaderPage.tsx    頁面骨架（頂列、目錄、文章、頁尾）
  Article.tsx       Block[] → React（不使用 dangerouslySetInnerHTML）
  SelectionToolbar.tsx  反白浮動選項
  ReaderToc.tsx / ReaderBar.tsx
src/store/reader.ts   zustand：theme、fontSize、bookmark（persistentStorage）
src/styles/reader.css 閱讀樣式與深淺色代幣
worker/               Cloudflare Worker（index.js、wrangler.toml）
scripts/fetch-emoticons.ts   下載表情圖
```

## 關鍵決策
1. **原文不進建置產物**：PROD 不含 `glob`；`dist/` 掃描特徵字串驗證（SC-3）。
2. **自寫解析**：來源只允許 `p br i em b strong h1-h3 img(表情)`；其餘標籤剝除。輸出為資料模型，React 渲染，天生避免 XSS。
3. **段落為定位單位**：目錄與書籤都定位到 `<p data-b=index>`；書籤另存 `quote` 防來源更新。
4. **深淺色**：`.reader[data-reader-theme]` 覆寫 reader 專用 CSS 變數；`html[data-reader-theme]` 同步頁面底色與 `color-scheme`。
5. **保護**：`protect-content.ts` 的 `selectstart` 對 `[data-reader-article]` 放行；其餘事件照擋，另加 `contextmenu`（僅 reader）。列印以 CSS 隱藏。
6. **表情圖**：以檔名 hash（原 URL basename）對應 `public/images/emoticons/<hash>.png`。

## Constitution Check
- I 文字與程式分離：介面字串→`ui.yaml`；小說內容為外部資料。✔
- II 雙版型：好讀版是獨立全頁、流式排版，不屬舞台；側欄入口兩版型都做。✔（說明：不用舞台縮放）
- III 設計代幣：reader 深色色盤集中在 `reader.css` 代幣區，元件不寫 hex。✔
- IV 互動降級：浮動按鈕之外提供頂列「記錄目前位置」。✔
- **IV-b 文字保護：需修訂（v1.2.0）**——好讀版文章區允許反白（為記錄進度），仍禁複製／剪下／拖曳／列印。
- V 劇透：好讀版內容為全文，與導覽的劇透規則無關；入口不受劇透保護，已知悉。
- VI 依賴：不新增執行期依賴。✔
- VII 可部署：`deploy.yml` 加 `VITE_NOVEL_URL`（Repository variable）。無原文時 build 仍成功。✔

## Complexity Tracking
| 項目 | 為何必要 | 更簡單方案為何不行 |
|---|---|---|
| Cloudflare Worker + KV | 原文不能進 repo，Secret 放不下 | Secret 上限 48KB；R2 需綁卡 |
| 自寫 HTML tokenizer | Node 腳本與瀏覽器共用、避開 DOMParser | 引入 sanitize 套件違反 VI |
