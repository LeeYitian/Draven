# Implementation Plan：《主教與盤蛇神》互動故事導覽網站

**Branch**：`001-story-guide-site` ｜ **Date**：2026-10-07 ｜ **Spec**：[spec.md](spec.md)
**Input**：[spec.md](spec.md)、[clarifications.md](clarifications.md)（暫定預設已納入）、[research.md](research.md)

## Summary
以 **React＋TypeScript＋Vite＋Tailwind v4** 實作純前端互動導覽站：電腦版＝1440×720 舞台等比縮放，窄螢幕／直立／倍率過小＝流式捲動版；所有文字集中在 `src/content/` YAML（行內標記標出人名、名詞、交叉連結、伏筆回收處）；關係圖、Popover、伏筆拖曳、人物誌 slot 動畫皆**自寫、不依賴圖形／動畫／路由庫**；以 GitHub Actions 官方 Pages 流程自動部署。已用實驗驗證（research §0）：舞台縮放下錨點座標穩定、`localPoint` 通用、流式版註記列免量測。

## Technical Context
| 項目 | 內容 |
|---|---|
| Language/Version | TypeScript 5.x、React 19、Node 22 LTS（本機 v22.23.1 ✓） |
| Primary Dependencies | `react`、`react-dom`、`zustand`、`lucide-react`（**執行期白名單**）；Dev：`vite`、`@vitejs/plugin-react`、`tailwindcss`＋`@tailwindcss/vite`、`typescript`、`zod`、`yaml`、`vitest`、`@testing-library/react`、`jsdom`、`@playwright/test`、`eslint`＋`typescript-eslint`、`prettier` |
| Storage | 無後端；`localStorage`（追蹤、伏筆）、`sessionStorage`（04 遮罩已開）；皆 try/catch 退化為記憶體 |
| Testing | Vitest（純邏輯與元件行為）、Playwright（視窗矩陣、幾何斷言、觸控）、`content:check`（內容驗證） |
| Target Platform | 近兩年 Chrome／Edge／Safari／Firefox；iOS Safari、Android Chrome；靜態網站（GitHub Pages `/Draven/`） |
| Project Type | Web single-page app（前端單專案） |
| Performance Goals | 首頁 JS gzip ≤ 200 KB（不含字型）；畫線／拖曳 ≥ 50 fps；內容 YAML 打包 < 100 KB |
| Constraints | 舞台版每頁一屏；無水平捲軸；`prefers-reduced-motion`；觸控目標 ≥ 44px（流式）；文字不得寫死在元件 |
| Scale/Scope | 5 個頁面（00＋4 主軸）＋人物誌抽屜＋伏筆托盤；25 個事件、約 39 條關係線、15 人、12 伏筆、16 名詞 |

## Constitution Check
| 原則 | 本計畫如何滿足 | 狀態 |
|---|---|---|
| I 文字與程式分離 | `src/content/` YAML＋`t()`／`RichText`；lint 規則禁止 `.tsx` 內中文字串；`content:check` 驗證 | ✅ |
| II 舞台＋流式 | 單一 `LayoutProvider`＋`localPoint`；無尺寸寫死；兩版型都在驗收標準內 | ✅ |
| III 設計代幣 | `@theme` 清除預設色盤；共用 `@utility`／元件；lint 禁止 hex | ✅ |
| IV 互動降級與無障礙 | 每個拖曳有點選替代；鍵盤合約；reduced-motion；focus-visible | ✅ |
| V 劇透安全 | 純函式 selector＋單元測試；遮蔽不渲染 DOM | ✅ |
| VI 簡單優先 | 執行期依賴 4 個；其餘自寫（見 research R5、R9、R10、R13、R17） | ✅ |
| VII 可部署可驗證 | 每個 Phase 結束可部署；CI 先 check 再 build | ✅ |

**Complexity Tracking**：目前無違反項目。可能的例外（發生才記錄）：① 若 Playwright 在 WebKit 的觸控模擬不穩，可能引入 `@use-gesture` 處理雙指（需經確認）；② 若 `filter: sepia` 效能不足，退化而非加依賴。

## Project Structure

### Documentation（本功能）
```
specs/001-story-guide-site/
├─ spec.md                  ← 需求（讀者能做什麼）
├─ clarifications.md        ← 設計不明處與暫定預設（請回覆 5 題）
├─ research.md              ← 技術決策、實驗結果、可行性矩陣、風險
├─ design-system.md         ← Tailwind 主題、共用類別與共用元件藍圖
├─ data-model.md            ← 內容資料與執行期狀態
├─ contracts/
│  ├─ content-markup.md     ← 行內標記、人名自動辨識、伏筆撰寫與驗證
│  ├─ layout-and-coordinates.md ← 版型決策、localPoint、錨點量測、視窗矩陣
│  └─ state-and-events.md   ← 路由、鍵盤、焦點、伏筆狀態機、人物誌互動
├─ plan.md                  ← 本檔
├─ tasks.md                 ← 任務清單（依使用者故事分階段）
├─ quickstart.md            ← 開發／建置／驗收／改文字流程
└─ checklists/requirements.md
docs/部署教學-GitHub-Pages.md  ← 新手向 GitHub Actions 教學（`docs/` 在 .gitignore，僅存本機）
```

