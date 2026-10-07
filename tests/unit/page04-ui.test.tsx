import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

// 04：劇透遮罩（G-14）、鏡像對照卡、明信片、事件 → 專屬區塊。真實幾何與 3D 翻面在 e2e 驗證。

function start(hash = '#/axis/4', size: [number, number] = [1440, 720]) {
  history.replaceState(null, '', `/${hash}`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
  return render(<App />);
}
const cover = () => document.querySelector('[data-spoiler-cover]');
const unlockButton = () => screen.getByRole('button', { name: '我準備好了，打開' });
const toEvent = (n: number) => {
  vi.useFakeTimers();
  act(() => useAppStore.getState().selectEvent(4, n));
  act(() => void vi.advanceTimersByTime(400));
  vi.useRealTimers();
};
const extraKind = () =>
  document.querySelector('[data-event-extra]')?.getAttribute('data-event-extra');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreForTests();
  usePopoverStore.setState({ open: null });
  useUiStore.setState({ hintsTrayOpen: false, pagesMenuOpen: false });
});
afterEach(() => {
  vi.useRealTimers();
  history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('data-layout');
  document.documentElement.removeAttribute('data-compact');
});

describe('04 劇透遮罩', () => {
  it('第一次進入：有遮罩（標題、說明、按鈕）；頁首仍在；頁首以下的內容 inert', () => {
    start();
    expect(cover()).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '第四主軸含有結局' })).toBeInTheDocument();
    expect(screen.getByText(/這一頁會揭露詛咒的真相與最終的選擇/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('母愛與地龍契約');
    // 頁首以外的內容在 inert 容器內
    const eventBar = document.querySelector('[data-event]')!;
    expect(eventBar.closest('[inert]')).not.toBeNull();
    expect(cover()!.closest('[inert]')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).closest('[inert]')).toBeNull();
  });

  it('遮罩期間：進度只算 3（04 的伏筆還沒獲得、人物 Popover 不含 04）；打開後才獲得', () => {
    start();
    expect(useAppStore.getState().hints.owned).toEqual([]); // 直接進 04 也不獲得
    act(() => unlockButton().click());
    expect(cover()).toBeNull();
    expect(useAppStore.getState().hints.owned).toEqual(['second-prophecy']); // 04 只有 1 個
    expect(useAppStore.getState().page04Unlocked).toBe(true);
  });

  it('打開後記入 sessionStorage；重新載入同一個分頁不再顯示遮罩', () => {
    const first = start();
    act(() => unlockButton().click());
    expect(sessionStorage.getItem('draven:page04Unlocked')).toBe('true');
    first.unmount();
    resetStoreForTests();
    start();
    expect(cover()).toBeNull();
    expect(document.querySelector('[data-event]')!.closest('[inert]')).toBeNull();
  });

  it('遮罩期間 ← → 不推進事件；↑ 仍可換頁（鍵盤）', async () => {
    start();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(useAppStore.getState().axis[4].eventIndex).toBe(0);
    await user.keyboard('{ArrowUp}');
    expect(window.location.hash).toBe('#/axis/3');
  });

  it('打開後 ← → 恢復', async () => {
    start();
    act(() => unlockButton().click());
    const user = userEvent.setup();
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{ArrowRight}');
    expect(useAppStore.getState().axis[4].eventIndex).toBe(1);
  });

  it('流式版：遮罩直接取代頁首以下的內容（事件列與關係圖不佔版面）', () => {
    start('#/axis/4', [390, 844]);
    expect(cover()).toBeInTheDocument();
    const hidden = document.querySelector('[data-event]')!.closest('[inert]') as HTMLElement;
    expect(hidden).toHaveClass('hidden');
    act(() => unlockButton().click());
    expect(cover()).toBeNull();
    expect(document.querySelector('[data-event]')!.closest('[inert]')).toBeNull();
  });

  it('其他主軸沒有遮罩', () => {
    start('#/axis/3');
    expect(cover()).toBeNull();
  });
});

describe('04 事件 → 專屬區塊', () => {
  beforeEach(() => {
    sessionStorage.setItem('draven:page04Unlocked', 'true');
    resetStoreForTests();
  });

  it('事件 03 鏡像卡、事件 05 明信片，其餘事件「艾莉絲的抉擇」', () => {
    start();
    const kinds: string[] = [];
    for (let n = 1; n <= 6; n++) {
      toEvent(n);
      kinds.push(extraKind() ?? 'none');
    }
    expect(kinds).toEqual(['choice', 'choice', 'mirror', 'choice', 'postcard', 'choice']);
  });

  it('抉擇區塊：兩句抉擇＋兩則留言', () => {
    start();
    const block = document.querySelector('[data-choice]')!;
    expect(block).toHaveTextContent('艾莉絲的抉擇');
    expect(block).toHaveTextContent('失去身分，好過失去德雷文。');
    expect(block).toHaveTextContent('在「保留母親記憶」與「拯救養子生命」之間');
    expect(block).toHaveTextContent('魔法明信片上的留言');
    expect(block).toHaveTextContent('媽媽很愛你，等詛咒解除再重新開始吧。');
  });
});

