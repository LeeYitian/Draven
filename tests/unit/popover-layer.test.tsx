import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { TRACK_TOAST_MS } from '../../src/components/layout/TrackToast';
import { currentHash } from '../../src/lib/hash-router';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

function start(hash: string, size: [number, number] = [1440, 720]) {
  history.replaceState(null, '', `/${hash}`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
  return render(<App />);
}
const nameLink = (name: string) => screen.getAllByRole('button', { name })[0]!;

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

describe('PopoverLayer（舞台版）', () => {
  it('點人名開啟 dialog，內容為該人，焦點移入；錨點進入選中狀態', async () => {
    start('#/axis/1');
    await userEvent.click(nameLink('德雷文'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('德雷文');
    expect(dialog).toHaveTextContent('依目前進度 01');
    expect(dialog.contains(document.activeElement) || dialog === document.activeElement).toBe(true);
    expect(nameLink('德雷文')).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('[data-stage] [role="dialog"]')).not.toBeNull(); // 在舞台內
  });

  it('只有一個 Popover：開第二個會取代第一個；再點同一個錨點關閉', async () => {
    start('#/axis/1');
    act(() => useAppStore.getState().selectEvent(1, 2));
    await screen.findByRole('button', { name: '艾莉絲' }); // 等敘述淡出淡入後換成事件 2
    await userEvent.click(nameLink('法恩'));
    await userEvent.click(nameLink('艾莉絲'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveTextContent('艾莉絲');
    await userEvent.click(nameLink('艾莉絲'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Esc 關閉並把焦點還給錨點', async () => {
    start('#/axis/1');
    const anchor = nameLink('德雷文');
    await userEvent.click(anchor);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(anchor);
  });

  it('點外部關閉；點 Popover 內部不關閉', async () => {
    start('#/axis/1');
    await userEvent.click(nameLink('德雷文'));
    fireEvent.pointerDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(document.querySelector('[data-event="3"]')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('鍵盤開啟：聚焦人名、Enter 開啟', async () => {
    start('#/axis/1');
    nameLink('德雷文').focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('換事件（←→）會關閉 Popover，因為錨點已消失', async () => {
    start('#/axis/1');
    await userEvent.click(nameLink('德雷文'));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('「在人物誌查看 →」關閉 Popover 並開啟人物誌（#/people）', async () => {
    start('#/axis/1');
    await userEvent.click(nameLink('德雷文'));
    await userEvent.click(screen.getByRole('button', { name: '在人物誌查看 →' }));
    expect(document.querySelector('[data-popover]')).toBeNull(); // Popover 已關閉（人物誌本身也是 dialog）
    expect(currentHash()).toBe('#/people');
  });

  it('名詞連結開名詞 Popover：沒有「在人物誌查看」', async () => {
    start('#/axis/1');
    await userEvent.click(nameLink('交流特使'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('交流特使');
    expect(dialog).not.toHaveTextContent('在人物誌查看');
  });

  it('00 頁的人名也能開 Popover（進度 00）', async () => {
    start('#/');
    await userEvent.click(nameLink('德雷文'));
    expect(screen.getByRole('dialog')).toHaveTextContent('依目前進度 00');
  });

  it('點關係圖節點不開 Popover（G-09）', async () => {
    start('#/axis/1');
    await userEvent.click(document.querySelector('[data-node="dravin"]')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('PopoverLayer（流式版）', () => {
  it('改為底部面板（Sheet），附遮罩；點遮罩關閉', async () => {
    start('#/axis/1', [390, 844]);
    await userEvent.click(nameLink('德雷文'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('sheet');
    expect(dialog).toHaveTextContent('依目前進度 01');
    expect(document.querySelector('[data-stage]')).toBeNull();
    const scrim = document.querySelector('.scrim')!.parentElement!;
    await userEvent.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Esc 關閉；版面切換（跨 1024 門檻）會關閉 Popover', async () => {
    start('#/axis/1', [390, 844]);
    await userEvent.click(nameLink('德雷文'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(nameLink('德雷文'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('追蹤回饋提示（TrackToast）', () => {
  it('追蹤開始：顯示「正在追蹤：某人」2.4 秒後消失；側欄追蹤區塊閃動', () => {
    vi.useFakeTimers();
    start('#/axis/1');
    expect(document.querySelector('[data-track-toast]')).toBeNull(); // 載入時不顯示
    act(() => useAppStore.getState().trackPerson('fane'));
    const toast = document.querySelector('[data-track-toast]')!;
    expect(toast).toHaveTextContent('正在追蹤：法恩');
    expect(document.querySelector('[data-flash]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(TRACK_TOAST_MS - 50));
    expect(document.querySelector('[data-track-toast]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(100));
    expect(document.querySelector('[data-track-toast]')).toBeNull();
  });

  it('改追蹤另一個人：重新顯示提示；取消追蹤不顯示提示', () => {
    vi.useFakeTimers();
    start('#/axis/1');
    act(() => useAppStore.getState().trackPerson('fane'));
    act(() => vi.advanceTimersByTime(TRACK_TOAST_MS + 100));
    act(() => useAppStore.getState().trackPerson('elian'));
    expect(document.querySelector('[data-track-toast]')).toHaveTextContent('正在追蹤：艾利安');
    act(() => useAppStore.getState().untrack());
    expect(document.querySelector('[data-track-toast]')).toBeNull();
  });

  it('流式版：提示在導覽列上方（fixed）', () => {
    start('#/axis/1', [390, 844]);
    act(() => useAppStore.getState().trackPerson('fane'));
    expect(document.querySelector('[data-track-toast]')).toHaveClass('fixed');
  });

  it('重新載入後保留追蹤（localStorage），但載入時不顯示提示', () => {
    localStorage.setItem('draven:tracked', JSON.stringify('fane'));
    resetStoreForTests();
    start('#/axis/1');
    expect(useAppStore.getState().trackedPersonId).toBe('fane');
    expect(document.querySelector('[data-track-toast]')).toBeNull();
    expect(document.querySelectorAll('[data-event][data-tracked]')).toHaveLength(4);
  });
});
