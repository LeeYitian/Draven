# Tasks：《德雷文》互動故事導覽網站

**Input**：`specs/001-story-guide-site/` 下的 spec.md、plan.md、research.md、design-system.md、data-model.md、contracts/
**格式**：`[ID] [P?] [Story?] 描述（檔案路徑）`
- `[P]`＝可平行（不同檔案、無未完成的相依）。`[USx]`＝所屬使用者故事。`[手動]`＝需要你（使用者）親自操作。
- 每個 Phase 結尾有 **Checkpoint**：通過後才進下一階段，且 `main` 應可部署。
- 測試任務（`*.test.ts`、`e2e`）與功能任務同列；純邏輯**先寫測試再實作**。
- 所有畫面文字一律寫進 `src/content/**`，元件用 `t()`／`RichText`（憲章 I）。

---

## Phase 1：Setup（專案初始化與部署管線）

- [x] T001 在倉庫根目錄建立 Vite＋React＋TypeScript 專案（`package.json`、`tsconfig*.json`、`src/main.tsx`、`index.html`）；**不得覆蓋** `specs/`、`design/`、`contents/`、`draft/`、`DESIGN_README.md`
- [x] T002 安裝依賴：執行期 `react react-dom zustand lucide-react`；開發 `tailwindcss @tailwindcss/vite zod yaml vitest @testing-library/react @testing-library/user-event jsdom @playwright/test eslint typescript-eslint prettier`，鎖定 `package-lock.json`
- [x] T003 [P] 設定 `eslint.config.js`（含 `no-restricted-syntax`：禁止 `.tsx` 內含中文字串字面值與 `#hex` 色碼；測試與 `content/` 例外）、`.prettierrc`、`.editorconfig`
- [x] T004 `.gitignore` 已建立（`contents/`、`docs/`、`node_modules/`、`dist/`、`playwright-report/`、`test-results/`、`.vite/`）；之後新增工具產物時再補
- [x] T005 `vite.config.ts`：`base: mode==='production' ? '/Draven/' : '/'`（可由 `VITE_BASE` 覆寫）、`@vitejs/plugin-react`、`@tailwindcss/vite`、YAML plugin（`scripts/vite-plugin-yaml.ts`，用 `yaml` 套件，15 行）
- [x] T006 `index.html`：`lang="zh-Hant"`、viewport、Google Fonts（Cormorant Garamond 400/500/600、Lora 400/500、Noto Serif TC 400/500/600，`display=swap`）、preconnect、`<title>`
- [x] T007 `package.json` scripts：`dev`、`build`（`tsc -b && npm run content:check && vite build`）、`preview`、`lint`、`typecheck`、`test`、`content:check`、`check`（lint＋typecheck＋content:check＋test）、`e2e`
- [x] T008 [P] Vitest 設定（jsdom、`tests/unit/**`）與一支範例測試，確認 `npm test` 可跑
- [x] T009 `.github/workflows/deploy.yml`（官方 Pages 流程：checkout → setup-node 22＋cache → `npm ci` → `npm run check` → `npm run build` → `upload-pages-artifact` → `deploy-pages`；權限 `contents: read, pages: write, id-token: write`；`concurrency: pages`）
- [x] T010 [手動] （D-01 已處理：`contents/`、`docs/` 已不在版控）依本機的 `docs/部署教學-GitHub-Pages.md`：Settings → Pages → Source 選 **GitHub Actions**；若倉庫為私有且方案不支援 Pages，需改為公開或升級方案
- [x] T011 空殼首頁（站名取自 ui.yaml）已推送；Actions 全綠（run 37504149909），`https://leeyitian.github.io/Draven/` 回應 200 且資源正常載入

**Checkpoint 1 ✅（2026-10-07 通過）**：網址上線；`npm run check`、`npm run build` 在本機與 CI 皆通過。

---

## Phase 2：Foundational（所有故事共用，**完成前不得開始任何 US**）