describe('04 鏡像對照卡', () => {
  beforeEach(() => {
    sessionStorage.setItem('draven:page04Unlocked', 'true');
    resetStoreForTests();
  });
  const card = () => document.querySelector('.mirror-card') as HTMLElement;
  const face = (side: 'a' | 'b') =>
    document.querySelector(`[data-side="${side}"].mirror-face`) as HTMLElement;

  it('兩面欄位對齊：身分背景／選擇／動機，兩面的列順序與標籤相同', () => {
    start();
    toEvent(3);
    const rows = (f: HTMLElement) =>
      [...f.querySelectorAll('.mirror-row')].map(
        (r) => r.querySelector('.mirror-row__label')!.textContent,
      );
    expect(rows(face('a'))).toEqual(['身分背景', '選擇', '動機']);
    expect(rows(face('b'))).toEqual(rows(face('a')));
    expect(face('a')).toHaveTextContent('艾莉絲');
    expect(face('a')).toHaveTextContent('為了人類的養子');
    expect(face('b')).toHaveTextContent('主教');
    expect(face('b')).toHaveTextContent('為了非人的養育者');
  });

  it('預設看到艾莉絲面；背面 inert 且不被讀出', () => {
    start();
    toEvent(3);
    expect(card()).not.toHaveAttribute('data-flipped');
    expect(face('a')).not.toHaveAttribute('inert');
    expect(face('b')).toHaveAttribute('inert');
    expect(face('b')).toHaveAttribute('aria-hidden', 'true');
  });

  it('點卡片翻面；再點翻回來；翻到哪一面 inert 跟著換', () => {
    start();
    toEvent(3);
    fireEvent.click(card());
    expect(card()).toHaveAttribute('data-flipped');
    expect(face('a')).toHaveAttribute('inert');
    expect(face('b')).not.toHaveAttribute('inert');
    fireEvent.click(card());
    expect(card()).not.toHaveAttribute('data-flipped');
  });

  it('鍵盤：面上的「點擊翻面」按鈕可翻面（aria-pressed），只有看得到的那一面有按鈕可聚焦', async () => {
    start();
    toEvent(3);
    const user = userEvent.setup();
    const button = face('a').querySelector('[data-mirror-flip]') as HTMLElement;
    expect(button).toHaveAttribute('aria-pressed', 'false');
    button.focus();
    await user.keyboard('{Enter}');
    expect(card()).toHaveAttribute('data-flipped');
    expect(face('b').querySelector('[data-mirror-flip]')).toHaveAttribute('aria-pressed', 'true');
    // 翻面按鈕本身的點擊不會因為冒泡被卡片再翻一次
    expect(card()).toHaveAttribute('data-flipped');
  });

  it('點人名開 Popover，不會翻面', async () => {
    start();
    toEvent(3);
    const user = userEvent.setup();
    await user.click(face('a').querySelector('.mirror-face__name [role="button"]')!);
    expect(usePopoverStore.getState().open?.id).toBe('elis');
    expect(card()).not.toHaveAttribute('data-flipped');
  });

  it('離開事件 03 再回來：卡片翻到哪一面不變（同一種區塊跨事件保留）；換成別種區塊會重設', () => {
    start();
    toEvent(3);
    fireEvent.click(card());
    toEvent(4); // 抉擇區塊（卡片卸載）
    toEvent(3);
    expect(card()).not.toHaveAttribute('data-flipped');
  });
});

describe('04 明信片', () => {
  beforeEach(() => {
    sessionStorage.setItem('draven:page04Unlocked', 'true');
    resetStoreForTests();
  });
  const postcard = () => document.querySelector('.postcard') as HTMLElement;

  it('正面是插圖（占位圖、有替代文字）、背面是留言；卡片下方一行說明', () => {
    start();
    toEvent(5);
    const img = postcard().querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/images/postcard-placeholder.svg');
    expect(img.getAttribute('alt')).toContain('素材待提供');
    expect(postcard()).toHaveTextContent('魔法明信片上的留言');
    expect(postcard()).toHaveTextContent('媽媽很愛你，等詛咒解除再重新開始吧。');
    expect(document.querySelector('.postcard__caption')).toHaveTextContent(
      '解咒後，德雷文看著「媽媽」與「艾莉絲」的字眼，只感到陌生',
    );
  });

  it('點擊翻面（aria-pressed）；翻到背面時正面的圖片不再被讀出', () => {
    start();
    toEvent(5);
    expect(postcard()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(postcard());
    expect(postcard()).toHaveAttribute('aria-pressed', 'true');
    expect(postcard()).toHaveAttribute('data-flipped');
    expect(postcard().querySelector('img')).toHaveAttribute('alt', '');
    const lift = document.querySelector('.postcard-lift')!;
    expect(lift).toHaveAttribute('data-lift', '1'); // 上浮動畫（兩組輪流）
    fireEvent.click(postcard());
    expect(lift).toHaveAttribute('data-lift', '0');
    expect(postcard()).not.toHaveAttribute('data-flipped');
  });
});
