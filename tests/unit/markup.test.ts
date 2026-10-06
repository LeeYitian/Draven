import { describe, expect, it } from 'vitest';
import { MarkupError, collectRefs, parseMarkup, plainText } from '../../src/content/markup.ts';

describe('parseMarkup：基本語法', () => {
  it('純文字', () => {
    expect(parseMarkup('德雷文推動共榮。')).toEqual([{ type: 'text', text: '德雷文推動共榮。' }]);
  });

  it('{p:id}：人名連結，沒有顯示文字時 children 為空', () => {
    expect(parseMarkup('由{p:fane}擔保')).toEqual([
      { type: 'text', text: '由' },
      { type: 'p', arg: 'fane', children: [], explicit: false },
      { type: 'text', text: '擔保' },
    ]);
  });

  it('{p:id|文字}：指定顯示文字（化名、歧義別名）', () => {
    const nodes = parseMarkup('化名{p:elian|安}');
    expect(nodes[1]).toEqual({
      type: 'p',
      arg: 'elian',
      children: [{ type: 'text', text: '安' }],
      explicit: true,
    });
  });

  it('{t:} 名詞、{x:} 交叉連結、{h:} 伏筆回收處', () => {
    const nodes = parseMarkup('{t:morning-star}與{x:spectrum|見下方 ↓}與{h:gift|馬蹄鐵}');
    expect(nodes.map((n) => n.type)).toEqual(['t', 'text', 'x', 'text', 'h']);
    expect(plainText(nodes)).toBe('morning-star與見下方 ↓與馬蹄鐵');
  });
});

describe('parseMarkup：巢狀', () => {
  it('伏筆片語內含人名連結', () => {
    const nodes = parseMarkup('{h:gift|{p:fane}用馬蹄鐵敲出火}');
    expect(nodes).toHaveLength(1);
    const h = nodes[0]!;
    expect(h.type).toBe('h');
    if (h.type !== 'text') {
      expect(h.children.map((c) => c.type)).toEqual(['p', 'text']);
    }
  });

  it('巢狀超過 2 層時報錯', () => {
    expect(() => parseMarkup('{h:a|{p:b|{t:c|x}}}')).toThrow(MarkupError);
  });
});

describe('parseMarkup：逸出與錯誤定位', () => {
  it('\\{ 與 \\} 是純文字的大括號', () => {
    expect(plainText(parseMarkup('集合 \\{a, b\\}'))).toBe('集合 {a, b}');
  });

  it('未閉合的標記：回報起始位置', () => {
    try {
      parseMarkup('前面{h:gift|沒有結尾');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MarkupError);
      expect((error as MarkupError).index).toBe(2);
      expect((error as MarkupError).message).toContain('未閉合');
    }
  });

  it('未知的標記類型', () => {
    expect(() => parseMarkup('{z:abc|x}')).toThrow(/未知的標記類型 "z"/);
  });

  it('缺少參數、缺少冒號', () => {
    expect(() => parseMarkup('{p:}')).toThrow(/缺少參數/);
    expect(() => parseMarkup('{p}')).toThrow(/缺少冒號|未知/);
  });

  it('落單的 }', () => {
    expect(() => parseMarkup('多一個}')).toThrow(/未配對的 \}/);
  });
});

describe('collectRefs', () => {
  it('列出所有標記的類型、參數與巢狀路徑，供內容驗證使用', () => {
    const refs = collectRefs(parseMarkup('{p:a}與{h:gift|{p:b}用{t:c}}'));
    expect(refs.map((r) => `${r.type}:${r.arg}`)).toEqual(['p:a', 'h:gift', 'p:b', 't:c']);
    expect(refs.find((r) => r.arg === 'b')!.depth).toBe(2);
    expect(refs.find((r) => r.arg === 'gift')!.depth).toBe(1);
  });
});