### 2A 主題與共用樣式（對應需求 #1）
- [x] T012 `src/styles/index.css`：`@import "tailwindcss"`、`@theme`（`--color-*: initial` 後貼入 Classical 色盤、字體、陰影、圓角、動畫、keyframes）—依 design-system.md §1
- [x] T013 `src/styles/index.css`：`@custom-variant stage|flow|compact`、`:root` 的 `--fs-*`／`--z-*`、`@utility text-aux|text-body|text-title|tnum`
- [x] T014 [P] `src/styles/components.css`（`@layer components`）：`.eyebrow .display-num .btn(-primary/-secondary/-ghost/-icon) .kbd .hairline .plate`
- [x] T015 [P] 同上：`.chip`（含 `data-variant`、`aria-pressed`、`data-off`）、`.segmented`、`.callout`、`.sheet`、`.scrim`、`.bookmark`
- [x] T016 [P] 同上：`.link-name .link-term .link-cross .hint-anchor .hint-slot[data-state] .hint-keyword[data-state]`
- [x] T017 [P] 同上：`.event-cell[data-state][data-tracked] .node[data-state][data-group][data-dragging] .edge[data-kind][data-state] .person-card[data-on][data-selected][data-tracked][data-center] .person-card-compact .spoiler .mirror-card`
- [x] T018 `/__kit` 開發專用「元件圖鑑」頁：列出所有共用類別／元件的全部狀態（對照設計稿 §6 目視驗收）
- [x] T018a 文字保護（N-01／FR-090–092）：`src/styles/index.css` 的 `@layer base` 加全域 `user-select:none`（含 `-webkit-`）、`-webkit-touch-callout:none`、`img{-webkit-user-drag:none}`；提供 `.allow-select` 覆寫類別（預設不使用）
- [x] T018b 文字保護事件層：`src/lib/protect-content.ts` 在 `document` 攔截 `selectstart`／`copy`（並清空 clipboardData）／`cut`／`dragstart`；`contextmenu` 預設不攔截，由旗標開關；單元測試驗證事件被取消（已完成）；**Playwright 驗證三連擊、Ctrl+A、拖曳後 `getSelection().toString()===''`（SC-008）待 T051 建立 e2e 設定時一併加入**

### 2B 基礎函式庫（先測後寫）
- [x] T019 [P] `tests/unit/localPoint.test.ts` → `src/lib/localPoint.ts`（驗證 k=1／1.319／巢狀 1.5，與 research S2 同數字）
- [x] T020 [P] `src/lib/stage-metrics.ts`（design-system §4 全部常數，唯一出處）
- [x] T021 [P] `tests/unit/storage.test.ts` → `src/lib/storage.ts`（localStorage／sessionStorage 安全包裝，不可用時退化為記憶體）
- [x] T022 [P] `tests/unit/spring.test.ts` → `src/lib/spring.ts`（rAF 彈簧，過衝約 6%、約 400ms，可注入時鐘）
- [x] T023 [P] `src/lib/useReducedMotion.ts`
- [x] T024 [P] `tests/unit/hash-router.test.ts` → `src/lib/hash-router.ts`（`#/`、`#/axis/n`、`#/people`、`returnTo`、未知回 00；開發旗標 `?editor=1`／`?debug=anchors` 位於 `#` 之前，不影響路由）

