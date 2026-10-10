/**
 * 閱讀書籤（純函式）。以「段落」為定位單位；另存一小段原文（quote），
 * 讓 full.html 更新後仍能找回位置（約定見 specs/002-reader-mode/spec.md FR-006）。
 */
import { normalize, type Block } from './source.ts';

export interface Bookmark {
  index: number;
  quote: string;
  total: number;
  savedAt: number;
}

const QUOTE_LENGTH = 40;
const MIN_QUOTE = 8;

/** offset：反白起點在該段純文字（Block.text）中的字元位置 */
export function createBookmark(
  blocks: readonly Block[],
  index: number,
  offset: number,
  now = Date.now(),
): Bookmark | null {
  const block = blocks[index];
  if (!block) return null;
  const from = Math.max(0, offset);
  let quote = normalize(block.text.slice(from, from + QUOTE_LENGTH * 2)).slice(0, QUOTE_LENGTH);
  if (quote.length < MIN_QUOTE) quote = block.norm.slice(0, QUOTE_LENGTH);
  return { index, quote, total: blocks.length, savedAt: now };
}

/** 回傳書籤目前對應的段落索引；找不到回傳 null */
export function locateBookmark(blocks: readonly Block[], bookmark: Bookmark): number | null {
  if (bookmark.quote) {
    let best: number | null = null;
    blocks.forEach((b, i) => {
      if (!b.norm.includes(bookmark.quote)) return;
      if (best === null || Math.abs(i - bookmark.index) < Math.abs(best - bookmark.index)) best = i;
    });
    if (best !== null) return best;
  }
  if (blocks.length === bookmark.total && bookmark.index >= 0 && bookmark.index < blocks.length) {
    return bookmark.index;
  }
  return null;
}

export function isBookmark(value: unknown): value is Bookmark {
  const v = value as Partial<Bookmark> | null;
  return (
    !!v &&
    typeof v.index === 'number' &&
    typeof v.quote === 'string' &&
    typeof v.total === 'number' &&
    typeof v.savedAt === 'number'
  );
}
