/**
 * 目錄解析（純函式）。toc.yaml 以「錨句」指向段落；沒有 toc.yaml 時用原文的標題（md 的 #、html 的 h1–h3）。
 * 約定見 specs/002-reader-mode/contracts/toc-and-source.md。
 */
import { normalize, type Block } from './source.ts';

export interface TocItem {
  title: string;
  match: string;
  nth?: number;
  level?: 1 | 2;
}

/** toc.yaml 的內容 → 有效的項目（欄位不合的項目略過；完整檢查在 content:check） */
export function readTocItems(raw: unknown): TocItem[] {
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: unknown): TocItem[] => {
    const v = item as Partial<TocItem> | null;
    if (!v || typeof v.title !== 'string' || typeof v.match !== 'string') return [];
    return [
      {
        title: v.title,
        match: v.match,
        nth: typeof v.nth === 'number' && v.nth >= 1 ? Math.floor(v.nth) : undefined,
        level: v.level === 2 ? 2 : 1,
      },
    ];
  });
}

export interface TocEntry {
  title: string;
  level: 1 | 2;
  /** 段落索引；找不到錨句時為 null（該項停用） */
  index: number | null;
}

export interface TocProblem {
  severity: 'error' | 'warning';
  message: string;
}

export function resolveToc(
  blocks: readonly Block[],
  items: readonly TocItem[] | undefined,
): { entries: TocEntry[]; problems: TocProblem[] } {
  const problems: TocProblem[] = [];
  if (!items || items.length === 0) {
    const entries = blocks.flatMap((b, index): TocEntry[] =>
      b.kind === 'p' ? [] : [{ title: b.text, level: b.kind === 'h2' ? 1 : 2, index }],
    );
    return { entries, problems };
  }

  const entries: TocEntry[] = [];
  let last = -1;
  for (const item of items) {
    const key = normalize(item.match);
    const hits = key ? blocks.flatMap((b, i) => (b.norm.includes(key) ? [i] : [])) : [];
    const nth = item.nth ?? 1;
    const index = hits[nth - 1] ?? null;
    if (index === null) {
      problems.push({
        severity: 'error',
        message: `目錄「${item.title}」：找不到錨句「${item.match}」${nth > 1 ? `的第 ${nth} 處` : ''}`,
      });
    } else {
      if (item.nth === undefined && hits.length > 1) {
        problems.push({
          severity: 'warning',
          message: `目錄「${item.title}」：錨句出現在 ${hits.length} 個段落，已取第 1 個；要換請加 nth`,
        });
      }
      if (index < last) {
        problems.push({
          severity: 'warning',
          message: `目錄「${item.title}」：位置在上一項之前，請確認順序`,
        });
      }
      last = Math.max(last, index);
    }
    entries.push({ title: item.title, level: item.level ?? 1, index });
  }
  return { entries, problems };
}

/** 目前捲動到的段落屬於哪個目錄項目（回傳 entries 的索引；還沒到第一項回傳 -1） */
export function currentEntry(entries: readonly TocEntry[], blockIndex: number): number {
  let found = -1;
  entries.forEach((e, i) => {
    if (e.index !== null && e.index <= blockIndex) found = i;
  });
  return found;
}