### 2C 內容系統（對應需求 #5、#6）
- [x] T025 `src/content/schema.ts`：zod schema（Person、AxisPage、AxisEvent、GraphDef、Quote、Term、Hint、UiString、extras）依 data-model.md
- [x] T026 `tests/unit/markup.test.ts` → `src/content/markup.ts`：`{p:}{t:}{x:}{h:}` tokenizer／巢狀／逸出／錯誤定位（contracts/content-markup.md §1）
- [x] T027 `tests/unit/aliases.test.ts` → `src/content/aliases.ts`：最長優先、`autoLink:false`、名詞優先、已在標記內不重複
- [x] T028 `src/content/index.ts`：載入 YAML、`t(key, params)`、`getPerson/getTerm/getHint/getPage`；型別由 schema 推導
- [x] T029 `tests/unit/content-check.test.ts`（以壞資料 fixtures）→ `scripts/content-check.ts`：contracts/content-markup.md §4 的全部檢查，錯誤訊息含檔案與位置
- [x] T030 [P] `src/content/people.yaml`：15 人（卡片、別名、popover 4 階段、世界、標籤、firstAppearance、order、bio 含劇透）— 來源 `specs/內容準備與設計稿修改.md` §二-2、§二-3
- [x] T031 [P] `src/content/glossary.yaml`：17 個名詞 — §二-4
- [x] T032 [P] `src/content/hints.yaml`：12 條伏筆 — §二-5（`acquire`、`recycle`、`explain`）
- [x] T033 [P] `src/content/ui.yaml`：介面文案與 aria 標籤 — §二-8 與設計稿上所有 UI 文字（含「放開以放入」「不是這個」「追蹤中」「重置進度」「在人物誌查看」…）
- [x] T034 [P] `scripts/convert-people.ts`（原名 convert-bio，實際轉換卡片、別名、Popover、登場順序、標籤與完整介紹，一次產生 people.yaml）：把規格文件中的 `[劇透:主軸]…[/劇透]` 轉成 `bio` 結構（一次性）；轉換結果併入 T030
- [x] T035 `eslint` 規則與 `content-check` 結合：驗證 `ui.yaml` 的 key 皆被程式使用、程式用到的 key 皆存在

### 2D 狀態、版型、框架
- [x] T036 `tests/unit/selectors.test.ts` → `src/store/selectors.ts`：`progress`、`isOnStage`、`popoverText`（階段累積、空段跳過、00／01 僅基本）、`visibleEdges`、`edgeState`、`nodeState`、`eventTracked`、`eventMarkedByNodeFocus`、`spoilerVisible`、`slotAnswer`（**劇透規則全覆蓋**）
- [x] T037 `src/store/*.ts`：nav、axis、graph、tracking（persist）、hints（persist）、people、extras 切片（data-model §2）
- [x] T038 `tests/unit/layout-decide.test.ts` → `src/components/layout/LayoutProvider.tsx`：`decide()`、`data-layout`／`data-compact`／`--stage-scale`、同步初值、切換時保留狀態
- [x] T039 `src/components/layout/Stage.tsx`、`FlowShell.tsx`（舞台外底色、max-w 640、底部導覽列保留空間）
- [x] T040 `src/components/layout/Dock.tsx`：舞台版側欄 72px／流式底部導覽列；人物誌、伏筆（徽章）、追蹤中區塊、頁面指示＋方向鍵提示、頁面選單（流式）
- [x] T041 `src/components/layout/PageFrame.tsx`、`PageHeader.tsx`：§1-A 網格（頁首 y28 h72、事件列 y162 h56、下方區 y238 h457）；欄寬 **01–04 統一**：左 620（敘述文字 470＋旁註欄 150，行高 36）、欄距 40、右 628（G-05）；01 旁註欄留空；流式版對應堆疊
- [x] T042 [P] `src/components/ui/`：Button、Chip、Segmented、Kbd、Eyebrow、DisplayNum、Hairline、Bookmark、Callout、Sheet、Scrim、Spoiler（未顯示不渲染 children）、FlashOnce
- [x] T043 `src/components/text/RichText.tsx`＋`NameLink`／`TermLink`／`CrossLink`／`HintAnchor`（只負責渲染與觸發；Popover 內容在 US3）
- [x] T044 `tests/unit/popover-placement.test.ts` → `src/components/text/placePopover.ts`（下方 12px、翻上方、夾在舞台內）
- [x] T045 `src/features/axis/useGlobalKeys.ts`＋`tests/unit/keys.test.ts`（contracts/state-and-events.md §2 的所有略過條件）
- [x] T046 `src/app/App.tsx`／`router`：LayoutProvider → 路由 → 目前頁；`/__kit` 路由（僅開發）

