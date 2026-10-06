/**
 * 內容載入器：讀取 src/content/** 的 YAML，用 zod 驗證，並提供查詢函式與 t()。
 * 畫面上所有文字都從這裡取得（憲章 I）。結構錯誤在載入時就丟出（正式建置前 content:check 已擋下）。
 */
import { buildAliasEntries, createLinkifier } from './aliases.ts';
import { parseMarkup, type MarkupNode } from './markup.ts';
import {
  AxisPageSchema,
  GlossaryFileSchema,
  HintsFileSchema,
  PeopleFileSchema,
  UiSchema,
  type AxisPage,
  type Hint,
  type Person,
  type PersonRelation,
  type Term,
  type UiTree,
} from './schema.ts';
import glossaryRaw from './glossary.yaml';
import hintsRaw from './hints.yaml';
import peopleRaw from './people.yaml';
import uiRaw from './ui.yaml';

export type { AxisPage, Hint, MarkupNode, Person, PersonRelation, Term };

const peopleFile = PeopleFileSchema.parse(peopleRaw);
export const people: readonly Person[] = peopleFile.people;
/** 跨主軸、貫穿故事的人物關係（人物中心視角用） */
export const personRelations: readonly PersonRelation[] = peopleFile.relations;
export const terms: readonly Term[] = GlossaryFileSchema.parse(glossaryRaw).terms;
export const hints: readonly Hint[] = HintsFileSchema.parse(hintsRaw).hints;
const ui: UiTree = UiSchema.parse(uiRaw);

const peopleById = new Map(people.map((p) => [p.id, p]));
const termsById = new Map(terms.map((t) => [t.id, t]));
const hintsById = new Map(hints.map((h) => [h.id, h]));

export const getPerson = (id: string): Person | undefined => peopleById.get(id);
export const getTerm = (id: string): Term | undefined => termsById.get(id);
export const getHint = (id: string): Hint | undefined => hintsById.get(id);

// ── 主軸頁（pages/01–04.yaml；尚未建立的頁回傳 undefined）────────────────
const pageModules = import.meta.glob('./pages/0[1-4].yaml', { eager: true, import: 'default' });
const pages = new Map<number, AxisPage>();
for (const [path, raw] of Object.entries(pageModules)) {
  const page = AxisPageSchema.parse(raw);
  const expected = Number(/0([1-4])\.yaml$/.exec(path)![1]);
  if (page.axis !== expected) throw new Error(`${path}: axis（${page.axis}）與檔名不一致`);
  pages.set(page.axis, page);
}
export const getAxisPage = (axis: number): AxisPage | undefined => pages.get(axis);

// ── 介面文案 t() ──────────────────────────────────────────────
function lookup(key: string): string | undefined {
  let node: string | UiTree | undefined = ui;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export type TParams = Record<string, string | number>;

/** 取介面文案；{name} 形式的參數會被替換。key 不存在時回傳 key 本身並在開發模式警告 */
export function t(key: string, params?: TParams): string {
  const template = lookup(key);
  if (template === undefined) {
    if (import.meta.env.DEV) console.error(`[content] 找不到 ui key：${key}`);
    return key;
  }
  return params
    ? template.replace(/\{(\w+)\}/g, (m, name: string) =>
        name in params ? String(params[name]) : m,
      )
    : template;
}

// ── 行內標記 → 節點（含人名／名詞自動辨識），結果快取 ─────────────────────
const linkify = createLinkifier(buildAliasEntries(people, terms));
const richCache = new Map<string, MarkupNode[]>();

/** 解析一段含行內標記的文字，並自動辨識人名與名詞 */
export function parseRich(text: string): MarkupNode[] {
  let nodes = richCache.get(text);
  if (!nodes) {
    nodes = linkify(parseMarkup(text));
    richCache.set(text, nodes);
  }
  return nodes;
}