### Source Code（倉庫根目錄）
```
├─ index.html                 # lang=zh-Hant、字型 preconnect、<div id=root>
├─ vite.config.ts             # base（/Draven/）、react、tailwind、yaml plugin
├─ package.json  tsconfig.json  eslint.config.js  .prettierrc
├─ .github/workflows/deploy.yml   # Pages 部署（教學內附逐行說明）
├─ .github/workflows/e2e.yml      # PR／手動：Playwright 視窗矩陣
├─ public/images/                 # postcard-front.(jpg|webp)、favicon
├─ scripts/                       # content-check.ts、convert-bio.ts
├─ src/
│  ├─ main.tsx  app/App.tsx  app/router.ts      # hash 路由、頁面切換
│  ├─ styles/index.css                          # @theme、@custom-variant、@utility、keyframes、components
│  ├─ content/                                   # 全部文字（YAML）＋ loader／schema／t()
│  │  ├─ pages/{00..04}.yaml  people.yaml  glossary.yaml  hints.yaml  ui.yaml
│  │  └─ index.ts  schema.ts  markup.ts          # 解析行內標記（純函式，可測）
│  ├─ lib/                                       # stage-metrics、localPoint、spring、storage、hash、useReducedMotion
│  ├─ store/                                     # nav、axis、graph、tracking、hints、people、extras（zustand）＋ selectors.ts
│  ├─ components/
│  │  ├─ ui/        Button Chip Segmented Kbd Eyebrow DisplayNum Hairline Bookmark Callout Sheet Scrim Spoiler FlashOnce
│  │  ├─ layout/    LayoutProvider Stage FlowShell Dock PageFrame PageHeader
│  │  └─ text/      RichText NameLink TermLink CrossLink HintAnchor PopoverLayer
│  └─ features/
│     ├─ world/     WorldIntro（00）
│     ├─ axis/      AxisPage EventBar EventCell NarrativePanel useAxisKeys
│     ├─ graph/     RelationGraph GraphNode GraphEdge GraphLegend GraphControls LayerBand useGraphViewport useNodeDrag layout.ts
│     ├─ hints/     HintTray HintKeyword HintSlotLayer HintSlot HintArc NoteRow useHintDrag measure.ts
│     ├─ people/    PeopleDrawer PersonCard CompactCard FilterBar ArrangeSwitch CenterView ExpandedPanel slots.ts center.ts
│     ├─ extras/    BoundarySpectrum CompareSlider LayeredGraph MirrorCard Postcard SpoilerCover ChoiceBlock
│     └─ tracking/  TrackingBadge TrackToast
└─ tests/
   ├─ unit/        markup、aliases、selectors、slots、center、graph-visibility、hints、localPoint
   └─ e2e/         matrix.spec.ts anchors.spec.ts touch.spec.ts keyboard.spec.ts
```
**結構決定**：單一前端專案；`features/` 依「讀者能做的事」分，共用元件在 `components/`；純邏輯（selector、slot 指派、標記解析）與 React 分離以便單元測試。

---

## 你的 6 點需求如何落實

### #1 Tailwind 主題與共用元件
詳見 [design-system.md](design-system.md)。重點：`@theme` 清除預設色盤並貼入 Classical 代幣；`@custom-variant stage|flow|compact`；`@layer components` 定義 `.chip .node .edge .person-card .hint-slot .link-name …`，狀態以 `data-*` 表達；`ui/` 共用元件先於功能元件完成（Phase 2）。尺寸常數集中在 `stage-metrics.ts`。

### #2 技術可行性與不明確處
- 可行性：research §2 矩陣，全部 ✅；3 個關鍵風險已用實驗驗證（§0）。
- 不明確處：[clarifications.md](clarifications.md)。**已決議**：G-05（02–04 左欄加寬為 620、關係圖 628）、G-09（節點不開 Popover）、G-02（02 比較滑桿全寬不堆疊）、D-01（原稿已移出版控）、N-01（文字不可選取／複製）。**待確認**：G-14（04 遮罩期間行為，已附白話說明）。其餘有暫定預設。

### #3 編譯與部署（含 GitHub Actions 教學）
- `npm run build`＝`tsc -b && content:check && vite build`；`base:'/Draven/'`（以環境變數可覆寫）。
- `.github/workflows/deploy.yml`：`push main` → `npm ci` → `npm run check`（lint＋型別＋內容驗證＋單元）→ `npm run build` → `upload-pages-artifact` → `deploy-pages`。
- hash 路由，**不需要** 404 回退。
- 新手教學：[../../docs/部署教學-GitHub-Pages.md](../../docs/部署教學-GitHub-Pages.md)（名詞→建立檔案→推送→開啟 Pages→看 Actions→網址→疑難排解→備案 `gh-pages`）。
- 倉庫衛生（D-01 已處理）：`contents/`、`docs/` 已列入 `.gitignore` 並從歷史移除；教學檔 `docs/部署教學-GitHub-Pages.md` 只存在本機。
- Phase 1 結束時就做出「空殼首頁」並實際部署一次，確保管線早期打通。