**Checkpoint 2 ✅（2026-10-07 通過）**：`/__kit` 圖鑑逐項對照設計稿 §6 通過；單元測試全綠；`content:check` 可對 fixtures 正確報錯；`main` 可部署。

---

## Phase 3：User Story 1 — 00 導讀與換頁（P1）🎯 站台骨架

**Independent Test**：只有 00＋換頁，在矩陣各尺寸正常排版並可部署。

- [x] T047 [US1] `src/content/pages/00.yaml`：標題、導言（含人名標記）、核心關係、三個世界（含名詞標記）、四條主軸（編號／標題／副標）
- [x] T048 [US1] `src/features/world/WorldIntro.tsx`：舞台版三欄（440／1fr／1fr、欄距 56）、核心關係條、主軸清單（整列可點、hover accent-100、「↓ 進入第一主軸」提示）
- [x] T049 [US1] 流式版 00：單欄、核心關係條縮小、主軸清單（min-h 64）
- [x] T050 [US1] 換頁：頁面指示點選、↑↓ 鍵（舞台版）、流式版頁面選單；無轉場；切頁保留狀態
- [x] T051 [P] [US1] `tests/e2e/matrix.spec.ts`：視窗矩陣（contracts/layout-and-coordinates.md §7）→ 00 無水平捲軸、舞台版放得下一屏、版型門檻切換正確
- [x] T052 [US1] 在 1280×600 驗證 compact 字級補償；調整 00 文字不溢出

**Checkpoint 3（程式與驗證完成，待推送部署確認）**：部署；手機與桌機皆可閱讀 00 並換頁。

---

## Phase 4：User Story 2 — 01 主軸頁：事件與關係圖（P1）

**Independent Test**：只用 01 資料，不含 Popover／人物誌／伏筆。

### 資料與純邏輯
- [x] T053 [US2] `src/content/pages/01.yaml`：頁首資料、6 個事件（敘述含標記、participants）、節點與 9 條連線（含 `event`／`bg`）、圖例、桌機座標（**628×457**，由設計稿 778×457 重排）與流式座標、邊界之辯資料（`extras`；光譜區塊寬度＝左欄 620）
- [x] T054 [P] [US2] `tests/unit/graph-visibility.test.ts`：累積可見、背景恆顯、事件焦點／節點焦點互斥、點節點不改 eventIndex、回退與跳點規則（state-and-events §3）
- [x] T055 [P] [US2] `tests/unit/graph-layout.test.ts` → `src/features/graph/layout.ts`：座標正規化、比例還原、節點碰撞檢查（任何容器寬 ≥ 300 不重疊）、直線端點與自繪箭頭幾何

### 元件
- [x] T056 [US2] `src/features/axis/EventCell.tsx`＋`EventBar.tsx`：N 等分、編號＋標題＋箭頭、三狀態、hover、標題截斷加 title、節點焦點時編號金色底線
- [x] T057 [US2] `src/features/axis/NarrativePanel.tsx`：事件編號／標題／標籤／敘述（`RichText`），切換淡出 120＋淡入 180ms
- [x] T058 [US2] `src/features/graph/GraphEdge.tsx`：直線、終點插值畫線（rAF、400ms／120ms 間隔）、自繪箭頭淡入、四狀態、線上文字（白邊 6px、paint-order）
- [x] T059 [US2] `src/features/graph/GraphNode.tsx`：三狀態、群體虛框、鍵盤焦點、`role=button`
- [x] T060 [US2] `src/features/graph/RelationGraph.tsx`：容器 `ResizeObserver`、比例座標還原、SVG 層＋HTML 層、焦點與可見性接線
- [x] T061 [US2] `src/features/axis/AxisPage.tsx`：組裝 01 頁（舞台版）；`useAxisKeys`（←→）
- [x] T062 [US2] `src/features/graph/useNodeDrag.ts`：Pointer Events＋`localPoint`＋彈簧回彈，連線全程跟隨（流式版停用）
- [x] T063 [US2] `src/features/graph/useGraphViewport.ts`：縮放 50–200%（按鈕 ±25%、滾輪＋Ctrl、雙指）、平移、重設；`touch-action` 規則（research R12）
- [x] T064 [US2] `src/features/graph/GraphLegend.tsx`、`GraphControls.tsx`：圖例開關（含群體）、線上文字開關（hover 暫顯）、縮放顯示、重設
- [x] T065 [US2] 流式版主軸頁：sticky 事件列橫向滑動、目前事件自動置中、敘述下方「上一個／下一個」、直式座標關係圖（342 寬比例）、圖例列
- [x] T066 [US2] reduced-motion：畫線、回彈、淡入縮短
- [x] T067 [P] [US2] `src/dev/LayoutEditor.tsx`（僅開發）：拖曳節點→複製座標 JSON（桌機／流式各一）
- [x] T068 [P] [US2] `tests/e2e/keyboard.spec.ts`：←→ 推進、↑↓ 換頁、光譜聚焦時不換事件（先用占位 slider 元件）
- [x] T069 [US2] e2e：01 事件推進、焦點互斥、圖例開關、流式版無水平捲軸、點節點不多畫線

