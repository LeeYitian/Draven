import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closePeople,
  currentHash,
  formatRoute,
  getReturnTo,
  navigate,
  openPeople,
  parseHash,
  subscribe,
} from '../../src/lib/hash-router';

describe('parseHash', () => {
  it('00 世界觀導讀：空、#、#/ 都是 home', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
  });

  it('主軸 1–4', () => {
    expect(parseHash('#/axis/1')).toEqual({ name: 'axis', axis: 1 });
    expect(parseHash('#/axis/4')).toEqual({ name: 'axis', axis: 4 });
  });

  it('人物誌與開發用元件圖鑑', () => {
    expect(parseHash('#/people')).toEqual({ name: 'people' });
    expect(parseHash('#/__kit')).toEqual({ name: 'kit' });
    expect(parseHash('#/__kit/frame')).toEqual({ name: 'kit' });
  });

  it('未知路徑一律回 home（含不存在的主軸、非數字、多餘段落）', () => {
    expect(parseHash('#/nope')).toEqual({ name: 'home' });
    expect(parseHash('#/axis/0')).toEqual({ name: 'home' });
    expect(parseHash('#/axis/5')).toEqual({ name: 'home' });
    expect(parseHash('#/axis/x')).toEqual({ name: 'home' });
    expect(parseHash('#/axis/1/extra')).toEqual({ name: 'home' });
  });

  it('忽略 hash 內的查詢字串與結尾斜線', () => {
    expect(parseHash('#/axis/2?x=1')).toEqual({ name: 'axis', axis: 2 });
    expect(parseHash('#/people/')).toEqual({ name: 'people' });
  });
});

describe('formatRoute', () => {
  it('與 parseHash 互為反函式', () => {
    for (const hash of ['#/', '#/axis/1', '#/axis/3', '#/people']) {
      expect(formatRoute(parseHash(hash))).toBe(hash);
    }
  });
});

describe('導覽與人物誌的 returnTo', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
  });
  afterEach(() => {
    history.replaceState(null, '', '/');
  });

  const waitPopstate = () =>
    new Promise<void>((resolve) =>
      window.addEventListener('popstate', () => resolve(), { once: true }),
    );

  it('navigate 會更新 hash 並通知訂閱者', () => {
    const listener = vi.fn();
    const off = subscribe(listener);
    navigate({ name: 'axis', axis: 2 });
    expect(currentHash()).toBe('#/axis/2');
    expect(listener).toHaveBeenCalled();
    off();
  });

  it('openPeople 記住開啟前的頁面；closePeople 回到該頁', async () => {
    navigate({ name: 'axis', axis: 3 });
    openPeople();
    expect(currentHash()).toBe('#/people');
    expect(getReturnTo()).toBe('#/axis/3');

    const back = waitPopstate();
    closePeople();
    await back;
    expect(currentHash()).toBe('#/axis/3');
  });

  it('直接進入 #/people（沒有上一頁）：關閉時回到 00', () => {
    history.replaceState(null, '', '/#/people');
    expect(getReturnTo()).toBe('#/');
    closePeople();
    expect(currentHash()).toBe('#/');
  });

  it('在人物誌內再呼叫 openPeople 不會重複堆疊歷史', () => {
    navigate({ name: 'axis', axis: 1 });
    openPeople();
    const length = history.length;
    openPeople();
    expect(history.length).toBe(length);
    expect(getReturnTo()).toBe('#/axis/1');
  });

  it('導向相同頁面不新增歷史紀錄', () => {
    navigate({ name: 'axis', axis: 2 });
    const length = history.length;
    navigate({ name: 'axis', axis: 2 });
    expect(history.length).toBe(length);
  });
});
