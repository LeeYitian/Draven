# Data Model：內容資料與執行期狀態

> 內容資料（YAML，作者維護）與執行期狀態（zustand，讀者操作產生）分開定義。型別以 TypeScript 表示，實作時由 zod schema 生成／對應（`src/content/schema.ts`）。

---

## 1. 內容資料（`src/content/`）

```
src/content/
├─ pages/00.yaml … 04.yaml     各頁文字（每頁各自集中）
├─ people.yaml                 15 人：卡片、別名、Popover 4 階段、完整介紹（含劇透標記）、關係補充
├─ glossary.yaml               名詞解釋（固定內容）
├─ hints.yaml                  12 條伏筆：關鍵字、獲得／回收、解開後說明
├─ ui.yaml                     介面文案、aria 標籤、提示（含方向鍵首次提示）
└─ index.ts / schema.ts        載入、型別與 zod 驗證
```

### 1.1 Person（`people.yaml`）
```ts
interface Person {
  id: string;                    // 'dravin' | 'elian' …（英文 id，內容檔以 id 互相參照）
  name: string;                  // 德雷文
  group: GroupId;                // 王廷｜魔女集會｜盤蛇教會｜人馬族｜神靈（人物誌群體）
  role: string;                  // 卡片身分：「國王 · 艾莉絲的養子」
  intro: string;                 // 卡片簡介（不含劇透）
  firstAppearance: { axis: 1|2|3|4; event: number };   // 登場（取 axis 作為進度比較）
  order: number;                 // 出場順序（依主軸→事件）
  world: 'human' | 'underground' | 'otherworld';       // 起始所在世界（G-18）
  worldEnd?: 'human' | 'underground' | 'otherworld';   // 有移動者
  tags: TagId[];                 // 關係標籤：人類／外族／朝堂／教會／臣子／家人／朋友／互相監督／互相協助
  aliases: { text: string; autoLink?: boolean }[];     // autoLink:false → 只在 {p:…} 明確標記時連結
  popover: [string, string, string, string];           // [基本, 讀完01, 讀完02, 讀完03]；空字串＝沿用前一段
  bio: BioBlock[];                                     // 完整介紹
  spoilerAxis?: 2|3|4;           // 卡片上「劇透 · 0x」小標的主軸（僅提示，內容不上卡）
  trackable: true;               // 群體節點沒有此欄位（見 Group）
}
type BioBlock = { type: 'text'; text: string } | { type: 'spoiler'; axis: 2|3|4; text: string };
```
- **群體節點（Group）**：`守舊貴族`、`小貴族`、`獸人` 在各頁 `graph.nodes` 以 `kind: group` 定義，沒有 Popover、不可追蹤、虛框樣式。

### 1.2 Axis 頁（`pages/01.yaml`…）
```ts
interface AxisPage {
  axis: 1|2|3|4;
  number: string;                // '01'
  category: string;              // 第一主軸 · 政治與文化主線
  title: string;                 // 統一之杖：荊棘之王德雷文
  oneLiner: string;              // 手機版頁首副標
  coreTheme: string;             // 核心主題
  subtitleOverrides?: …;         // 非必要
  eventsHeading?: string;        // 「事件進程 · 孩子與國王」等標題
  events: AxisEvent[];           // 01/02/04：6；03：7
  graph: GraphDef;
  quotes?: Quote[];              // 03
  extras: Record<string, unknown>; // 各頁專屬資料（見 1.4）
}
interface AxisEvent {
  n: number;                     // 1…7
  title: string;                 // 事件列顯示（≤ 6 字，超出截斷）
  tag: string;                   // 朝堂／基層／思辨…
  text: string;                  // 敘述，含行內標記（contracts/content-markup.md）
  participants: string[];        // personId[] 或 groupNodeId[]（點事件時亮起、追蹤時標書籤；括號人物也列）
  focusNodes?: string[];         // 若與 participants 不同才需要（有節點才亮）
}
```