**Checkpoint 4**：01 完整可玩（桌機＋手機）；部署。

---

## Phase 5：User Story 3 — Popover 與追蹤人物（P2）

- [ ] T070 [US3] `src/components/text/PopoverLayer.tsx`：單例、舞台內最上層、`placePopover`、light-dismiss、Esc、焦點回錨點、`role=dialog`
- [ ] T071 [US3] `PersonPopover`（姓名＋身分＋階段文字＋頁尾「依目前進度 n」「在人物誌查看 →」）與 `TermPopover`（名詞固定、無頁尾）；內容取自 selector（劇透規則）
- [ ] T072 [US3] 流式版：Popover 改 `Sheet`（底部小卡＋scrim）
- [x] T073 [US3] ~~節點名稱 Popover~~ **已取消（G-09 決議：關係圖節點不開 Popover）**；以 `tests/unit` 斷言節點點擊只觸發聚焦、不開 Popover
- [ ] T074 [P] [US3] `tests/unit/popover-content.test.ts`：進度 0/1/2/3/4 對 15 人逐一斷言文字（含空段沿用）
- [ ] T075 [US3] 追蹤：`trackPerson/untrack`、persist、`TrackingBadge`（側欄區塊＋書籤＋× 取消；長名換行）、`TrackToast`（舞台：側欄右側 2.4s；流式：導覽列上方）、閃動 600ms×2
- [ ] T076 [US3] 事件格右上書籤、引言左上書籤；00 與關係圖不標亮
- [ ] T077 [US3] e2e：Popover 邊界翻轉、04 進度不洩漏、追蹤標記與取消、群體不可追蹤

**Checkpoint 5**：Popover 與追蹤可用；劇透測試全綠；部署。

---

## Phase 6：User Story 4 — 人物誌（P2）

- [ ] T078 [P] [US4] `tests/unit/slots.test.ts` → `src/features/people/slots.ts`：20 個 grid slot 座標；`arrangeByGroup/ByOrder/ByWorld` 皆在 5×4 內容納 15 人且無重複
- [ ] T079 [P] [US4] `tests/unit/center.test.ts` → `src/features/people/center.ts`：`CENTER_SLOTS`、`assignCenterSlots`、關係合併（配對合併、「・」串接、線種優先）；**窮舉 15 人×進度 0–4：矩形不重疊、不超出 1344×540、無人遺漏**
- [ ] T080 [US4] `PeopleDrawer.tsx`：路由 `#/people`、`returnTo`、下方 `inert`、Esc／✕／上一頁、升降 300ms、頁首（標題、進度提示、排列、關閉）
- [ ] T081 [US4] `PersonCard.tsx`／`CompactCard.tsx`：登場（金頂線）× 選中（浮起）獨立通道；追蹤按鈕（`stopPropagation`、追蹤中狀態）；劇透小標
- [ ] T082 [US4] `FilterBar.tsx`：群體／主軸／關係標籤三組單選、再點取消、`overflow-x:auto` 容量處理
- [ ] T083 [US4] `ArrangeSwitch.tsx`＋transform 過渡位移（360ms、`--ease-out-soft`）；reduced-motion 直接切換
- [ ] T084 [US4] `CenterView.tsx`：中心卡、環繞 slot 精簡卡、直角折線與線上文字、「沒有直接關係」欄（0.7）、尺寸過渡
- [ ] T085 [US4] `ExpandedPanel.tsx`：原位放大 600×508（320ms）、scrim、劇透區塊（點擊顯示／隱藏）、追蹤與關閉
- [ ] T086 [US4] 流式版人物誌：全螢幕、2 欄卡、橫向標籤列、膠囊關係標籤人物中心版、就地展開（直式樹狀**不實作**）
- [ ] T087 [US4] Popover「在人物誌查看 →」→ 開啟抽屜並以該人為中心（G-10）
- [ ] T088 [US4] e2e：進度對登場的影響（00／直接進入全灰）、標籤選中不重排、中心視角與展開流程、追蹤後關閉回原頁

