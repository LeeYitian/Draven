import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { people } from '../../src/content';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

// T074：人名 Popover 的文字依「目前進度」累積；04 的內容永遠不出現（劇透規則的畫面層驗證）。
// 規則本身在 selectors.test.ts；這裡驗證實際畫出來的文字（15 人 × 進度 0–4＋04 遮罩未開）。

let anchor: HTMLElement;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreForTests();
  usePopoverStore.setState({ open: null });
  useUiStore.setState({ hintsTrayOpen: false, pagesMenuOpen: false });
  history.replaceState(null, '', '/#/');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
  render(<App />);
  anchor = document.createElement('span');
  document.body.append(anchor);
});
afterEach(() => {
  anchor.remove();
  history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('data-layout');
});

/** 設定進度後開啟某人的 Popover，回傳畫出來的卡片 */
function openAt(personId: string, page: 0 | 1 | 2 | 3 | 4, unlocked = true) {
  act(() => useAppStore.setState({ page, page04Unlocked: unlocked }));
  act(() =>
    usePopoverStore.setState({
      open: { kind: 'person', id: personId, anchor, anchorKey: `${personId}-${page}` },
    }),
  );
  return screen.getByRole('dialog');
}

/** 依資料算出該進度應有的文字（獨立於 selectors 的實作） */
function expectedText(popover: readonly string[], progress: number): string {
  const last = Math.min(Math.max(progress - 1, 0), 3);
  return popover.slice(0, last + 1).join('');
}

describe('人名 Popover 的內容（15 人 × 進度）', () => {
  for (const person of people) {
    it(`${person.name}：進度 0–4 各自只含該進度之前的文字，不洩漏後面的階段`, () => {
      for (const progress of [0, 1, 2, 3, 4] as const) {
        const card = openAt(person.id, progress);
        const text = card.querySelector('p')!.textContent!;
        expect(text, `${person.name} @${progress}`).toBe(expectedText(person.popover, progress));
        // 後面的階段若有新內容，絕不出現在這個進度的文字中
        const last = Math.min(Math.max(progress - 1, 0), 3);
        for (const later of person.popover.slice(last + 1))
          if (later && !text.includes(later)) expect(text).not.toContain(later);
        expect(card).toHaveTextContent(person.name);
        expect(card).toHaveTextContent(person.role);
        expect(card).toHaveTextContent(`依目前進度 0${progress}`);
        act(() => usePopoverStore.setState({ open: null }));
      }
    });
  }

  it('04 遮罩沒打開前進度算 03：人物 Popover 顯示 03 的內容與「依目前進度 03」', () => {
    const dravin = people.find((p) => p.id === 'dravin')!;
    const card = openAt('dravin', 4, false);
    expect(card.querySelector('p')!.textContent).toBe(expectedText(dravin.popover, 3));
    expect(card).toHaveTextContent('依目前進度 03');
  });

  it('00 與 01：只有基本身分；到 02 才多出「讀完 01」的句子', () => {
    const dravin = people.find((p) => p.id === 'dravin')!;
    expect(openAt('dravin', 0).querySelector('p')!.textContent).toBe(dravin.popover[0]);
    act(() => usePopoverStore.setState({ open: null }));
    expect(openAt('dravin', 1).querySelector('p')!.textContent).toBe(dravin.popover[0]);
    act(() => usePopoverStore.setState({ open: null }));
    expect(openAt('dravin', 2).querySelector('p')!.textContent).toBe(
      dravin.popover[0] + dravin.popover[1],
    );
  });
});

describe('名詞 Popover', () => {
  it('固定內容、沒有進度頁尾與人物誌連結，任何進度都相同', () => {
    for (const page of [0, 2, 4] as const) {
      act(() => useAppStore.setState({ page, page04Unlocked: true }));
      act(() =>
        usePopoverStore.setState({
          open: { kind: 'term', id: 'morning-star', anchor, anchorKey: `t-${page}` },
        }),
      );
      const card = screen.getByRole('dialog');
      expect(card).toHaveTextContent('東方晨星');
      expect(card).toHaveTextContent('德雷文的稱號之一');
      expect(card.textContent).not.toContain('依目前進度');
      expect(card.textContent).not.toContain('在人物誌查看');
      act(() => usePopoverStore.setState({ open: null }));
    }
  });
});
