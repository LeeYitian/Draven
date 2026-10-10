# 給作者的約定：原文與目錄

## 1. 更新原文與目錄
- 原文 `src/content/full.html`（或 `full.md`、`full.txt`；同時存在時 html > md > txt）與目錄 `src/content/toc.yaml` **都不進 repo**（`.gitignore`）。
- **開發機**：直接覆蓋檔案，`npm run dev` 即時預覽。
- **線上**：`npm run novel:upload` 一次上傳兩者到 Cloudflare KV（鍵 `full`、`toc`）。不 commit、不重新部署。
- 格式自動判斷：內容含 `<p`、`<br` 就當 HTML，否則當 md／純文字。

## 2. HTML 來源如何分段
| 原文 | 結果 |
|---|---|
| 連續 2 個以上 `<br>` | 段落分隔 |
| 單一 `<br>` | 段內換行 |
| `<p>…</p>`、`<h1–h3>` | 段落／標題 |
| `<i> <em> <b> <strong>` | 斜體／粗體 |
| `<img class="emoticon">` | 表情圖（本地化，見下） |
| 兩個 `<br>` 之後又有「空白行」 | Plurk 回應分段處 → 較大段距 |
| 其他標籤、script、屬性 | 一律剝除 |

## 3. md／純文字
- 空白行分段；單一換行視為段內換行。
- `# 標題`、`## 小標`：成為標題並**自動**加入目錄（level 1／2）。
- 有 `toc.yaml` 時以 `toc.yaml` 為準。

## 4. 目錄 `src/content/toc.yaml`（上傳時轉成 JSON 存進 KV）
```yaml
items:
  - title: 序章                 # 目錄顯示的文字
    match: 「陛下，剛才有魔女試圖   # 該章第一個段落中的一小段原文（錨句）
  - title: 第一章　重逢
    match: 德雷文二十歲時離開
    nth: 2                      # 選填：錨句出現多次時，取第幾個段落（預設 1）
    level: 2                    # 選填：1＝章（預設）、2＝小節（縮排）
```
規則：
1. `match` 比對的是**段落純文字**（已去掉標籤、空白、表情圖）；用 8–20 字、獨特的句子。
2. 一個 `match` 必須落在**同一個段落**內，不可跨段。
3. 項目順序要和文章順序一致（順序錯誤會警告）。
4. 找不到錨句：該項在網站上停用、開發時主控台警告；`npm run content:check` 與 `npm run novel:upload` 會列為**錯誤**並指出是哪一項（上傳會因此中止）。
5. 原文更新後只要錨句還在，目錄不用改。

## 5. 表情圖
原文出現新的表情圖時，執行 `node scripts/fetch-emoticons.ts`（掃描本機原文、下載缺少的圖到 `public/images/emoticons/`），再 commit 圖片。未下載的圖會退回顯示 `(alt)` 文字，不會破圖。