**Checkpoint 6**：人物誌桌機＋手機可用；窮舉測試全綠；部署。

---

## Phase 7：User Story 5 — 伏筆（P2）

> 本階段先用一份 **03 事件 06 的測試資料**（含 3 個 `{h:}`）驗證；02–04 完整內容在 Phase 8 補上。

- [ ] T089 [P] [US5] `tests/unit/hints.test.ts`：獲得規則（01→1、02→8、03→2、04→1）、不補發、04 遮罩時機、答對／答錯判定、持久化
- [ ] T090 [P] [US5] `tests/unit/measure.test.ts` → `src/features/hints/measure.ts`：`measureAnchors`（假 rects）、防撞排序、弧線路徑（hash 擾動可重現）
- [ ] T091 [US5] `src/features/hints/hints store`＋獲得提示（合併、3 秒、hover 暫停）＋側欄徽章閃動
- [ ] T092 [US5] `HintTray.tsx`：舞台版高 168（不蓋側欄／頁首、無 scrim、240ms）；空狀態；流式版底部面板
- [ ] T093 [US5] `HintKeyword.tsx`：idle／selected／solved
- [ ] T094 [US5] `HintAnchor`（雙底線）＋`HintSlotLayer.tsx`／`HintSlot.tsx`：旁註欄定位、防撞、四狀態（空／可放置／鎖定／答錯）
- [ ] T095 [US5] `HintArc.tsx`：手繪感弧線、同行錯開、空框格虛線
- [ ] T096 [US5] 重新量測觸發：`ResizeObserver`、`fonts.ready`＋`loadingdone`、事件切換、compact／版型變更
- [ ] T097 [US5] `useHintDrag.ts`：Pointer Events、拖曳影像（`localPoint`）、原位虛線空位、命中測試、視窗縮放時取消
- [ ] T098 [US5] 點選替代＋鍵盤（Enter／Tab）＋流式版說明條「已選『…』，點頁面上的框格放入。取消」
- [ ] T099 [US5] 答對（鎖定、光暈閃動、淡入說明）／答錯（震動 300ms、回托盤）、`aria-live`、reduced-motion 以文字與框色表達
- [ ] T100 [US5] 流式版 `NoteRow`：**`display:block`**（不可 inline-block，會讓兩端對齊拉伸上一行）、50px 註記列、並排／放不下則堆疊、短弧線；插入點集中在 `src/features/hints/note-placement.ts` 的 `resolveNoteInsertionPoint()`（策略 `after-punct` 預設，可替換為 `after-sentence`／`after-line`／`author`）；`tests/unit/note-placement.test.ts`（插入點、`display:block` 屬性）；`/__kit` 加「伏筆註記列」比較區（寬 320／360／390／640）；e2e 斷言註記列上方一行平均字寬 ≈ 字級。**依據與已知排版風險：`docs/設計決策-手機版伏筆註記列位置.md`**
- [ ] T101 [P] [US5] `tests/e2e/anchors.spec.ts`：矩陣各桌機尺寸（含 compact）框格舞台座標差 ≤ 2px、框格互不相交；改字型／事件切換後仍成立；同時建立 `.github/workflows/e2e.yml`（PR 與手動觸發、不擋部署）
- [ ] T102 [P] [US5] `tests/e2e/touch.spec.ts`：觸控模擬點選放置；關係圖放大前單指仍可捲動頁面

