# Clarifications：好讀版

## 已確認（2026-10-10，使用者回覆）
| # | 問題 | 決議 |
|---|---|---|
| C-1 | `full.html` 與 CI | 原文**不進 repo**（已在 `.gitignore`）。CI 取不到檔案，故原文**不打包進網站**。 |
| C-2 | 原文放哪（Secret 上限 48KB 放不下） | **Cloudflare Worker + Workers KV**（免費方案、不需信用卡；R2 需綁卡故不用）。網站在讀者開啟好讀版時才向 Worker 取文。 |
| C-3 | 表情圖 | 下載到專案內（`public/images/emoticons/`），不從 plurk 外連。 |
| C-4 | 目錄約定 | 獨立 `src/content/toc.yaml` + 錨句；md／txt 來源用 `#` 標題。 |
| C-5 | 閱讀設定 | 深淺色 + 四段字級；字體、行高、行寬由設計固定。 |

| C-6 | 目錄放哪（使用者 2026-10-10 追問） | `toc.yaml` 也放 KV（與原文一起由 `npm run novel:upload` 上傳），不進 repo；故事內容與目錄的更新都不需 commit。 |

## 設計方預設（未特別詢問，如需更動請告知）
- D-1 好讀版是獨立全頁路由 `#/read`，不顯示側欄；頂列有「返回導覽」。
- D-2 單一書籤，記錄的是**反白起點所在段落**（段落為定位單位，非逐字）。
- D-3 `full.html` 的空白行（Plurk 回應分段處）轉為「較大的段距」，不加符號。
- D-4 章節標題不額外渲染進內文（只出現在目錄）；需要時再加 `showTitle`。
- D-5 Worker 只做 Origin 白名單＋CORS；限速請在 Cloudflare 後台設定（說明見 quickstart）。
- D-6 `content:check` 與 `novel:upload` 會檢查 `toc.yaml` 錨句（需本機有原文）；CI 沒有原文與目錄，略過並提示。
- D-7 作者署名未提供，聲明文案寫「原作者」，可在 `ui.yaml` 改。
- D-8 Google Fonts 的 Noto Serif TC 改請求可變字重範圍（300..700），以便深色模式使用較細字重。

## 已知問題（與好讀版無關）
- 完整 `npm run e2e` 有 5 項失敗：`perf.spec.ts`（01 連按推進、02 比較滑桿、03 收合三界）與 `touch.spec.ts`（縮放 100% 觸控捲動、「節點在手機版不能拖曳」）。後者斷言的行為已被 commit 2c16fe8（手機版節點可拖曳）改變，測試應是過期；perf 為互動被節點遮擋或 FPS 門檻，皆在關係圖。好讀版新增與修改的檔案不涉及這些程式。

## 開放項目
- 無（待使用者審閱 D-1～D-8）。
