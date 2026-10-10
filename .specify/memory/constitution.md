# 《德雷文》故事導覽網站 · 專案憲章（Constitution）

> 依 github/spec-kit 方法論建立。本憲章是 `/plan`、`/tasks`、`/implement` 每一步的檢查依據（見 plan.md「Constitution Check」）。
> 版本 1.2.0 · 制定日 2026-10-07 · 最後修訂 2026-10-10（IV-b 新增「好讀版文章區」例外；技術約束新增 Cloudflare Worker 原文來源）
> 注意：本檔由人工依 spec-kit 的目錄與模板慣例手寫，**並非由 spec-kit CLI 產生**（見 plan.md「關於 spec-kit」）。

## 核心原則

### I. 文字與程式分離（Content as Data）〔不可妥協〕
- 畫面上所有給讀者看的文字（敘述、標題、人物資料、Popover、伏筆、介面文案、aria 標籤）都放在 `src/content/` 的 YAML 檔，**元件程式碼裡不得出現中文字串常數**。
- 內容依頁面各自集中：`pages/00.yaml … 04.yaml`、`people.yaml`、`glossary.yaml`、`hints.yaml`、`ui.yaml`。要改文字只改這些檔，不需要碰 `.tsx`。
- 文字中的可互動片段（人名、名詞、交叉連結、伏筆回收處）用**行內標記**（`{p:…}` `{t:…}` `{x:…}` `{h:…}`）標註，不在程式裡寫死位置。
- 建置前必須通過內容驗證（`npm run content:check`）：標記引用的 id 必須存在、伏筆回收處必須和 `hints.yaml` 一致。

### II. 舞台＋流式雙版型（Stage + Flow）〔不可妥協〕
- 電腦版＝固定 1440×720 舞台等比縮放；窄螢幕／直立／縮放倍率過小＝流式捲動版。兩種版型由**單一個** `LayoutProvider` 決定，元件不得自行讀 `window.innerWidth` 判斷版型。
- 所有指標座標（拖曳、錨點量測）一律經共用的 `localPoint(el, clientX, clientY)` 換算；**功能程式碼不得出現舞台倍率常數或 `/ s` 之類的手算**。
- 每個功能都要在**兩種版型**下完成驗收，而不是只做電腦版再補手機版。
- 任何依「螢幕位置」的定位（伏筆框格、Popover、連線）必須由 DOM 量測或資料座標（比例）產生，禁止寫死在特定螢幕尺寸下量到的 px。

### III. 設計代幣為唯一來源（Design Tokens）
- 顏色、字體、間距、圓角、陰影只能取自 Tailwind `@theme`（內容 = Classical 設計系統 `styles.css` 的變數）。**禁止**在元件內寫 `#hex`、`rgb()`、自訂字型名稱。
- 重複出現的視覺樣式（按鈕、標籤、卡片、可點文字、書籤標記…）必須定義成共用元件或 `@utility`／`@layer components` 類別，不在各頁複製 class 字串。
- 強調效果各佔一個視覺通道（焦點＝亮暗、追蹤＝書籤、登場＝彩色／灰階、標籤選中＝浮起、伏筆＝雙線框），新增效果前先確認不與既有通道衝突。

### IV. 互動降級與無障礙（Graceful Interaction）
- 每個指標互動（拖曳、滑桿、翻面、縮放）都要有**點選／鍵盤替代操作**。
- 方向鍵合約：只在舞台版、非輸入元件上處理；元件自己處理方向鍵時 `preventDefault()`，全域處理器看到 `defaultPrevented` 即略過。
- 尊重 `prefers-reduced-motion`：取消自動旋轉、閃動、震動、畫線動畫與位移動畫；保留短淡入淡出。
- 鍵盤焦點一律使用主題外框（2px accent，外距 2px），不使用瀏覽器預設藍框。

### IV-b. 文字保護（Content Protection）
- 全站文字不可被選取、不可複製（CSS `user-select:none`＋`selectstart`／`copy`／`cut`／`dragstart` 攔截）。
- 保護只做在「選取與複製」這一層，**不得**以移除 DOM 文字或 `aria-hidden` 達成，以免傷害無障礙與搜尋。
- 對外溝通必須誠實：這只能阻擋一般操作，不是加密（見 research R25）。
- **例外（v1.2.0，specs/002-reader-mode）**：好讀版（`#/read`）的文章區 `[data-reader-article]` 允許反白，作用只是讓讀者指定「記錄閱讀進度」的位置。該區仍禁止複製、剪下、拖曳、右鍵選單與列印；其他所有區域維持不可選取。
- 小說原文不進 repo、不打包進網站；正式環境在執行時由 Cloudflare Worker（Workers KV）依 Origin 白名單提供。

### V. 劇透安全（Spoiler Safety）
- 劇透規則（人物誌預設遮蔽、Popover 只顯示目前主軸之前、04 先蓋遮罩、追蹤與劇透無關）以**純函式 selector** 實作並有單元測試，不散落在元件裡。
- 被遮蔽的劇透文字**不得渲染進 DOM**（避免被選取、搜尋或螢幕閱讀器讀出）。

### VI. 簡單優先、少依賴（Simplicity）
- 預設不引入圖形庫、動畫庫、路由庫、浮動定位庫。要引入前，必須在 research.md 寫明「為什麼自寫不可行」並經確認。
- 允許的執行期依賴白名單：`react`、`react-dom`、`zustand`、`lucide-react`。其餘需走 Complexity Tracking。
- 先做能運作的最小版本（垂直切片），再擴充；不為「未來可能」預留抽象。

### VII. 可部署、可驗證（Deployable & Verifiable）
- 每個階段結束時 `main` 都能 `npm run build` 並成功部署到 GitHub Pages（Vite `base` 與 hash 路由已處理）。
- 純邏輯（標記解析、可見性規則、slot 指派、事件→連線可見性、伏筆判定）寫單元測試；版面與互動以 Playwright 在**固定視窗矩陣**（見 plan.md）驗收。
- CI 失敗（型別、lint、內容驗證、測試、建置任一）不得部署。

## 技術約束
- 前端：React + TypeScript + Vite + Tailwind CSS（v4，CSS-first 設定）。純前端、無後端。
- 目標瀏覽器：近兩年的 Chrome／Edge／Safari／Firefox 與 iOS Safari、Android Chrome。
- 部署：GitHub Pages（GitHub Actions 官方 Pages 流程）。路由使用 hash（`#/…`），免除 SPA 404 問題。
- 唯一的後端元件：`worker/`（Cloudflare Worker + KV，免費方案），只負責回傳好讀版原文；網站其餘部分仍是純前端。

## 開發流程（spec-kit）
1. constitution → 2. specify（spec.md）→ 3. clarify（clarifications.md，答案回寫 spec）→ 4. plan（plan.md、research.md、data-model.md、contracts/）→ 5. tasks（tasks.md）→ 6. analyze（一致性檢查）→ 7. implement（依 tasks 逐階段實作，每階段結束驗收並可部署）。
- 設計與需求的**來源順序**：`specs/內容準備與設計稿修改.md` 第一部分（文字內容）> `specs/互動構想.md`、`specs/動態與互動對照.md`（互動規則）> `design/故事導覽 排版規劃.dc.html` 與 `DESIGN_README.md`（版面與元件）。三者衝突時以此順序為準，並記錄到 clarifications.md。

## 治理
- 本憲章優先於其他文件。修訂需在此檔更新版本號並說明理由。
- 違反原則的設計必須寫入 plan.md 的 Complexity Tracking，說明「為何必要」與「為何更簡單的做法不行」。