### 1.3 Graph（`pages/0x.yaml` 的 `graph`）
```ts
interface GraphDef {
  layers?: { id: string; label: string; nodes: string[] }[];  // 03 三界／02 分區／04 為了…；有則啟用分層
  nodes: GraphNode[];
  edges: GraphEdge[];
  legend: { kind: EdgeKind; label: string }[];   // 圖例名稱依頁（衝突／試探／操弄／攻擊）
  layout: { desktop: Layout; flow: Layout };     // 座標（見下）
}
interface GraphNode {
  id: string;                    // personId 或 group id
  kind: 'person' | 'group';
  label: string;                 // 顯示名
  sub: string;                   // 節點副標（反對外派子弟…）
  layer?: string;
}
interface GraphEdge {
  id: string;
  from: string; to: string;
  label: string;                 // 線上文字
  kind: 'key' | 'relation' | 'conflict';   // 本篇關鍵／關係／衝突(試探、操弄、攻擊同屬 conflict 類，圖例名稱由 legend 決定)
  both?: boolean;                // 雙向箭頭
  event: number | 'bg';          // 出現的事件序；'bg'＝背景關係（進頁即畫、不參與逐步）
  labelOffset?: [number, number]; // 線上文字微調（相對中點，設計稿座標）
}
interface Layout {
  size: [number, number];        // 設計時的畫布尺寸：桌機 [628, 457]（02 為 [628,290]；G-05 統一為 628 寬）、流式 [342, 300]
  nodes: Record<string, [number, number]>;   // 設計座標（px，相對 size）→ 載入時正規化為 0–1 比例
}
```
- **正規化**：載入時 `x/size[0]`、`y/size[1]` → 比例；執行時乘容器實際寬高。因此流式版任意寬度、桌機不同高度（02 的 290）都能共用同一份資料結構。

### 1.4 各頁專屬資料（`extras`）
```ts
// 01
interface BoundaryDebate {
  title: string; leftLabel: string; rightLabel: string; hint: string;      // 「界線不可逾越／無分種族共榮」「拖曳指標…」
  stances: { personId: string; label: string; position: number; quote: string }[]; // 露米10 諾爾30 法恩50 布倫75 德雷文100
  defaultPosition: 100; crossLinkEvent: 5;
}
// 02
interface CompareSlider { left: CompareColumn; right: CompareColumn; range: [20, 80]; }
interface CompareColumn { label: string; quote: string; source: string; }
// 04
interface MirrorCard { sideA: MirrorSide; sideB: MirrorSide; rows: { key: string; label: string }[]; } // key: identity|choice|motive
interface MirrorSide { personId: string; subtitle: string; cells: Record<string, string>; }
interface Postcard { frontImage: string; backTitle: string; backText: string; caption: string; }
interface ChoiceBlock { lines: string[]; messages: string[]; }                // 艾莉絲的抉擇＋留言
interface SpoilerCover { title: string; body: string; button: string; }
// 事件 → 專屬區塊的對應（04）
type EventExtraMap = Record<number, 'mirror' | 'postcard' | 'choice'>;       // {3:'mirror', 5:'postcard', default:'choice'}
```

### 1.5 Quote（03）
```ts
interface Quote { id: string; title: string; text: string; speaker: string /*personId*/; event: number /*起顯示的事件，G-06 預設 7*/ }
```

### 1.6 Term（`glossary.yaml`）
```ts
interface Term { id: string; term: string; firstPage: 0|1|2|3|4; text: string; aliases?: string[] }  // 固定內容
```

### 1.7 Hint（`hints.yaml`）
```ts
interface Hint {
  id: string;                     // 'cold-hand'
  n: number;                      // 1–12（原伏筆整理編號）
  keyword: string;                // 冰涼的手（抽屜顯示，不洩漏答案）
  acquire: 1|2|3|4;               // 獲得主軸（點進該主軸）
  recycle: { axis: 1|2|3|4; event: number };   // 回收處（頁與事件）；對應頁面文字中必須有一個 {h:<id>|…}
  explain: string;                // 解開後說明
}
```
- **一致性規則（建置驗證）**：① 每條 `hint.recycle` 指向的事件敘述中恰好出現一個 `{h:<id>|…}`；② 每個 `{h:…}` 的 id 存在；③ 同一事件內片語不重疊；④ `acquire ≤ recycle.axis`。
- 獲得數量（由資料推得）：01→1（忘了送的禮物）、02→8、03→2、04→1，共 12。