**Checkpoint 7**：伏筆完整流程（桌機拖曳、手機點選）；幾何斷言通過；部署。

---

## Phase 8：User Story 6 — 各主軸專屬互動與 02–04 內容（P3）

### 6a　01 邊界之辯
- [ ] T103 [P] [US6] `tests/unit/spectrum.test.ts`：位置→最近立場、吸附、方向鍵跳立場
- [ ] T104 [US6] `BoundarySpectrum.tsx`：`role=slider`、拖曳、吸附 200ms、立場名可開 Popover、方向鍵 `preventDefault`
- [ ] T105 [US6] 交叉連結 `{x:spectrum|…}`：舞台版光譜閃動、流式版捲動後閃動

### 6b　02 比較滑桿與時間感
- [ ] T106 [US6] `pages/02.yaml`：6 個事件（含新增「時間瓶」）、節點（長生者／凡人分區）、6＋連線、桌機座標（628×290）與流式座標、比較滑桿兩欄
- [ ] T107 [US6] `CompareSlider.tsx`：左右分割、把手 20–80%、寬側 20px／窄側 0.35、鍵盤 ±10%、方向鍵合約
- [ ] T108 [US6] 時間感：`--age` 三層（紙色混合、暈影覆蓋層、內容 sepia）、疊層不套 filter、離開重設、節流量化；效能退化開關
- [ ] T109 [US6] 流式版比較滑桿（G-02）：**全寬 100%、左右分割不堆疊**、高度隨內容；可拖範圍保證窄側 ≥ 96px，`age` 以實際上限正規化（`tests/unit/compare-age.test.ts`：寬 320／342／640／1288 皆在最右得 1、50% 與左側得 0）；暈影覆蓋層 `position:fixed`；`touch-action`：容器 `pan-y`、把手 `none`

### 6c　03 三界分層
- [ ] T110 [US6] `pages/03.yaml`：7 個事件（含新增「召喚儀式」）、節點（含利歐蘭）、連線、三層、桌機座標與流式座標、兩則引言（`event: 7`）
- [ ] T111 [US6] `LayeredGraph.tsx`／`LayerBand.tsx`：層頭（層名＋人數＋收合）、收合 46px／300ms、跨層線改連層頭邊緣、「只看地底」、節點垂直置中
- [ ] T112 [US6] 引言區（預設整頁常駐、`showFromEvent` 可調、被追蹤者書籤、`overflow-y:auto`）；流式版三層可收合區塊；「人間」層 6 節點在關係圖 628 寬下拆兩列

### 6d　04 遮罩、鏡像卡、明信片
- [ ] T113 [US6] `pages/04.yaml`：6 個事件（含伏筆 #3 新句）、節點、連線、鏡像卡兩面三欄、明信片、抉擇＋留言、遮罩文案
- [ ] T114 [US6] `SpoilerCover.tsx`（G-14 已同意）：只蓋頁首以下、背後內容 `inert`、←→ 無效（↑↓ 與側欄可用）、sessionStorage、`progress()` 在打開前回傳 3、打開後才獲得 04 伏筆；單元測試涵蓋三點
- [ ] T115 [US6] `MirrorCard.tsx`：三層元素（閒置 rotateY ±8°／翻面 180°／厚度陰影）、`backface-visibility`（含 `-webkit-`）、reduced-motion 改淡入
- [ ] T116 [US6] `Postcard.tsx`：`plate` 樣式正面（占位圖 `public/images/`）、背面留言、翻面 600ms、說明行
- [ ] T117 [US6] `ChoiceBlock.tsx` 與「事件→專屬區塊」對應（3 鏡像、5 明信片、其餘抉擇）；流式版縮小版（G-02）
- [ ] T118 [US6] 伏筆回收標記：把 `hints.yaml` 的 12 個回收處 `{h:…}` 寫入 02／03／04 對應事件敘述；`content:check` 全通過
- [ ] T119 [P] [US6] e2e：各頁專屬互動、04 遮罩流程、方向鍵不干擾滑桿

