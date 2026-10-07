# 最終驗收（T127）

對照 `spec.md` 的成功標準（SC-001…SC-008）。「自動」＝由哪個測試保證；「量測」＝某次實測的數字。
真機項目見 `real-device.md`（手動）。

| 標準 | 內容 | 驗證 |
|---|---|---|
| SC-001 | 視窗矩陣下 00–04 與人物誌無水平捲軸、內容不被裁切，舞台版每頁一屏放得下 | **自動**：`tests/e2e/layout-walk.spec.ts`（01–04 每個事件 × 六種桌機視窗〔含 compact〕與六種手機視窗；左欄不超過下方區、舞台內沒有溢出元素、節點不重疊）、`matrix.spec.ts` |
| SC-002 | 伏筆框格相對錨點的舞台座標一致（≤ 2px）、框格互不相交 | **自動**：`tests/e2e/anchors.spec.ts` |
| SC-003 | 改內容檔不需改 `.tsx`；含錯誤參照時 `content:check` 失敗並指出位置 | **自動**：`tests/unit/content-check.test.ts`、`npm run content:check`（已含 12 條伏筆回收處的檢查） |
| SC-004 | 劇透規則單元測試全過（Popover 階段、登場累積、遮蔽不渲染 DOM、04 遮罩） | **自動**：`tests/unit/selectors.test.ts`、`popover-content.test.tsx`、`people-drawer.test.tsx`、`page04-ui.test.tsx` |
| SC-005 | 首頁 JS（gzip）≤ 200 KB；Lighthouse Accessibility ≥ 90；畫線與拖曳 ≥ 50 fps | **量測**：JS **約 125 KB**（建置時驗證內容、網站不再帶 zod；原 154 KB）。Lighthouse（對 `vite preview` 的正式建置，手機預設）：Accessibility **100**、Best Practices **100**、Performance 83–94（LCP 受 Google Fonts 載入影響，數字會浮動）；桌機預設 Performance 97–100。**自動**：`tests/e2e/a11y.spec.ts`（axe WCAG 2.x A／AA 零違規）。fps：`tests/e2e/perf.spec.ts` 在無頭 Chromium 量到事件推進／拖曳節點／拖曳比較滑桿／收合三界皆約 57–60 fps（門檻 30，只當嚴重退步的警報）；**50 fps 要在真機的 Chrome Performance 量**（手動） |
| SC-006 | push 到 `main` 後 ≤ 5 分鐘上線；CI 失敗不部署 | **自動**：`.github/workflows/deploy.yml`（`npm run check` 通過才 build 與部署）；實際時間以 Actions 頁面為準 |
| SC-007 | 所有指標互動僅用鍵盤或單指點選都有替代路徑 | **自動**：光譜與比較滑桿（←→）、伏筆點選放置、人物誌／Popover／遮罩的鍵盤操作（`extras-0*.spec.ts`、`anchors.spec.ts`、`keyboard.spec.ts`、`a11y.spec.ts`、`touch.spec.ts`） |
| SC-008 | 無法選取或複製頁面文字 | **自動**：`tests/e2e/protect.spec.ts`、`tests/unit/protect-content.test.ts` |

## 對正式建置再驗一次

`npm run e2e:prod`：以 `VITE_BASE=/` 建置後對 `vite preview` 跑同一批 e2e（只有開發模式才有的元件圖鑑測試會略過）。

## 驗收時調整過的設計值（都記在 `design-system.md`）

- `--color-neutral-600` 由 `#7d7979` 改為 `#6a6666`：輔助小字在紙色上由 3.84:1 提高到約 5.1:1（WCAG AA 要 4.5:1），02 最舊的紙色上約 4.7:1。
- 事件列「未到」、人物卡「灰階」的文字改用 neutral-600（原本更淺的灰達不到對比）；中心視角裡「沒有直接關係」的卡片文字改墨色（整張 0.7 透明後仍有 4.5:1）。
- 光譜指標由 20px 放大為 24px（WCAG 2.2 目標尺寸）；層頭、關係圖節點、事件格的無障礙名稱改為包含畫面上看得到的文字。
- 04 明信片 400×240（設計稿 400×250），否則事件 05 的敘述加卡片放不進左欄。

## 已知限制

- 只測過 Chromium；真機（iOS Safari、Android）與 WebKit／Firefox 未驗證。
- 03、04 的節點座標由搜尋程式在多種容器寬度下求得（保證不重疊、線不穿過第三個節點、線上文字不互蓋），版面美感可再用 `?editor=1` 校正器微調。
- 手機版 03 關係圖高 740px，較長。
