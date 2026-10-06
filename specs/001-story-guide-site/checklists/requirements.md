# Specification Quality Checklist：故事導覽網站

**Purpose**：在進入實作前驗證 spec／plan／tasks 的完整性與品質（spec-kit `/speckit.checklist` 風格）
**Created**：2026-10-07 ｜ **Feature**：[spec.md](../spec.md)

## 內容品質
- [x] spec 描述「讀者能做什麼」而非實作細節（技術細節在 plan／research）
- [x] 所有必填章節皆完成（User Scenarios、Requirements、Success Criteria、Assumptions）
- [x] 每個使用者故事都有可獨立測試的方式與 Given/When/Then 驗收情境
- [x] 故事有優先順序（P1–P3）且 P1 可單獨部署成可讀網站

## 需求完整性
- [x] 沒有未註明預設的 `[NEEDS CLARIFICATION]`（所有疑問皆在 clarifications.md 且附暫定預設）
- [x] 需求可測試、無歧義（FR 皆有對應驗收情境或測試任務）
- [x] 成功標準可量測（SC-001…SC-007 皆為具體數值或可自動化斷言）
- [x] 邊界情況已列（縮放中字型載入、儲存不可用、直接進入 `#/people`、拖曳中版型切換、320px、2560 寬…）
- [x] 範圍明確：直式樹狀人物中心視角（廢棄）、各頁「先猜說話者」引言卡（移除）、事件交叉連結只做 01 一處
- [x] 相依與假設已列（倉庫名、字型來源、素材待提供）

## 需求對應檢查（你的 6 點）
- [x] #1 Tailwind 主題／共用元件 → design-system.md、tasks T012–T018、T042
- [x] #2 可行性與不明確處 → research.md（§0 實驗、§2 矩陣、§3 風險）、clarifications.md（5 題待回覆）
- [x] #3 編譯與部署＋新手教學 → plan「#3」、docs/部署教學-GitHub-Pages.md、tasks T005–T011
- [x] #4 螢幕適應與關係圖作法 → contracts/layout-and-coordinates.md、research R3/R4/R9/R12/R13、SC-001
- [x] #5 文字集中管理 → contracts/content-markup.md、data-model §1、tasks T025–T035
- [x] #6 伏筆框格跟隨文字 → research R8（含實驗 S1–S3）、contracts §5、tasks T089–T102、SC-002

## 憲章一致性
- [x] 文字不進程式（T003 lint、T035 key 檢查）
- [x] 兩種版型皆在每個故事的驗收內
- [x] 無新增執行期依賴超出白名單
- [x] 每個 Phase 結尾可部署

## 已決議（2026-10-07）
- [x] G-05 02–04 左欄 620／關係圖 628
- [x] G-09 節點不開 Popover
- [x] G-02 比較滑桿全寬不堆疊；三界可收合；04 卡片縮小
- [x] D-01 `contents/`、`docs/` 移出版控並覆蓋遠端
- [x] N-01 文字不可選取、不可複製

- [x] G-14 04 遮罩期間的進度／伏筆／鍵盤（使用者已同意）
- [x] 01–04 欄寬統一 620／628

## 仍待使用者確認
- 無。可進入 Phase 1。

## Notes
- 勾選項目＝文件已涵蓋；未勾選＝等待使用者回覆（已有暫定預設，可先開工）。