**Checkpoint 8**：01–04 全部內容與專屬互動完成（桌機＋手機）；部署。

---

## Phase 9：Polish 與交付

- [ ] T120 以 `LayoutEditor` 校正 01–04 全部桌機／流式座標；人工檢查線上文字不互蓋
- [ ] T121 版面溢出走查（G-05）：25 個事件×矩陣×compact，左欄無溢出（Playwright 斷言 `scrollHeight ≤ clientHeight`）
- [ ] T122 無障礙：角色／標籤檢查、鍵盤走完全站、`aria-live`、對比（含 02 age=1）、`inert` 行為
- [ ] T123 效能：Lighthouse、bundle 分析（目前 gzip 106KB，其中 zod 佔大宗：正式版可跳過執行期 zod 驗證——建置時 content:check 已驗證——或改用 zod/mini）（`React.lazy` 分割 04／LayoutEditor）、拖曳／畫線 fps 檢查
- [ ] T124 [手動] 真機檢查清單：iPhone Safari、Android Chrome（捲動 vs 關係圖、3D 翻面、字型載入、底部導覽列安全區）
- [ ] T125 「重置進度」入口（清除追蹤、伏筆、遮罩）與文案
- [ ] T126 `README.md`（開發、改文字、部署）＋校對 quickstart.md；更新教學中的實際檔案與網址
- [ ] T127 最終驗收：對照 spec 的 SC-001…SC-007 與全部 Acceptance Scenarios；`npm run check`、`npm run build`、e2e 全綠後最後一次部署

---

## 相依與執行順序

- **Phase 1 → Phase 2 → 其餘**；Phase 2 完成前不得開始任何 US。
- Phase 3（US1）是骨架；Phase 4（US2）依賴 Phase 3 的頁面與 Dock。
- US3（Popover／追蹤）、US4（人物誌）、US5（伏筆）都**依賴 US2 的主軸頁**，但三者彼此獨立，可平行（人物誌的追蹤按鈕需要 T075，可先用占位）。
- US6 依賴 US2（框架）；6a 依賴 US3 的 Popover（立場人名）；6b／6c／6d 彼此獨立。
- Phase 8 的 T118 依賴 Phase 7（框格機制）與 6b–6d 的內容檔。
- 同一 Phase 內，不同檔案且標 `[P]` 的任務可平行；純邏輯任務一律「測試先紅、再實作變綠」。

### 平行範例
```
# Phase 2B：這 6 個互不相依
T019 localPoint   T020 stage-metrics   T021 storage   T022 spring   T023 useReducedMotion   T024 hash-router
# Phase 2C 資料檔：這 5 個互不相依
T030 people.yaml  T031 glossary.yaml   T032 hints.yaml   T033 ui.yaml   T034 convert-bio
# Phase 7：先寫測試的兩個
T089 hints.test   T090 measure.test
```

## 實作策略
1. **MVP＝Phase 1–4**：站台骨架＋01 完整事件與關係圖＋部署。此時讀者已能完整閱讀 00 與 01，並驗證了最大技術風險（舞台、關係圖、座標）。
2. 之後依價值遞增：Popover／追蹤（US3）→ 人物誌（US4）→ 伏筆（US5）→ 專屬互動與 02–04 內容（US6）。
3. 每個 Checkpoint 都部署並由你在手機與桌機實際操作確認，再進下一階段。
4. 內容（YAML）與程式可由不同的人／時間完成：Phase 2C 先放好資料檔架構與 `content:check`，之後 02–04 內容可隨時補齊而不改程式。
