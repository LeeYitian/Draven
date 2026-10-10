# Quickstart：好讀版的日常操作與一次性設定

## A. 日常：更新小說原文與目錄
原文（`full.html`）與目錄（`toc.yaml`）都**不進 repo**，兩個檔案都放在 `src/content/`（已在 `.gitignore`），一起上傳到 Cloudflare KV。更新內容**完全不需要 commit、也不需要重新部署**。

1. 把新檔覆蓋到 `src/content/full.html`（也可改放 `full.md`／`full.txt`）；需要時改 `src/content/toc.yaml`（範本見 [contracts/toc-and-source.md](contracts/toc-and-source.md)）。
2. **本機預覽**：`npm run dev`，打開 `http://localhost:5173/#/read`。
3. **檢查**：`npm run novel:upload -- --dry-run`（或 `npm run content:check`）。`toc.yaml` 有項目找不到錨句會指出是哪一項。
4. **有新的表情圖**：`node scripts/fetch-emoticons.ts`，把 `public/images/emoticons/` 的新檔案 commit 並 push（這是唯一需要 commit 的情況，因為圖片是網站的一部分）。
5. **上線**：`npm run novel:upload`。讀者重新整理就看到新版（Worker 有 5 分鐘快取）。

> 只有「程式、介面文字、表情圖」的修改才需要 commit → push → GitHub Actions 部署。故事內容與目錄不用。

## B. 一次性設定：Cloudflare Worker + KV（免費、不需信用卡）
> 我沒有 Cloudflare 的帳號權限，以下是你要自己操作的步驟。Workers 與 KV 的免費額度（每天 10 萬次讀取）對你的規模綽綽有餘。

1. **註冊** <https://dash.cloudflare.com/sign-up>（Email 驗證即可；**不要**去啟用 R2，那個才要信用卡）。
2. **登入 wrangler**（Cloudflare 的命令列工具，用 `npx` 臨時執行，不會裝進專案）：
   ```bash
   cd worker
   npx wrangler login
   ```
   瀏覽器會跳出授權頁，按允許。
3. **建立 KV**：
   ```bash
   npx wrangler kv namespace create NOVEL
   ```
   畫面會印出一段 `id = "xxxxxxxx..."`，把這個 id 貼到 `worker/wrangler.toml` 的 `id`。
4. **部署 Worker**（確認 `wrangler.toml` 的 `ALLOWED_ORIGINS` 有 `https://leeyitian.github.io`）：
   ```bash
   npx wrangler deploy
   ```
   成功後會印出網址，像 `https://draven-novel.<你的子網域>.workers.dev`。這個網址（不含 `/full`）就是第 7 步要填的值。
5. **上傳原文與目錄**（以後每次更新都只要這一行；在專案根目錄執行）：
   ```bash
   npm run novel:upload
   ```
6. **驗證**：直接用瀏覽器打開 `…workers.dev/full`（或 `/toc`）應該顯示 `Forbidden`（沒有正確的 Origin，這是預期的）。
7. **告訴網站原文在哪**：GitHub 倉庫 → Settings → Secrets and variables → Actions → **Variables** 分頁 → New repository variable：
   - Name：`NOVEL_URL`
   - Value：`https://draven-novel.<你的子網域>.workers.dev`（**不要**加 `/full`，網站會自己加上 `/full` 與 `/toc`）

   然後到 Actions 頁手動執行一次「Deploy to GitHub Pages」（Run workflow）。
8. 打開 `https://leeyitian.github.io/Draven/#/read` 確認全文出現。

### 選用：限速
Cloudflare 後台 → 你的網域或 Workers 的 Security → WAF → Rate limiting rules（免費方案可建 1 條）。例如「同一個 IP 一分鐘超過 30 次請求 `/full` 就封鎖 10 分鐘」。Worker 本身不做限速。

### 疑難排解
| 現象 | 原因與處理 |
|---|---|
| 好讀版顯示「無法載入內容」 | 主控台（F12）看錯誤。`403`＝Worker 的 `ALLOWED_ORIGINS` 沒有你的網站網址；`404`＝還沒上傳原文（目錄 404 不影響閱讀，只是沒有目錄）；CORS 錯誤＝同 403。 |
| 顯示「找不到小說內容…VITE_NOVEL_URL」 | 部署時沒有帶到變數：確認第 7 步的 Variable 名稱是 `NOVEL_URL`，並重新部署。 |
| 目錄是空的 | 沒有 `toc.yaml`、或還沒 `npm run novel:upload`；沒有目錄時網站會改用原文自己的標題（md／txt 的 `#`）。 |
| 更新後讀者還是舊版 | KV 全球同步要幾十秒；Worker 另有 5 分鐘快取。 |
| `wrangler` 指令找不到 | 前面都要加 `npx`；需要 Node 22（專案本來就需要）。 |

## C. 本機驗證沒有夾帶原文
```bash
npm run build
npm run scan:dist
```
會從本機原文抽查 40 段，確認都不在 `dist/` 裡。
