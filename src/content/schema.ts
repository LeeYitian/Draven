/**
 * 內容資料的結構定義（data-model.md §1）。作者維護的 YAML 一律用 strictObject：
 * 欄位名稱寫錯會直接報錯，而不是靜默忽略。
 * 本檔會被 Node 直接執行（scripts/content-check.ts），import 一律寫副檔名。
 */
import { z } from 'zod';
import { EDGE_KINDS, GROUP_IDS, TAG_IDS, WORLD_IDS } from './constants.ts';

export { EDGE_KINDS, GROUP_IDS, TAG_IDS, WORLD_IDS };

const id = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, '必須是小寫英文 id（可含數字與連字號），例如 "fane"');
const axisNumber = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const position = z.tuple([z.number(), z.number()]);

// ── 人物誌用的分類 ───────────────────────────────────────────
export const GroupIdSchema = z.enum(GROUP_IDS);
export const TagIdSchema = z.enum(TAG_IDS);
export const WorldIdSchema = z.enum(WORLD_IDS);

// ── 人物（people.yaml）──────────────────────────────────────
const BioBlockSchema = z.union([
  z.strictObject({ type: z.literal('text'), text: z.string().min(1) }),
  z.strictObject({
    type: z.literal('spoiler'),
    axis: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    text: z.string().min(1),
  }),
]);

