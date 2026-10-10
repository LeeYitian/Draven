# Worker API
`VITE_NOVEL_URL` 是 Worker 的根網址（例：`https://draven-novel.<帳號>.workers.dev`），網站會自己加路徑：
- `GET /full`：小說原文（KV 鍵 `full`，`text/plain`）
- `GET /toc`：目錄（KV 鍵 `toc`，`application/json`，形如 `{"items":[{"title","match","nth?","level?"}]}`；`npm run novel:upload` 把 `contents/toc.json` 原樣上傳，格式見 [docs/toc-and-source.md](../../../docs/toc-and-source.md)）
- 需要請求標頭 `Origin` 在 `ALLOWED_ORIGINS`（逗號分隔，如 `https://leeyitian.github.io,http://localhost:5173`）內，否則 `403`。
- `200`：body＝對應 KV 鍵的內容；`Access-Control-Allow-Origin` 回送該 Origin；`Cache-Control: private, max-age=300`。
- `404`：路徑不是 `/full`、`/toc`，或 KV 尚無該鍵（網站遇到 `/toc` 404 時照常閱讀，只是沒有目錄）。`405`：非 GET/OPTIONS。
- 限速：在 Cloudflare 後台 Security → WAF → Rate limiting rules 設定（免費方案可建 1 條），Worker 內不做。
