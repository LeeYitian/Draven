import { describe, expect, it } from 'vitest';
import { buildAliasEntries, createLinkifier } from '../../src/content/aliases.ts';
import { parseMarkup, plainText, type MarkupNode } from '../../src/content/markup.ts';

const people = [
  {
    id: 'dravin',
    name: '德雷文',
    aliases: [{ text: '陛下' }, { text: '統一之杖', autoLink: false }],
  },
  { id: 'elian', name: '艾利安', aliases: [{ text: '安', autoLink: false }, { text: '小主人' }] },
  {
    id: 'elis',
    name: '艾莉絲',
    aliases: [{ text: '魔女艾莉絲' }, { text: '艾利絲', typo: true }],
  },
  { id: 'fane', name: '法恩', aliases: [{ text: '特使', autoLink: false }] },
];
const terms = [{ id: 'morning-star', term: '東方晨星', aliases: [] as string[] }];

const link = createLinkifier(buildAliasEntries(people, terms));

/** 把節點攤平成易讀的字串，方便斷言：[p:id:顯示]、[t:id:顯示]、純文字 */
function show(nodes: MarkupNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.text;
      const inner = n.explicit ? show(n.children) : '';
      return `[${n.type}${n.auto ? '*' : ''}:${n.arg}:${inner}]`;
    })
    .join('');
}

describe('自動辨識人名與名詞', () => {
  it('辨識姓名，顯示原文', () => {
    expect(show(link(parseMarkup('德雷文強迫貴族')))).toBe('[p*:dravin:德雷文]強迫貴族');
  });

  it('最長優先：「魔女艾莉絲」整段連到艾莉絲，而不是只連「艾莉絲」', () => {
    expect(show(link(parseMarkup('魔女艾莉絲來了')))).toBe('[p*:elis:魔女艾莉絲]來了');
  });

  it('同一人物在同一段落每次出現都可點', () => {
    const result = show(link(parseMarkup('法恩對布倫說，法恩願意')));
    expect(result.match(/\[p\*:fane:法恩\]/g)).toHaveLength(2);
  });

  it('autoLink:false 的別名不會自動連結（歧義的「特使」「安」「統一之杖」）', () => {
    expect(show(link(parseMarkup('特使與安的統一之杖')))).toBe('特使與安的統一之杖');
  });

  it('autoLink:false 的別名在作者明確標記時仍可連結', () => {
    const nodes = link(parseMarkup('化名{p:elian|安}'));
    expect(show(nodes)).toBe('化名[p:elian:安]');
  });

  it('名詞優先：同一字串既是名詞又是別名時當名詞', () => {
    const conflict = createLinkifier(
      buildAliasEntries(
        [{ id: 'dravin', name: '德雷文', aliases: [{ text: '東方晨星' }] }],
        [{ id: 'morning-star', term: '東方晨星', aliases: [] }],
      ),
    );
    expect(show(conflict(parseMarkup('以東方晨星之名')))).toBe('以[t*:morning-star:東方晨星]之名');
  });

  it('錯字別名仍連結並顯示原文（不自動修正）', () => {
    expect(show(link(parseMarkup('艾利絲說')))).toBe('[p*:elis:艾利絲]說');
  });
});

describe('不重複處理已標記的片段', () => {
  it('作者手寫的 {p:} 內的文字不再被自動辨識', () => {
    expect(show(link(parseMarkup('{p:dravin|陛下}')))).toBe('[p:dravin:陛下]');
  });

  it('{h:} 伏筆片語內的人名仍會被辨識（片語本身保留）', () => {
    const nodes = link(parseMarkup('{h:gift|法恩用馬蹄鐵}'));
    expect(nodes).toHaveLength(1);
    expect(show(nodes)).toBe('[h:gift:[p*:fane:法恩]用馬蹄鐵]');
  });

  it('不改變可見的純文字', () => {
    const source = '魔女艾莉絲與陛下談到東方晨星，法恩說{p:elian|安}也在。';
    expect(plainText(link(parseMarkup(source)))).toBe(plainText(parseMarkup(source)));
  });
});

describe('名詞的 autoLink 開關', () => {
  it('autoLink:false 的名詞不自動辨識，人物別名因此不被蓋掉（盤蛇神、地龍）', () => {
    const linker = createLinkifier(
      buildAliasEntries(
        [{ id: 'snake-god', name: '盤蛇神', aliases: [] }],
        [{ id: 'snake-god-term', term: '盤蛇神', aliases: [], autoLink: false }],
      ),
    );
    expect(show(linker(parseMarkup('盤蛇神來了')))).toBe('[p*:snake-god:盤蛇神]來了');
  });

  it('作者明確標 {t:id|文字} 時仍可連結', () => {
    const linker = createLinkifier(
      buildAliasEntries([], [{ id: 'world', term: '人間', aliases: [], autoLink: false }]),
    );
    expect(show(linker(parseMarkup('{t:world|人間}與人間')))).toBe('[t:world:人間]與人間');
  });
});

describe('邊界情況', () => {
  it('沒有任何別名時原樣回傳', () => {
    const none = createLinkifier([]);
    const nodes = parseMarkup('德雷文');
    expect(none(nodes)).toEqual(nodes);
  });

  it('別名含正規表示式特殊字元也安全', () => {
    const odd = createLinkifier(buildAliasEntries([{ id: 'x', name: 'A.B(C)', aliases: [] }], []));
    expect(show(odd(parseMarkup('見A.B(C)與AxB(C)')))).toBe('見[p*:x:A.B(C)]與AxB(C)');
  });

  it('buildAliasEntries：人物之間重複的別名只保留第一個', () => {
    const entries = buildAliasEntries(
      [
        { id: 'a', name: '甲', aliases: [{ text: '共用' }] },
        { id: 'b', name: '乙', aliases: [{ text: '共用' }] },
      ],
      [],
    );
    expect(entries.filter((e) => e.text === '共用')).toEqual([
      { text: '共用', kind: 'p', id: 'a' },
    ]);
  });
});
