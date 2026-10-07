# 德雷文 · 故事導覽

《德雷文》的互動導覽網站：四條主軸的事件進程與人物關係圖、人物誌、伏筆收集、以及各主軸專屬的互動
（01 邊界之辯光譜、02 孩子與國王比較滑桿、03 三界分層、04 鏡像對照卡與明信片）。

- 網站：<https://leeyitian.github.io/Draven/>（`main` 更新後自動部署）
- 技術：React 19、Vite、Tailwind 4、TypeScript、zustand；內容放在 YAML；沒有後端
- 版型：桌機是固定 1440×720 的「舞台」等比縮放；視窗太小或太窄時換成手機用的「流式版」

---

## 開發

需要 Node.js 22.18 以上。

```bash
npm install                  # 第一次
npm run dev                  # 開發伺服器 http://localhost:5173/
npm run check                # lint＋型別＋內容驗證＋單元測試（CI 也跑這個）
npm run build                # 產生 dist/（網站放在 /Draven/ 底下）
npm run preview              # 在本機預覽 dist
npx playwright install chromium   # 第一次跑 e2e 前
npm run e2e                  # 端對端測試（視窗矩陣、互動、無障礙、版面走查）
npm run e2e:prod             # 同一批 e2e，改對「打包後的網站」跑
```

開發模式專用：

| 網址 | 用途 |
|---|---|
| `/#/__kit` | 元件圖鑑 |
| `/?editor=1#/axis/1` | 關係圖座標校正器：拖曳節點 → 複製座標 → 貼回該頁 YAML 的 `graph.layout` |

## 要改文字，只改這裡

**不需要動任何 `.tsx`。** 改完執行 `npm run content:check`，錯誤會指出檔案與位置。

| 想改什麼 | 檔案 |
|---|---|
| 00 導言、三個世界、四條主軸 | `src/content/pages/00.yaml` |
| 01–04 的事件敘述、標題、標籤、節點副標、連線文字、圖例；各頁專屬內容（光譜、比較滑桿、引言、鏡像卡、明信片、遮罩文案） | `src/content/pages/0X.yaml` |
| 人物卡、Popover 各階段文字、完整介紹（含劇透） | `src/content/people.yaml` |
| 名詞解釋 | `src/content/glossary.yaml` |
| 伏筆的關鍵字、解開後說明、獲得與回收的主軸 | `src/content/hints.yaml` |
| 按鈕、提示、aria 標籤等介面文案 | `src/content/ui.yaml` |

文字裡的標記：`{p:id}` 人名、`{t:id}` 名詞、`{x:spectrum|見下方 ↓}` 交叉連結、`{h:hint-id|片語}` 伏筆回收處。
人名與名詞一般不用標，系統會依別名表自動辨識；規則見 `specs/001-story-guide-site/contracts/content-markup.md`。

常見操作：

- **新增事件**：在該頁 YAML 的 `events` 加一項，`graph.edges` 補上 `event: n`，必要時補 `participants`。
- **新增人物**：`people.yaml` 加一筆（含 `aliases`、`popover` 四段），再到需要的頁面的 `graph.nodes` 與座標加入。
- **換明信片插圖**：把圖放進 `public/images/`，改 `04.yaml` 的 `extras.postcard.frontImage` 與 `frontAlt`。
  圖建議 1200–1600 寬的 JPG／WebP（檔案小才不會拖慢 04）。
- **調整關係圖座標**：用校正器。座標只寫展開狀態；03 的各層區域由節點位置自動推算。

## 專案結構

```
src/
  content/        內容檔（YAML）、結構定義（schema.ts）、驗證（validate.ts）、載入器（index.ts）
  features/
    axis/         主軸頁：事件列、敘述面板、方向鍵
    graph/        關係圖：節點、連線、縮放平移、分層（layers.ts）
    extras/       各主軸專屬：光譜、比較滑桿、引言、鏡像卡、明信片、劇透遮罩
    people/       人物誌抽屜（桌機網格與中心視角、手機版樹狀）
    hints/        伏筆：托盤、關鍵字、框格與弧線、手機版註記列
    world/        00 世界觀導讀、重置進度
  components/     頁面框架、舞台、側欄、Popover、共用 UI
  store/          zustand 狀態與純函式 selectors（劇透、亮暗、可見性規則）
  styles/         設計代幣（index.css）與元件樣式（components.css）
scripts/          內容驗證、YAML 外掛、e2e:prod
tests/            unit（Vitest）、e2e（Playwright）
specs/            規格、計畫、任務清單、設計系統
```

## 測試

- **單元測試**（`npm test`）：劇透與進度規則、關係圖幾何、各頁座標檢查、光譜與比較滑桿計算、伏筆判定、各互動元件。
- **e2e**（`npm run e2e`）：六種桌機視窗＋六種手機視窗，檢查版面不溢出、元件對齊、拖曳與鍵盤、觸控、
  axe 無障礙掃描、每頁每個事件的版面走查、互動流暢度（無頭 Chromium 的粗略下限）。
- **正式建置**：`npm run e2e:prod` 先以 `VITE_BASE=/` 建置，再對 `vite preview` 跑同一批測試。
- 真機（iPhone Safari、Android Chrome）要人工檢查：清單在 `specs/001-story-guide-site/checklists/real-device.md`。

## 部署

推到 `main` 後，`.github/workflows/deploy.yml` 會跑 `npm run check` 與 `npm run build`，通過才部署到 GitHub Pages。
PR 與手動觸發另有 `e2e.yml`（Playwright，不擋部署）。網址或倉庫改名時，只需要改 `vite.config.ts` 的 `PRODUCTION_BASE`。

## 其他

- **內容的處理**：`npm run build` 時，YAML 會先用 zod 驗證並套好預設值；網站執行時不再帶 zod，JS 約 125 KB（gzip）。
- **重置進度**：00 頁底部的「重置進度」會清除追蹤、伏筆與 04 的遮罩紀錄。
- **文字保護**：全站文字不可選取與複製（CSS＋事件攔截）。這只能擋一般操作，擋不了檢視原始碼、開發者工具、截圖與閱讀模式。
- **原稿不進版本控制**：`contents/`、`docs/` 與 `specs/內容準備與設計稿修改.md` 只存在本機（見 `.gitignore`）。
  要新增需要保密的檔案，請先寫進 `.gitignore` 再 commit。
