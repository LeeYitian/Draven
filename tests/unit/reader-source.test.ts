import { describe, expect, it } from 'vitest';
import { parseSource } from '../../src/features/reader/source';

describe('parseSource（HTML）', () => {
  it('連續兩個 br 分段、單一 br 是段內換行', () => {
    const b = parseSource(
      '<p>甲一<br />甲二<br /><br class="double-br" />乙<br><br class="double-br"></p>',
    );
    expect(b.map((x) => x.text)).toEqual(['甲一甲二', '乙']);
    expect(b[0]!.c.map((n) => n.t)).toEqual(['text', 'br', 'text']);
  });

  it('空白行讓下一段帶 seg 標記', () => {
    const b = parseSource(
      '<p>甲<br /><br class="double-br" />\n\n乙<br /><br class="double-br" />丙</p>',
    );
    expect(b.map((x) => x.seg)).toEqual([false, true, false]);
  });

  it('保留斜體與表情圖，丟棄 script 與屬性', () => {
    const b = parseSource(
      '<p>你<i>好</i><img src="https://s.plurk.com/emoticons/random/abc123.png" class="emoticon" alt="(coin)" onerror="x()"><script>alert(1)</script></p>',
    );
    expect(b).toHaveLength(1);
    expect(b[0]!.c.map((n) => n.t)).toEqual(['text', 'em', 'emo', 'text']);
    expect(b[0]!.c[2]).toEqual({ t: 'emo', file: 'abc123.png', alt: '(coin)' });
  });

  it('原始碼換行：中文之間直接接起來', () => {
    const b = parseSource('<p>他說了\n一句話</p>');
    expect(b[0]!.text).toBe('他說了一句話');
  });

  it('解碼實體，h2 成為標題', () => {
    const b = parseSource('<h2>第一章 &amp; 序</h2><p>內文&lt;3</p>');
    expect(b.map((x) => [x.kind, x.text])).toEqual([
      ['h2', '第一章 & 序'],
      ['p', '內文<3'],
    ]);
  });

  it('只有表情圖的段落也保留', () => {
    const b = parseSource(
      '<p>甲<br /><br />\n<img src="a/b/c.png" class="emoticon" alt="x"><br /><br />乙</p>',
    );
    expect(b).toHaveLength(3);
  });
});

describe('parseSource（md／純文字）', () => {
  it('空白行分段、# 為標題、單一換行為段內換行', () => {
    const b = parseSource('# 第一章\n\n甲\n乙\n\n## 小節\n\n丙');
    expect(b.map((x) => [x.kind, x.text])).toEqual([
      ['h2', '第一章'],
      ['p', '甲乙'],
      ['h3', '小節'],
      ['p', '丙'],
    ]);
  });
});
