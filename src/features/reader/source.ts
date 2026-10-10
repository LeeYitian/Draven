/**
 * 好讀版的原文解析（純函式，瀏覽器與 Node 腳本共用，所以不用 DOMParser）。
 * 輸入是 Plurk 匯出的 HTML，或 md／純文字；輸出是資料模型，由 React 渲染（不經過 innerHTML）。
 * 只認得 p br i em b strong h1–h3 與表情圖，其餘標籤與所有屬性一律丟棄。
 * 格式約定見 specs/002-reader-mode/contracts/toc-and-source.md。
 */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'em' | 'strong'; c: Inline[] }
  | { t: 'emo'; file: string; alt: string };

export interface Block {
  kind: 'p' | 'h2' | 'h3';
  c: Inline[];
  /** 純文字（不含換行與表情圖），書籤偏移量以它為準 */
  text: string;
  /** 去除所有空白後的純文字，供錨句與書籤比對 */
  norm: string;
  /** 這一段前面有 Plurk 回應分段（空白行） */
  seg: boolean;
}

const CJK = '\\u3000-\\u303f\\u3400-\\u9fff\\uff00-\\uffef';
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** 暫時代表「原始碼換行」的私用區字元 */
const NEWLINE = String.fromCharCode(0xe000);

/** 原始碼中的換行不是排版換行：中文之間直接接起來，其他情況變成一個空白 */
function flatten(s: string): string {
  return decode(s)
    .replace(/\s*[\r\n]+\s*/g, NEWLINE)
    .replace(new RegExp(`(?<=[${CJK}])${NEWLINE}(?=[${CJK}])`, 'g'), '')
    .replace(new RegExp(NEWLINE, 'g'), ' ');
}

export const normalize = (s: string): string => s.replace(/\s+/g, '');

function textOf(c: Inline[]): string {
  let out = '';
  for (const n of c) {
    if (n.t === 'text') out += n.v;
    else if (n.t === 'em' || n.t === 'strong') out += textOf(n.c);
  }
  return out;
}
function hasEmoticon(c: Inline[]): boolean {
  return c.some((n) => n.t === 'emo' || ((n.t === 'em' || n.t === 'strong') && hasEmoticon(n.c)));
}

function makeBlock(kind: Block['kind'], c: Inline[], seg: boolean): Block | null {
  const text = textOf(c);
  if (normalize(text) === '' && !hasEmoticon(c)) return null;
  return { kind, c, text, norm: normalize(text), seg };
}

function trimEdges(c: Inline[]): Inline[] {
  const out = [...c];
  while (out.length && out[out.length - 1]!.t === 'br') out.pop();
  while (out.length && out[0]!.t === 'br') out.shift();
  const first = out[0];
  if (first?.t === 'text') out[0] = { t: 'text', v: first.v.replace(/^\s+/, '') };
  const last = out[out.length - 1];
  if (last?.t === 'text') out[out.length - 1] = { t: 'text', v: last.v.replace(/\s+$/, '') };
  return out.filter((n) => !(n.t === 'text' && n.v === ''));
}

// ── HTML ─────────────────────────────────────────────────────────
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|[^<]+|</g;
const INLINE_TAGS = new Set(['i', 'em', 'b', 'strong']);
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']);

function attr(attrs: string, name: string): string {
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  return decode(m?.[1] ?? m?.[2] ?? '');
}

export function parseHtml(html: string): Block[] {
  const blocks: Block[] = [];
  let kind: Block['kind'] = 'p';
  let root: Inline[] = [];
  const stack: { tag: 'em' | 'strong'; list: Inline[] }[] = [];
  const list = () => (stack.length ? stack[stack.length - 1]!.list : root);
  let pendingBr = 0;
  let segNext = false;
  let segCurrent = false;

  const endParagraph = () => {
    while (stack.length) {
      const f = stack.pop()!;
      list().push({ t: f.tag, c: f.list });
    }
    const block = makeBlock(kind, trimEdges(root), segCurrent);
    if (block) {
      blocks.push(block);
      segCurrent = segNext;
      segNext = false;
    } else if (segNext) {
      segCurrent = true;
      segNext = false;
    }
    root = [];
    pendingBr = 0;
    kind = 'p';
  };
  const flushBr = () => {
    if (pendingBr >= 2) {
      const reopen = stack.map((f) => f.tag);
      endParagraph();
      for (const tag of reopen) stack.push({ tag, list: [] });
    } else if (pendingBr === 1 && trimEdges(root).length) {
      list().push({ t: 'br' });
    }
    pendingBr = 0;
  };

  for (const m of html.matchAll(TOKEN)) {
    const [raw, slash, nameRaw, attrs = ''] = m;
    if (raw.startsWith('<!--')) continue;
    if (nameRaw === undefined) {
      if (raw === '<') {
        flushBr();
        list().push({ t: 'text', v: '<' });
        continue;
      }
      const lead = /^\s*/.exec(raw)![0];
      if (pendingBr >= 2 && /\n[ \t\r]*\n/.test(lead)) segNext = true;
      if (/^\s*$/.test(raw)) continue;
      flushBr();
      list().push({ t: 'text', v: flatten(raw) });
      continue;
    }
    const name = nameRaw.toLowerCase();
    const closing = slash === '/';
    if (name === 'br') {
      if (!closing && trimEdges(root).length + stack.length > 0) pendingBr++;
    } else if (name === 'img') {
      const src = attr(attrs, 'src');
      const cls = attr(attrs, 'class');
      const file = src.split('?')[0]!.split('/').pop() ?? '';
      if (/emoticon/i.test(cls) && /^[\w.-]+\.(png|jpe?g|gif|webp)$/i.test(file)) {
        flushBr();
        list().push({ t: 'emo', file, alt: attr(attrs, 'alt') });
      }
    } else if (INLINE_TAGS.has(name)) {
      if (closing) {
        const f = stack.pop();
        if (f) list().push({ t: f.tag, c: f.list });
      } else {
        flushBr();
        stack.push({ tag: name === 'b' || name === 'strong' ? 'strong' : 'em', list: [] });
      }
    } else if (BLOCK_TAGS.has(name)) {
      endParagraph();
      if (!closing && /^h[1-6]$/.test(name)) kind = name === 'h1' || name === 'h2' ? 'h2' : 'h3';
    }
  }
  endParagraph();
  return blocks;
}

// ── md／純文字 ────────────────────────────────────────────────────
export function parseText(text: string): Block[] {
  const blocks: Block[] = [];
  let lines: string[] = [];
  const flush = () => {
    if (!lines.length) return;
    const c: Inline[] = [];
    lines.forEach((line, i) => {
      if (i > 0) c.push({ t: 'br' });
      c.push({ t: 'text', v: line.trim() });
    });
    const b = makeBlock('p', c, false);
    if (b) blocks.push(b);
    lines = [];
  };
  for (const line of (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/)) {
    const h = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      flush();
      const b = makeBlock(h[1] === '#' ? 'h2' : 'h3', [{ t: 'text', v: h[2]! }], false);
      if (b) blocks.push(b);
    } else if (line.trim() === '') {
      flush();
    } else {
      lines.push(line);
    }
  }
  flush();
  return blocks;
}

/** 依內容判斷格式：含 <p 或 <br 視為 HTML，否則視為 md／純文字 */
export function parseSource(source: string): Block[] {
  return /<(p|br|div|h[1-6])[\s/>]/i.test(source) ? parseHtml(source) : parseText(source);
}
