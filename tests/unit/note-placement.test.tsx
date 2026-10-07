import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getAxisPage, parseRich } from '../../src/content';
import { parseMarkup } from '../../src/content/markup';
import { NoteRow } from '../../src/features/hints/NoteRow';
import {
  HINT_NOTE_PLACEMENT,
  resolveNoteInsertionPoint,
  type NoteItem,
} from '../../src/features/hints/note-placement';

const textOf = (items: NoteItem[]) =>
  items.map((i) => (i.kind === 'note' ? `[${i.hintIds.join('+')}]` : i.node.type === 'text' ? i.node.text : `<${i.node.type}>`));

describe('resolveNoteInsertionPoint（預設策略 after-punct）', () => {
  it('預設策略是「回收片語之後第一個標點之後」', () => {
    expect(HINT_NOTE_PLACEMENT).toBe('after-punct');
  });

  it('註記列插在片語後第一個標點之後；同一個標點前的多個回收處放同一列', () => {
    const nodes = parseMarkup('A，{h:one|甲}乙、丙{h:two|丁}戊；己。');
    const items = resolveNoteInsertionPoint(nodes);
    expect(textOf(items)).toEqual(['A，', '<h>', '乙、丙', '<h>', '戊；', '[one+two]', '己。']);
  });

  it('03 事件 06 的真實文字：第一列 1 個（受諾爾之託…），第二列 2 個（馬蹄鐵＋盤蛇的氣味）並排', () => {
    const event = getAxisPage(3)!.events[5]!;
    const items = resolveNoteInsertionPoint(parseRich(event.text));
    const notes = items.filter((i): i is Extract<NoteItem, { kind: 'note' }> => i.kind === 'note');
    expect(notes.map((n) => n.hintIds)).toEqual([['useful-to-witch'], ['forgotten-gift', 'spirit-scent']]);
    // 註記列前一段文字以標點結尾
    items.forEach((item, i) => {
      if (item.kind !== 'note') return;
      const before = items[i - 1]!;
      expect(before.kind === 'node' && before.node.type === 'text' && /[，；。！？]$/.test(before.node.text)).toBe(true);
    });
  });

  it('片語後面沒有標點：註記列放在文字最後', () => {
    const items = resolveNoteInsertionPoint(parseMarkup('前面{h:one|片語}後面沒有標點'));
    expect(textOf(items).at(-1)).toBe('[one]');
  });

  it('頓號與冒號不算插入點', () => {
    const items = resolveNoteInsertionPoint(parseMarkup('{h:one|片語}、甲：乙，丙'));
    expect(textOf(items)).toEqual(['<h>', '、甲：乙，', '[one]', '丙']);
  });

  it('伏筆片語包在別的標記裡（巢狀）也能找到', () => {
    const items = resolveNoteInsertionPoint(parseMarkup('{p:fane|{h:one|法恩}}說，好'));
    expect(textOf(items)).toEqual(['<p>', '說，', '[one]', '好']);
  });

  it('沒有伏筆的事件：原樣回傳，沒有註記列', () => {
    const items = resolveNoteInsertionPoint(parseRich(getAxisPage(1)!.events[0]!.text));
    expect(items.some((i) => i.kind === 'note')).toBe(false);
  });

  it('不改變文字內容：把所有文字節點接起來等於原文（拆分不遺漏、不重複）', () => {
    const text = '甲{h:one|乙}，丙{h:two|丁}戊。己';
    const items = resolveNoteInsertionPoint(parseMarkup(text));
    const joined = items
      .filter((i) => i.kind === 'node')
      .map((i) => (i.kind === 'node' && i.node.type === 'text' ? i.node.text : i.kind === 'node' && i.node.type === 'h' ? i.node.children.map((c) => (c.type === 'text' ? c.text : '')).join('') : ''))
      .join('');
    expect(joined).toBe('甲乙，丙丁戊。己');
  });
});

describe('NoteRow：必須是 display:block（不可 inline-block）', () => {
  it('註記列以 display:block 渲染，且寬度不靠 inline-block＋width:100%（兩端對齊會把上一行拉開）', () => {
    const { container } = render(<NoteRow hintIds={['forgotten-gift']} />);
    const row = container.querySelector<HTMLElement>('[data-note-row]')!;
    expect(row.style.display).toBe('block');
    expect(row.style.display).not.toBe('inline-block');
    expect(row.style.minHeight).toBe('50px');
    expect(row.tagName).toBe('SPAN'); // p 裡不能放 div
  });

  it('列內為每個回收處一個框格；同一列多個時用 flex-wrap（並排、放不下就堆疊）', () => {
    const { container } = render(<NoteRow hintIds={['forgotten-gift', 'spirit-scent']} />);
    expect(container.querySelectorAll('[data-hint-slot]')).toHaveLength(2);
    expect(container.querySelector('.flex-wrap')).not.toBeNull();
  });
});
