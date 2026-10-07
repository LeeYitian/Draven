import { describe, expect, it, vi } from 'vitest';
import {
  getAxisPage,
  getHint,
  getPerson,
  getTerm,
  hints,
  parseRich,
  people,
  t,
  terms,
} from '../../src/content/index.ts';
import { plainText } from '../../src/content/markup.ts';

describe('content loader', () => {
  it('載入 15 位人物、17 個名詞、12 條伏筆（通過 zod 驗證）', () => {
    expect(people).toHaveLength(15);
    expect(terms).toHaveLength(17);
    expect(hints).toHaveLength(12);
  });

  it('查詢函式', () => {
    expect(getPerson('dravin')?.name).toBe('德雷文');
    expect(getTerm('morning-star')?.term).toBe('東方晨星');
    expect(getHint('forgotten-gift')?.keyword).toBe('忘了送的禮物');
    expect(getPerson('nope')).toBeUndefined();
  });

  it('伏筆獲得數量：01→1、02→8、03→2、04→1（共 12）', () => {
    const count = (axis: number) => hints.filter((h) => h.acquire === axis).length;
    expect([1, 2, 3, 4].map(count)).toEqual([1, 8, 2, 1]);
  });

  it('已建立的主軸頁可取得；尚未建立的回傳 undefined（01–04 都已建立）', () => {
    expect(getAxisPage(1)?.title).toBe('統一之杖：荊棘之王德雷文');
    expect(getAxisPage(2)?.title).toBe('魔女集會與時間考驗');
    expect(getAxisPage(4)?.title).toBe('母愛與地龍契約');
  });
});

describe('t()', () => {
  it('取得巢狀 key 的文字', () => {
    expect(t('site.title')).toBe('德雷文');
    expect(t('people.sort.group')).toBe('依群體');
  });

  it('替換 {參數}（數字也可）', () => {
    expect(t('hints.count', { n: 3 })).toBe('已獲得 3 個伏筆');
    expect(t('hints.acquiredOne', { keyword: '神語' })).toBe('獲得新伏筆：神語');
  });

  it('缺少的參數保留原樣，不丟錯', () => {
    expect(t('hints.count')).toBe('已獲得 {n} 個伏筆');
    expect(t('hints.countSolved', { n: 2 })).toBe('已獲得 2 個伏筆 · 已解開 {solved}');
  });

  it('key 不存在：回傳 key 本身並在開發模式印出警告', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(t('no.such.key')).toBe('no.such.key');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('指到中間節點（不是字串）視為不存在', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(t('people.sort')).toBe('people.sort');
    spy.mockRestore();
  });
});

describe('parseRich', () => {
  it('自動辨識人名與名詞，且不改變可見文字', () => {
    const source = '德雷文以東方晨星之名，請法恩幫忙。';
    const nodes = parseRich(source);
    expect(nodes.filter((n) => n.type === 'p').map((n) => (n.type === 'p' ? n.arg : ''))).toEqual([
      'dravin',
      'fane',
    ]);
    expect(nodes.some((n) => n.type === 't')).toBe(true);
    expect(plainText(nodes)).toBe(source);
  });

  it('「盤蛇神」在後面各頁走人名（名詞 autoLink:false），「東方晨星」走名詞', () => {
    const nodes = parseRich('盤蛇神與東方晨星');
    expect(
      nodes.map((n) => (n.type === 'text' ? '' : `${n.type}:${n.arg}`)).filter(Boolean),
    ).toEqual(['p:snake-god', 't:morning-star']);
  });

  it('結果會被快取（同一字串回傳同一個陣列）', () => {
    expect(parseRich('法恩')).toBe(parseRich('法恩'));
  });
});
