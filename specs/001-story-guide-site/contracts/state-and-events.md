# Contract：狀態、路由、鍵盤與事件規則

---

## 1. 路由（hash）
| Hash | 意義 | 備註 |
|---|---|---|
| `#/` | 00 世界觀導讀 | 未知 hash 一律回此 |
| `#/axis/1` … `#/axis/4` | 主軸 01–04 | |
| `#/people` | 人物誌抽屜 | 疊在 `returnTo` 頁面上；直接進入 `returnTo='#/'`、進度 0 |

- 開啟人物誌：`history.pushState({returnTo}, '', '#/people')`；關閉（✕／Esc／追蹤完成／瀏覽器上一頁）：`history.back()` 或 `replaceState` 回 `returnTo`。
- 直接進入 `#/people` 時沒有上一頁可回 → 關閉＝導向 `#/`。
- 換頁 `setPage(n)`：更新 hash、重設該頁暫態（`focus`），保留 `eventIndex[n]`；進入主軸觸發「獲得伏筆」（見 §4）。

## 2. 方向鍵合約（舞台版）
全域處理器（`document` 的 `keydown`）略過的情況（任一成立即 return）：
1. `event.defaultPrevented`（元件已處理，如光譜、比較滑桿）。
2. `event.target` 符合：`input, textarea, select, [contenteditable], [role="slider"], [data-no-arrows]`。
3. 人物誌開啟（`peopleOpen`）。
4. `layout.mode === 'flow'`。
5. 帶修飾鍵（Ctrl／Alt／Meta／Shift）。
6. 04 遮罩未打開（只允許 ↑↓）。

動作（皆 `preventDefault()`）：
- `ArrowDown/ArrowUp`：`page ± 1`（0–4，邊界不動作）。
- `ArrowRight/ArrowLeft`：僅 `page ∈ 1–4`；`eventIndex ± 1`（邊界不動作），並將焦點設為該事件（`focus={type:'event'}`）。
- 元件自行處理方向鍵時必須 `event.preventDefault()`：光譜（跳立場）、比較滑桿（±10%）、人物誌篩選列（若採 roving）。
- 第一次進入主軸、桌機版顯示一次性提示（`ui.keys.firstTime`），3 秒淡出，之後不再顯示（localStorage，不可用則每次工作階段一次）。

## 3. 事件／節點焦點與連線可見性
- **事件焦點** `focus={type:'event', id:n}`：`lit` 邊＝`edge.event===n`；其餘可見邊 `dim`；節點：`participants(n)` 為 `focus`、其餘 `dim`（群體節點同理）。
- **節點焦點** `focus={type:'node', id}`：`lit` 邊＝與該節點相連且 `visible`；其餘可見邊 `dim`；節點：自己＋鄰居 `focus`；事件列：該節點有出場的事件編號變金色加底線。
- 兩者互斥：設定其一即清除另一個。
- **可見邊**＝`edge.event==='bg' || edge.event <= eventIndex+1`（累積）。**點節點不改 `eventIndex`**（仍只畫到目前事件）。
- 點事件 `n`：`eventIndex=n-1`、`focus={event,n}`；若 `n-1 > 原 eventIndex`：對 `edge.event===n` 的邊播放畫線（依序、400ms/120ms），**更早的邊立即出現**；若向前跳多個事件，中間事件的邊不播動畫（G-13）。
- 回退（←或點較前事件）：`edge.event > 新 eventIndex+1` 的邊淡出 120ms 後移除。
- 進入主軸（首次）：`eventIndex=0`，播放事件 01 的新邊；再次進入（已有 eventIndex）：不重播。
- `prefers-reduced-motion`：一律直接顯示。

## 4. 獲得伏筆
- 觸發：`setPage(n)`、`n ∈ 1–4`，且（`n≠4` 或 `page04Unlocked`；04 在打開遮罩後才觸發）。
- 動作：`hints.filter(h => h.acquire===n && !owned.has(h.id))` → 加入 `owned`；若數量 > 0 → 設定 `acquireToast`（多個合併為「獲得 N 個新伏筆」，單個顯示關鍵字）、徽章閃動 600ms×2。
- 提示停留 3 秒；滑鼠移入暫停；`prefers-reduced-motion` 仍顯示但不閃動。

## 5. 伏筆放置（拖曳／點選共用狀態機）
```
關鍵字狀態：idle → selected → (placed:solved | back→idle)
框格狀態：  empty → ready(有關鍵字被選中／拖曳中) → solved | wrong(300ms) → empty
```
- 選取方式：點關鍵字（toggle）、Enter／Space（鍵盤）、開始拖曳（Pointer Events，移動 > 4px 才算拖曳）。
- 放置判定：放開時以舞台座標對框格矩形做命中測試（`elementsFromPoint` 排除拖曳影像）；或在 `selected` 狀態點框格／在框格按 Enter。
- 判定：`slotHintId === keywordHintId` → `solved`（寫入 `solved`、框格閃動、顯示 `explain`）；否則 `wrong`（震動 300ms，關鍵字回托盤，`selected` 清除）。
- 已解開的關鍵字不可選／拖；已解開的框格不可再操作。
- 拖曳中視窗縮放／版型切換 → 取消（關鍵字回托盤）。

## 6. 追蹤
- `trackPerson(id)`：僅 `kind==='person'` 可；覆蓋前一位；寫入 localStorage；若來自人物誌 → 關閉抽屜導向 `returnTo`（直接進入者導向 `#/`）→ 觸發追蹤回饋（側欄追蹤區外框閃動 600ms×2＋提示 2.4 秒；流式版導覽列上方提示）。
- `untrack()`：側欄 ×。
- 標示：事件格（`participants` 含該人）右上書籤；引言（`speaker`）左上書籤；**不**作用於關係圖與 00。

## 7. 人物誌互動
| 操作 | 結果 |
|---|---|
| 點標籤 | `tag = (tag===t ? null : t)`（單選、可取消）；選中人物集合＝符合標籤者（含未登場，維持灰階） |
| 點卡片本體（非中心） | `center=id`、`expanded=false`；`sort` 暫時停用 |
| 點中心卡本體 | `expanded=true`（原位放大浮層，scrim） |
| 點浮層外／✕／Esc | `expanded=false`（Esc 在 `expanded` 時先收浮層，再按一次關抽屜） |
| 點「以 X 為中心」✕ | `center=null`（回到網格排列） |
| 點「追蹤」 | `event.stopPropagation()`；`trackPerson(id)`（見 §6） |
| 點劇透區塊 | `spoilerRevealed[`${id}:${axis}`]=!…`（只由點擊決定） |
| 切換排列 | `sort=…`（中心視角中停用） |

## 8. 04 劇透遮罩
- `page04Unlocked` 為 false 時：頁首以下蓋遮罩；`inert` 套用在被蓋住的內容；`progress()` 回傳 3；不觸發 04 伏筆；←→ 不作用。
- 點「我準備好了，打開」→ `page04Unlocked=true`（sessionStorage）→ 觸發 §4 獲得伏筆 → 遮罩消失。

## 9. 無障礙與動態偏好
- `useReducedMotion()`：訂閱 `matchMedia('(prefers-reduced-motion: reduce)')`；JS 動畫（畫線、彈簧、閃動）在此為真時直接設為終態；CSS 動畫以 `motion-reduce:` 變體取消。
- 疊層開啟時：焦點移入該層、Esc 關閉、關閉後焦點回到觸發元素；人物誌開啟時其下方 `inert`。
- 狀態變化的口頭通知：`aria-live="polite"` 區（獲得伏筆、答對／答錯、追蹤開始）文字取自 `ui.yaml`。
