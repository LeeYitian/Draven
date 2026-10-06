/**
 * 人名／名詞自動辨識（contracts/content-markup.md §2）。純函式，可被 Node 直接執行。
 *  - 最長優先（「魔女艾莉絲」先於「艾莉絲」）；同一人物每次出現都可點
 *  - autoLink:false 的別名不自動辨識（歧義：特使、男人、安…），作者明確標 {p:id|文字} 才連結
 *  - 名詞優先：同一字串既是名詞又是人物別名時當名詞
 *  - 已在標記內的片段不重複辨識；{h:…} 片語內的文字仍會辨識
 */
import type { MarkupNode } from './markup.ts';

export interface AliasEntry {
  text: string;
  kind: 'p' | 't';
  id: string;
}

interface PersonLike {
  id: string;
  name: string;
  aliases: readonly { text: string; autoLink?: boolean | undefined }[];
}
interface TermLike {
  id: string;
  term: string;
  aliases: readonly string[];
  /** false＝不自動辨識（預設 true） */
  autoLink?: boolean | undefined;
}

export function buildAliasEntries(
  people: readonly PersonLike[],
  terms: readonly TermLike[],
): AliasEntry[] {
  const byText = new Map<string, AliasEntry>();

  // 先放名詞（優先），再放人物；已存在的字串不覆蓋（人物之間重複＝先到先得）
  for (const term of terms) {
    if (term.autoLink === false) continue;
    for (const text of [term.term, ...term.aliases]) {
      if (!byText.has(text)) byText.set(text, { text, kind: 't', id: term.id });
    }
  }
  for (const person of people) {
    const texts = [
      person.name,
      ...person.aliases.filter((a) => a.autoLink !== false).map((a) => a.text),
    ];
    for (const text of texts) {
      if (!byText.has(text)) byText.set(text, { text, kind: 'p', id: person.id });
    }
  }
  return [...byText.values()];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 回傳一個函式：把節點樹中的純文字自動加上人名／名詞連結 */
export function createLinkifier(entries: AliasEntry[]): (nodes: MarkupNode[]) => MarkupNode[] {
  if (entries.length === 0) return (nodes) => nodes;

  const lookup = new Map(entries.map((e) => [e.text, e]));
  // 交替式依長度由長到短排列：正規表示式在同一位置會取第一個符合的分支＝最長優先
  const pattern = new RegExp(
    [...lookup.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|'),
    'g',
  );

  const splitText = (text: string): MarkupNode[] => {
    const out: MarkupNode[] = [];
    let last = 0;
    pattern.lastIndex = 0;
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
      const entry = lookup.get(m[0])!;
      out.push({
        type: entry.kind,
        arg: entry.id,
        children: [{ type: 'text', text: m[0] }],
        explicit: true,
        auto: true,
      });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
    return out;
  };

  const walk = (nodes: MarkupNode[]): MarkupNode[] =>
    nodes.flatMap((node): MarkupNode[] => {
      if (node.type === 'text') return splitText(node.text);
      if (node.type === 'h') return [{ ...node, children: walk(node.children) }]; // 伏筆片語內仍辨識人名
      return [node]; // p／t／x：作者已標記，不重複處理
    });

  return walk;
}
