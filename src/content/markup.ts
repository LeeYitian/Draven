/**
 * 行內標記解析器（contracts/content-markup.md §1）。純函式，無 React／DOM 相依。
 * 注意：本檔會被 Node 直接執行（scripts/content-check.ts），所以只用「可被型別剝除」的 TypeScript 語法，
 * 且 import 一律寫副檔名（.ts）。
 *
 *   {p:id}  {p:id|顯示文字}   人名（點擊開 Popover）
 *   {t:id}  {t:id|顯示文字}   名詞
 *   {h:hint-id|片語}          伏筆回收處（雙底線；框格依其位置放置）
 *   \{  \}                    純文字的大括號
 * 可巢狀（最多 2 層，例如 {h:gift|{p:fane}用馬蹄鐵}）。
 */
export type MarkerType = 'p' | 't' | 'h';

export type MarkupNode =
  | { type: 'text'; text: string; auto?: undefined }
  | {
      type: MarkerType;
      arg: string;
      children: MarkupNode[];
      /** 作者有寫 | 顯示文字（false 時由渲染端取該人物／名詞的預設名稱） */
      explicit: boolean;
      /** 由別名表自動辨識產生（非作者手寫標記） */
      auto?: boolean;
    };

export class MarkupError extends Error {
  index: number;
  constructor(message: string, index: number) {
    super(`${message}（第 ${index + 1} 字）`);
    this.name = 'MarkupError';
    this.index = index;
  }
}

const MARKER_TYPES = new Set<string>(['p', 't', 'h']);
const MAX_DEPTH = 2;

export function parseMarkup(input: string): MarkupNode[] {
  let i = 0;

  function parseSequence(depth: number, closing: boolean): MarkupNode[] {
    const nodes: MarkupNode[] = [];
    let buffer = '';
    const flush = () => {
      if (buffer) nodes.push({ type: 'text', text: buffer });
      buffer = '';
    };

    while (i < input.length) {
      const ch = input[i]!;
      if (ch === '\\' && (input[i + 1] === '{' || input[i + 1] === '}')) {
        buffer += input[i + 1];
        i += 2;
      } else if (ch === '{') {
        flush();
        nodes.push(parseMarker(depth + 1));
      } else if (ch === '}') {
        if (!closing) throw new MarkupError('未配對的 }（若要顯示大括號請寫 \\}）', i);
        flush();
        return nodes;
      } else {
        buffer += ch;
        i++;
      }
    }
    flush();
    return nodes;
  }

  function parseMarker(depth: number): MarkupNode {
    const start = i;
    if (depth > MAX_DEPTH) throw new MarkupError(`標記巢狀超過 ${MAX_DEPTH} 層`, start);
    i++; // 跳過 {

    // 類型：直到 ':'
    let type = '';
    while (
      i < input.length &&
      input[i] !== ':' &&
      input[i] !== '}' &&
      input[i] !== '|' &&
      input[i] !== '{'
    ) {
      type += input[i];
      i++;
    }
    if (input[i] !== ':') {
      if (type && !MARKER_TYPES.has(type)) throw new MarkupError(`未知的標記類型 "${type}"`, start);
      throw new MarkupError('標記缺少冒號（格式 {類型:參數|文字}）', start);
    }
    if (!MARKER_TYPES.has(type)) throw new MarkupError(`未知的標記類型 "${type}"`, start);
    i++; // 跳過 :

    // 參數：直到 '|' 或 '}'
    let arg = '';
    while (i < input.length && input[i] !== '|' && input[i] !== '}' && input[i] !== '{') {
      arg += input[i];
      i++;
    }
    arg = arg.trim();
    if (!arg) throw new MarkupError(`{${type}:…} 缺少參數`, start);

    if (input[i] === '|') {
      i++;
      const children = parseSequence(depth, true);
      if (input[i] !== '}') throw new MarkupError(`未閉合的 {${type}:${arg}|…}`, start);
      i++;
      return { type: type as MarkerType, arg, children, explicit: true };
    }
    if (input[i] === '}') {
      i++;
      return { type: type as MarkerType, arg, children: [], explicit: false };
    }
    throw new MarkupError(`未閉合的 {${type}:${arg}`, start);
  }

  return parseSequence(0, false);
}

/** 去掉所有標記後的純文字（{p:id} 無顯示文字時以 arg 代替，僅供驗證與測試） */
export function plainText(nodes: MarkupNode[]): string {
  return nodes
    .map((n) => (n.type === 'text' ? n.text : n.explicit ? plainText(n.children) : n.arg))
    .join('');
}

export interface MarkerRef {
  type: MarkerType;
  arg: string;
  /** 1＝最外層標記 */
  depth: number;
  /** 該標記在 plainText 中涵蓋的範圍（供檢查伏筆片語重疊） */
  start: number;
  end: number;
}

/** 依出現順序（先外後內）列出所有標記，供內容驗證使用 */
export function collectRefs(nodes: MarkupNode[]): MarkerRef[] {
  const refs: MarkerRef[] = [];
  let offset = 0;
  const walk = (list: MarkupNode[], depth: number) => {
    for (const node of list) {
      if (node.type === 'text') {
        offset += node.text.length;
        continue;
      }
      const start = offset;
      const index = refs.push({ type: node.type, arg: node.arg, depth, start, end: start }) - 1;
      if (node.explicit) walk(node.children, depth + 1);
      else offset += node.arg.length;
      refs[index]!.end = offset;
    }
  };
  walk(nodes, 1);
  return refs;
}
