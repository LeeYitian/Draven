/**
 * 手機版（流式版）伏筆註記列「放在哪裡」的唯一決策處（任務 T100）。
 * 依據、已知排版風險與改善路徑：docs/設計決策-手機版伏筆註記列位置.md（本機文件，不進版控）。
 *
 * 設計稿原意是放在「含回收處的那一行下方」，但那一行的位置會隨寬度與字型改變，要靠量測；
 * 這裡刻意偏離：預設策略 `after-punct` 把註記列放在回收片語之後「第一個標點」之後——
 * 標點是文字內容本身的屬性，不需要量測、不會抖動。代價是句子可能被切在行中，產生較短的行。
 * 要換策略只改 HINT_NOTE_PLACEMENT（其餘策略尚未實作，保留名稱供日後替換）。
 */
import type { MarkupNode } from '../../content/markup';
import { NOTE_PUNCTUATION } from '../../content/punctuation';

export type NotePlacement = 'after-punct' | 'after-sentence' | 'after-line' | 'author';
export const HINT_NOTE_PLACEMENT: NotePlacement = 'after-punct';

export type NoteItem = { kind: 'node'; node: MarkupNode } | { kind: 'note'; hintIds: string[] };

/** 某個節點（含巢狀子節點）裡所有伏筆回收處的 id */
function hintsIn(node: MarkupNode): string[] {
  if (node.type === 'text') return [];
  const inner = node.explicit ? node.children.flatMap(hintsIn) : [];
  return node.type === 'h' ? [node.arg, ...inner] : inner;
}

/**
 * 把一段解析好的敘述拆成「節點」與「註記列」交錯的清單。
 * 同一個插入點前面累積的所有回收處放進同一列（並排；放不下由 NoteRow 的 flex-wrap 堆疊）。
 * 片語後面找不到標點時，註記列放在文字最後。
 */
export function resolveNoteInsertionPoint(nodes: readonly MarkupNode[]): NoteItem[] {
  const items: NoteItem[] = [];
  let pending: string[] = [];

  for (const node of nodes) {
    if (node.type !== 'text') {
      items.push({ kind: 'node', node });
      pending.push(...hintsIn(node));
      continue;
    }
    const chars = [...node.text];
    const at = pending.length ? chars.findIndex((ch) => NOTE_PUNCTUATION.includes(ch)) : -1;
    if (at < 0) {
      items.push({ kind: 'node', node });
      continue;
    }
    items.push({ kind: 'node', node: { type: 'text', text: chars.slice(0, at + 1).join('') } });
    items.push({ kind: 'note', hintIds: pending });
    pending = [];
    const rest = chars.slice(at + 1).join('');
    if (rest) items.push({ kind: 'node', node: { type: 'text', text: rest } });
  }
  if (pending.length) items.push({ kind: 'note', hintIds: pending });
  return items;
}