### 1.8 UiString（`ui.yaml`）
鍵值字串＋含 `{n}`／`{keyword}` 的樣板，如 `hint.acquired: "獲得新伏筆：{keyword}"`、`hint.count: "已獲得 {n} 個伏筆"`、`hint.empty`、`people.spoiler.locked: "讀完第 {n} 主軸後解鎖（點擊仍可查看）"`、`people.sort.group|order|world`、`event.expand`、`keys.firstTime`、`cover.title|body|button`。**元件一律以 `t('key', params)` 取字。**

---

## 2. 執行期狀態（zustand）

```ts
// nav
page: 0|1|2|3|4;                 // 目前主軸（00=0）；故事進度＝page，04 遮罩未打開時進度視為 3（G-14）
returnTo: string;                // 人物誌開啟前的路由
peopleOpen: boolean;             // 由路由 #/people 驅動

// axis（依頁面各自一份）
eventIndex: Record<1|2|3|4, number>;     // 目前事件序（0-based）
focus: { type: 'event'; id: number } | { type: 'node'; id: string } | null; // 互斥，每頁各自
revealedAt: Record<edgeId, number>;      // 畫線動畫時間戳（只在「新進入事件」時設，已畫過不重播）

// graph（依頁面）
graphZoom: number; graphPan: [number, number];
legendOn: Record<EdgeKind | 'group', boolean>; edgeLabelsOn: boolean;
layerCollapsed: Record<layerId, boolean>;

// tracking（persist: localStorage）
trackedPersonId: string | null;

// hints（persist: localStorage）
owned: string[]; solved: string[]; selectedHint: string | null;
acquireToast: { count: number; keywords: string[] } | null;

// people（人物誌，不持久）
center: string | null; expanded: boolean; tag: TagKey | null; sort: 'group'|'order'|'world';
spoilerRevealed: Record<`${personId}:${axis}`, boolean>;

// extras
compareSlider: number;           // 20–80；離開 02 重設 50
spectrum: number;                // 0–100；預設 100
page04Unlocked: boolean;         // persist: sessionStorage
```

### 2.1 派生（純函式 selector，皆有單元測試）
| selector | 規則 |
|---|---|
| `progress(state)` | `page===4 && !page04Unlocked ? 3 : page`；`#/people` 直接進入 → 0 |
| `isOnStage(person, progress)` | `person.firstAppearance.axis <= progress`（`progress=0` → false）|
| `popoverText(person, progress)` | 取階段 `i = clamp(progress-1, 0, 3)`；依序累積 `popover[0..i]`，空字串跳過；progress 0/1 只含 `[0]` |
| `visibleEdges(page, eventIndex)` | `event==='bg' \|\| event <= eventIndex+1` |
| `edgeState(edge, state)` | `unrevealed \| dim \| normal \| lit`（事件焦點：lit＝edge.event===焦點事件；節點焦點：lit＝與焦點節點相連且 visible） |
| `nodeState(node, state)` | `normal \| focus \| dim`（事件焦點：參與者 focus；節點焦點：自己與鄰居 focus） |
| `eventTracked(event, trackedId)` | `participants.includes(trackedId)` |
| `eventMarkedByNodeFocus(event, nodeId)` | 事件列編號變金色加底線 |
| `centerRelations(personId, progress)` | 合併 pages 1…progress 的 `edges`＋`people.relations` 補充，依無序配對合併 |
| `spoilerVisible(block, revealedMap)` | 只看使用者點擊，**不看 progress** |
| `hintAnchors(page, eventN)` | 事件敘述中的錨點 id 列表 |
| `slotAnswer(slotHintId, keywordHintId)` | 相等＝答對 |

### 2.2 人物誌 slot 資料（`src/features/people/slots.ts`）
- `GRID_SLOTS`：20 個（5 欄×4 列）座標 `{x:48+col*274, y:188+row*128}`。
- `arrangeByGroup/ByOrder/ByWorld(people) → Record<personId, slotIndex>`（見 research R13；`byWorld` 需 5×4 內容納：人間 12＝3 欄、地底 1 欄、異界 1 欄）。
- `CENTER_SLOTS`：12 個環繞 slot＋「無關係欄」，每個 slot 含 `{x, y, side:'top'|'left'|'right'|'bottom', layer:'near'|'far', anchorOut:{x,y}, anchorIn:{x,y}}`；`assignCenterSlots(centerId, relations)` 為純函式。