### #4 螢幕尺寸適應（尤其手機）
[contracts/layout-and-coordinates.md](contracts/layout-and-coordinates.md)。重點：
- 單一 `LayoutProvider` 決定舞台／流式（寬 < 1024、直立、倍率 < 0.72），compact（倍率 < 0.89）。
- **關係圖不需要套件**：節點座標以比例儲存（桌機、流式兩組），執行時乘容器尺寸；連線由 JS 計算；縮放平移自寫（R12 處理觸控捲動衝突）。
- 人物誌 slot 卡片位置為資料已知，用 `transform` 過渡，不測量 DOM。
- 流式版最大寬 640，平板直立不會把手機排版拉爆；320px 手機節點用精簡尺寸。
- Playwright 視窗矩陣驗收（SC-001）。

### #5 文字集中管理
[contracts/content-markup.md](contracts/content-markup.md)＋[data-model.md §1](data-model.md)。每頁一個 YAML、人物／名詞／伏筆／介面文案各自一檔；行內標記標互動片段；建置期驗證所有參照。**要改文字只改 YAML，不碰 `.tsx`。**

### #6 伏筆框格跟隨文字
[research R8](research.md)＋[contracts/layout-and-coordinates.md §5](contracts/layout-and-coordinates.md)。**只需要一種標記 `{h:id|片語}`**；程式量測錨點末端並放框格與弧線，文字改動、字型載入、compact 都會自動重新量測；流式版以 in-flow 註記列免量測。作者不需要標行號或座標，建置驗證保證 id 與位置對得上。已用實驗驗證（S1–S3）。

---

## 交付階段（每階段結束都可部署、可驗收）

| Phase | 內容 | 對應故事 | 驗收重點 |
|---|---|---|---|
| 1 Setup | 專案初始化、工具鏈、CI 與 Pages 部署（空殼） | — | Actions 綠燈、網址可開 |
| 2 Foundational | 主題與共用樣式、內容系統（YAML＋標記＋驗證）、版型／舞台／座標、狀態／路由／鍵盤、Dock、頁面框架、共用 ui 元件 | — | 主題頁（元件圖鑑）通過；單元測試通過 |
| 3 US1 | 00 頁、換頁、雙版型、頁面指示 | US1 | 視窗矩陣無水平捲軸 |
| 4 US2 | 01 主軸頁：事件列、敘述、關係圖（畫線、焦點、拖曳、縮放、圖例） | US2 | 01 完整事件進程 |
| 5 US3 | 名詞／人名 Popover、追蹤 | US3 | 劇透階段測試通過 |
| 6 US4 | 人物誌（slot、標籤、中心視角、展開、排列） | US4 | 15 人×進度窮舉測試 |
| 7 US5 | 伏筆（托盤、獲得、拖曳／點選、框格跟隨、流式註記列） | US5 | 錨點幾何 e2e |
| 8 US6a–d | 01 光譜＋交叉連結、02 比較滑桿＋時間感、03 三界分層＋引言、04 遮罩＋鏡像卡＋明信片 | US6 | 各頁專屬驗收 |
| 9 Polish | 02–04 內容與座標校正、手機版整體走查、無障礙、效能、教學收尾 | — | SC-001…007 |

> 02–04 的資料（YAML）與座標校正放在各自 US 之後，**不阻擋** 01 的垂直切片。

## Risks（摘要，完整見 research §3）
K1 左欄溢出（G-05，已用「加寬左欄」緩解）、K2 字型／compact 造成錨點位移（重量測）、K5 觸控捲動衝突（按鈕保底）、K6 中心視角擁擠（窮舉測試）、K11 「不可複製」的期待落差（R25 已聲明限制）。K8（原稿外洩）已處理。

## 關於 spec-kit（誠實說明）
- **本次沒有安裝、也沒有執行 spec-kit 工具**（`specify` CLI、`uv`、`/speckit.*` 斜線指令、其範本與腳本都未使用；本機也沒有 `uv`）。
- 我是依記憶中的 spec-kit **流程與目錄／章節慣例**手寫文件：`constitution → specify → clarify → plan → tasks → analyze`、`.specify/memory/constitution.md`、`specs/NNN-feature/{spec,plan,research,data-model,quickstart,tasks}.md`、`contracts/`、`checklists/`、`[P]`／`[USx]` 任務標記、「Constitution Check」「Complexity Tracking」。因此是**方法論層面的套用，不是工具層面**。
- 差異風險：章節名稱與模板細節可能與官方模板略有出入；官方腳本會做的事（自動建 feature 分支與編號、`check-prerequisites`、更新 agent 說明檔 `CLAUDE.md`）這裡沒有。
- 若想改成官方工具：安裝 `uv` 後執行 `uvx --from git+https://github.com/github/spec-kit.git specify init --here --ai claude`，會產生 `.specify/` 範本與腳本及 `.claude/commands/speckit.*`；再把本目錄內容併入官方結構，並用 `/speckit.analyze` 重新檢查。這一步需要網路與你的同意（會新增檔案、可能覆蓋 `.specify/memory/constitution.md`），我不會自行執行。
