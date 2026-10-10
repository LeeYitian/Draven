import { describe, expect, it } from 'vitest';
import { createBookmark, locateBookmark } from '../../src/features/reader/bookmark';
import { parseSource } from '../../src/features/reader/source';
import { currentEntry, resolveToc } from '../../src/features/reader/toc';

const paragraphs = [
  '序幕的第一段文字，很長很長很長。',
  '第一章開始了，天空很藍。',
  '中間的一段話，沒有什麼特別。',
  '第二章開始了，天空很藍。',
];
const html = (list: string[]) => `<p>${list.join('<br /><br />')}</p>`;
const blocks = parseSource(html(paragraphs));

describe('resolveToc', () => {
  it('以錨句與 nth 找段落', () => {
    const { entries, problems } = resolveToc(blocks, [
      { title: '序', match: '序幕的第一段' },
      { title: '二', match: '天空 很藍', nth: 2 },
    ]);
    expect(entries.map((e) => e.index)).toEqual([0, 3]);
    expect(problems).toEqual([]);
  });

  it('找不到是錯誤、重複未指定 nth 是警告、順序倒置是警告', () => {
    const { entries, problems } = resolveToc(blocks, [
      { title: 'A', match: '天空很藍' },
      { title: 'B', match: '序幕的第一段' },
      { title: 'C', match: '不存在的句子' },
    ]);
    expect(entries.map((e) => e.index)).toEqual([1, 0, null]);
    expect(problems.map((p) => p.severity).sort()).toEqual(['error', 'warning', 'warning']);
  });

  it('沒有 toc.json 時使用標題', () => {
    const b = parseSource('# 一\n\n文\n\n## 二\n\n文');
    expect(resolveToc(b, undefined).entries).toEqual([
      { title: '一', level: 1, index: 0 },
      { title: '二', level: 2, index: 2 },
    ]);
  });

  it('currentEntry', () => {
    const entries = [
      { title: 'a', level: 1 as const, index: 1 },
      { title: 'b', level: 1 as const, index: 3 },
    ];
    expect([0, 1, 2, 3].map((i) => currentEntry(entries, i))).toEqual([-1, 0, 0, 1]);
  });
});

describe('bookmark', () => {
  it('建立後可還原；來源更新（插入段落）後以 quote 找回', () => {
    const bm = createBookmark(blocks, 2, 0)!;
    expect(locateBookmark(blocks, bm)).toBe(2);
    const updated = parseSource(html(['新增的開頭。', ...paragraphs]));
    expect(locateBookmark(updated, bm)).toBe(3);
  });

  it('quote 不在時，段數相同才用 index，否則放棄', () => {
    const bm = { index: 1, quote: '已被刪掉的句子', total: blocks.length, savedAt: 0 };
    expect(locateBookmark(blocks, bm)).toBe(1);
    expect(locateBookmark(blocks.slice(0, 2), bm)).toBeNull();
  });
});