export const PersonSchema = z.strictObject({
  id,
  name: z.string().min(1),
  group: GroupIdSchema,
  role: z.string().min(1),
  intro: z.string().min(1),
  firstAppearance: z.strictObject({ axis: axisNumber, event: z.number().int().min(1) }),
  order: z.number().int().min(1),
  world: WorldIdSchema,
  worldEnd: WorldIdSchema.optional(),
  tags: z.array(TagIdSchema),
  aliases: z
    .array(
      z.strictObject({
        text: z.string().min(1),
        /** false＝不自動辨識（歧義別名），只在作者明確寫 {p:id|文字} 時連結 */
        autoLink: z.boolean().optional(),
        /** 全文出現過的錯字，建議直接修正原文；仍會連結並顯示原文 */
        typo: z.boolean().optional(),
      }),
    )
    .default([]),
  /** [基本身分, 讀完 01, 讀完 02, 讀完 03]；空字串＝沿用前一段（04 的內容永遠不進 Popover） */
  popover: z.tuple([z.string().min(1), z.string(), z.string(), z.string()]),
  bio: z.array(BioBlockSchema).min(1),
  /** 卡片上「劇透 · 0x」小標用：完整介紹中第一個劇透段落的主軸 */
  spoilerAxis: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

/** 跨主軸、貫穿故事的人物關係（人物中心視角用；內容準備文件「跨主軸關係」表） */
export const PersonRelationSchema = z.strictObject({
  from: id,
  to: id,
  label: z.string().min(1),
  kind: z.enum(['key', 'relation', 'conflict']).default('relation'),
});

export const PeopleFileSchema = z.strictObject({
  people: z.array(PersonSchema).min(1),
  relations: z.array(PersonRelationSchema).default([]),
});

// ── 名詞（glossary.yaml）─────────────────────────────────────
export const TermSchema = z.strictObject({
  id,
  term: z.string().min(1),
  /** 首次出現的頁（0＝00 導讀） */
  firstPage: z.union([z.literal(0), axisNumber]),
  text: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  /** false＝不自動辨識：太常見的詞（人間、異界），或同時是人物的詞（盤蛇神、地龍；它們在後面各頁要走人名 Popover）。作者明確標 {t:id|文字} 時才連結 */
  autoLink: z.boolean().default(true),
});
export const GlossaryFileSchema = z.strictObject({ terms: z.array(TermSchema).min(1) });

// ── 伏筆（hints.yaml）────────────────────────────────────────
export const HintSchema = z.strictObject({
  id,
  n: z.number().int().min(1),
  keyword: z.string().min(1),
  /** 讀者「進入」這個主軸時獲得 */
  acquire: axisNumber,
  /** 回收處：該頁、該事件的敘述中必須恰有一個 {h:<id>|…} */
  recycle: z.strictObject({ axis: axisNumber, event: z.number().int().min(1) }),
  explain: z.string().min(1),
});
export const HintsFileSchema = z.strictObject({ hints: z.array(HintSchema).min(1) });

// ── 介面文案（ui.yaml）：任意深度的字串樹 ──────────────────────
export type UiTree = { [key: string]: string | UiTree };
export const UiSchema: z.ZodType<UiTree> = z.lazy(() =>
  z.record(z.string(), z.union([z.string(), UiSchema])),
);

// ── 主軸頁（pages/01–04.yaml）────────────────────────────────
export const EdgeKindSchema = z.enum(EDGE_KINDS);

export const AxisEventSchema = z.strictObject({
  n: z.number().int().min(1),
  title: z.string().min(1),
  tag: z.string().min(1),
  /** 敘述，含行內標記 */
  text: z.string().min(1),
  /** 事件參與者（點事件時亮起；追蹤人物時標書籤）：人物 id 或群體節點 id；沒有節點的人也要列 */
  participants: z.array(id).min(1),
});

export const GraphNodeSchema = z.strictObject({
  id,
  kind: z.enum(['person', 'group']),
  /** person 預設取 people.yaml 的 name；group 必填 */
  label: z.string().optional(),
  sub: z.string().min(1),
  layer: z.string().optional(),
});

export const GraphEdgeSchema = z.strictObject({
  id,
  from: id,
  to: id,
  label: z.string().min(1),
  kind: EdgeKindSchema,
  both: z.boolean().optional(),
  /** 出現的事件序；'bg'＝背景關係（進頁即畫、不參與逐步推進） */
  event: z.union([z.number().int().min(1), z.literal('bg')]),
  labelOffset: position.optional(),
});

const LayoutSchema = z.strictObject({
  /** 設計時的畫布尺寸（px）；載入時座標會除以它，正規化為 0–1 比例 */
  size: position,
  nodes: z.record(z.string(), position),
});

export const GraphDefSchema = z.strictObject({
  /** 分層／分區（02 長生者與凡人、03 三界）。collapsible：層頭可點擊收合（03）；沒有則只是標示分區 */
  layers: z
    .array(
      z.strictObject({
        id,
        label: z.string().min(1),
        nodes: z.array(id).min(1),
        collapsible: z.boolean().optional(),
      }),
    )
    .optional(),
  nodes: z.array(GraphNodeSchema).min(2),
  edges: z.array(GraphEdgeSchema).min(1),
  /** 圖例名稱依頁不同（01 衝突、02 試探／誘惑、03 操弄／執念、04 攻擊） */
  legend: z.array(z.strictObject({ kind: EdgeKindSchema, label: z.string().min(1) })).min(1),
  layout: z.strictObject({ desktop: LayoutSchema, flow: LayoutSchema }),
});

export const QuoteSchema = z.strictObject({
  id,
  title: z.string().min(1),
  text: z.string().min(1),
  speaker: id,
  /** 這則引言隸屬的事件 */
  event: z.number().int().min(1),
  /** 從哪個事件起顯示（預設整頁常駐＝1；可改成 7 退回「事件 07 起才顯示」） */
  showFromEvent: z.number().int().min(1).default(1),
});

const BoundaryDebateSchema = z.strictObject({
  title: z.string().min(1),
  leftLabel: z.string().min(1),
  rightLabel: z.string().min(1),
  hint: z.string().min(1),
  stances: z
    .array(
      z.strictObject({
        personId: id,
        label: z.string().min(1),
        position: z.number().min(0).max(100),
        quote: z.string().min(1),
      }),
    )
    .min(2),
  defaultPosition: z.number().min(0).max(100),
  /** 從哪個事件起顯示光譜（預設整頁常駐＝1；設成 5＝讀到事件 05 才出現） */
  showFromEvent: z.number().int().min(1).default(1),
});

const CompareColumnSchema = z.strictObject({
  label: z.string().min(1),
  quote: z.string().min(1),
  source: z.string().min(1),
});

const MirrorSideSchema = z.strictObject({
  personId: id,
  subtitle: z.string().min(1),
  /** key 對應 rows 的 key（身分背景／選擇／動機），兩面欄位位置對齊 */
  cells: z.record(z.string(), z.string().min(1)),
});

export const AxisExtrasSchema = z.strictObject({
  boundary: BoundaryDebateSchema.optional(),
  compare: z.strictObject({ left: CompareColumnSchema, right: CompareColumnSchema }).optional(),
  mirror: z
    .strictObject({
      rows: z.array(z.strictObject({ key: z.string(), label: z.string().min(1) })).min(1),
      sideA: MirrorSideSchema,
      sideB: MirrorSideSchema,
    })
    .optional(),
  postcard: z
    .strictObject({
      frontImage: z.string().min(1),
      frontAlt: z.string().min(1),
      backTitle: z.string().min(1),
      backText: z.string().min(1),
      /** 卡片下方一行說明；留空（yaml 的 caption: 後面不寫）就不顯示 */
      caption: z.string().min(1).nullish(),
    })
    .optional(),
  choice: z
    .strictObject({ lines: z.array(z.string().min(1)), messages: z.array(z.string().min(1)) })
    .optional(),
  cover: z
    .strictObject({ title: z.string().min(1), body: z.string().min(1), button: z.string().min(1) })
    .optional(),
  /** 04：事件序 → 專屬區塊（3 鏡像卡、5 明信片、6 抉擇）；沒列到的事件用 default（none＝什麼都不顯示） */
  eventExtras: z
    .strictObject({
      byEvent: z.record(z.string(), z.enum(['mirror', 'postcard', 'choice', 'none'])),
      default: z.enum(['mirror', 'postcard', 'choice', 'none']),
    })
    .optional(),
});

export const AxisPageSchema = z.strictObject({
  axis: axisNumber,
  number: z.string().regex(/^0[1-4]$/),
  category: z.string().min(1),
  title: z.string().min(1),
  oneLiner: z.string().min(1),
  coreTheme: z.string().min(1),
  /** 事件進程標題，例如「事件進程 · 孩子與國王」 */
  eventsHeading: z.string().min(1),
  events: z.array(AxisEventSchema).min(5).max(8),
  graph: GraphDefSchema,
  quotes: z.array(QuoteSchema).optional(),
  extras: AxisExtrasSchema.default({}),
});

// ── 00 世界觀導讀（pages/00.yaml）────────────────────────────
export const WorldIntroSchema = z.strictObject({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  /** 導言（含行內標記；人名會自動辨識） */
  intro: z.string().min(1),
  coreRelation: z.strictObject({
    heading: z.string().min(1),
    /** 核心關係條：由左到右的人物（role 是這裡顯示的短身分），相鄰兩人之間的連線文字在 links */
    chain: z.array(z.strictObject({ personId: id, role: z.string().min(1) })).min(2),
    links: z.array(z.string().min(1)),
    caption: z.string().min(1),
  }),
  worlds: z.strictObject({
    heading: z.string().min(1),
    items: z.array(z.strictObject({ name: z.string().min(1), text: z.string().min(1) })).min(1),
  }),
  axes: z.strictObject({
    heading: z.string().min(1),
    items: z
      .array(
        z.strictObject({ axis: axisNumber, title: z.string().min(1), subtitle: z.string().min(1) }),
      )
      .length(4),
  }),
});

export type AxisExtrasBoundary = z.infer<typeof BoundaryDebateSchema>;
export type AxisExtrasCompare = NonNullable<z.infer<typeof AxisExtrasSchema>['compare']>;
export type AxisExtrasMirror = NonNullable<z.infer<typeof AxisExtrasSchema>['mirror']>;
export type AxisExtrasPostcard = NonNullable<z.infer<typeof AxisExtrasSchema>['postcard']>;
export type AxisExtrasChoice = NonNullable<z.infer<typeof AxisExtrasSchema>['choice']>;
export type AxisExtrasCover = NonNullable<z.infer<typeof AxisExtrasSchema>['cover']>;
export type AxisExtras = z.infer<typeof AxisExtrasSchema>;
export type WorldIntro = z.infer<typeof WorldIntroSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type PersonRelation = z.infer<typeof PersonRelationSchema>;
export type PeopleFile = z.infer<typeof PeopleFileSchema>;
export type Term = z.infer<typeof TermSchema>;
export type Hint = z.infer<typeof HintSchema>;
export type AxisPage = z.infer<typeof AxisPageSchema>;
export type AxisEvent = z.infer<typeof AxisEventSchema>;
export type GraphDef = z.infer<typeof GraphDefSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type EdgeKind = z.infer<typeof EdgeKindSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type GroupId = z.infer<typeof GroupIdSchema>;
export type TagId = z.infer<typeof TagIdSchema>;
export type WorldId = z.infer<typeof WorldIdSchema>;
