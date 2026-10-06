import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { closePeople, currentHash } from '../../src/lib/hash-router';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

function start(hash: string, size: [number, number] = [1440, 720]) {
  history.replaceState(null, '', `/${hash}`);
  setViewport(...size);
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreForTests();
  usePopoverStore.setState({ open: null });
  useUiStore.setState({ hintsTrayOpen: false, pagesMenuOpen: false });
});
afterEach(() => {
  history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('data-layout');
  document.documentElement.removeAttribute('data-compact');
});

describe('App 組裝（版型＋路由＋狀態＋側欄＋鍵盤）', () => {
  it('舞台版：渲染 1440×720 舞台與側欄，頁面指示標出目前頁', () => {
    start('#/axis/2');
    expect(document.querySelector('[data-stage]')).not.toBeNull();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('button', { name: /02/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: /00/ })).not.toHaveAttribute('aria-current');
    expect(useAppStore.getState().page).toBe(2);
  });

  it('直接進入 #/axis/2：獲得該主軸的 8 個伏筆，側欄徽章顯示 8', () => {
    start('#/axis/2');
    expect(useAppStore.getState().hints.owned).toHaveLength(8);
    expect(screen.getByLabelText(/已獲得 8 個伏筆/)).toHaveTextContent('8');
  });

  it('點頁面指示換頁：hash 與狀態同步', async () => {
    start('#/');
    const nav = screen.getByRole('navigation');
    await userEvent.click(within(nav).getByRole('button', { name: /03/ }));
    expect(currentHash()).toBe('#/axis/3');
    expect(useAppStore.getState().page).toBe(3);
  });

  it('方向鍵 ↓ 換頁、↑ 回上一頁；到 04 再按 ↓ 不動作', async () => {
    start('#/');
    await userEvent.keyboard('{ArrowDown}');
    expect(currentHash()).toBe('#/axis/1');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(currentHash()).toBe('#/axis/4');
    await userEvent.keyboard('{ArrowDown}');
    expect(currentHash()).toBe('#/axis/4');
    await userEvent.keyboard('{ArrowUp}');
    expect(currentHash()).toBe('#/axis/3');
  });

  it('方向鍵 ← → 在 01–04 推進事件；00 沒有作用', async () => {
    start('#/axis/1');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(useAppStore.getState().axis[1].eventIndex).toBe(2);
    await userEvent.keyboard('{ArrowLeft}');
    expect(useAppStore.getState().axis[1].eventIndex).toBe(1);
    act(() => {
      location.hash = '#/';
    });
    await userEvent.keyboard('{ArrowRight}');
    expect(useAppStore.getState().axis[1].eventIndex).toBe(1);
  });

  it('04 遮罩沒打開時：←→ 不推進事件，也不獲得 04 的伏筆', async () => {
    start('#/axis/4');
    expect(useAppStore.getState().hints.owned).toEqual([]);
    await userEvent.keyboard('{ArrowRight}');
    expect(useAppStore.getState().axis[4].eventIndex).toBe(0);
  });

  it('人物誌（#/people）開啟時不處理方向鍵；底層頁碼是開啟前的頁面', async () => {
    start('#/axis/2');
    await userEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: /人物誌/ }),
    );
    expect(currentHash()).toBe('#/people');
    expect(useAppStore.getState().peopleOpen).toBe(true);
    expect(useAppStore.getState().page).toBe(2);
    await userEvent.keyboard('{ArrowDown}');
    expect(currentHash()).toBe('#/people');

    const back = new Promise<void>((resolve) =>
      window.addEventListener('popstate', () => resolve(), { once: true }),
    );
    closePeople();
    await back;
    expect(useAppStore.getState().peopleOpen).toBe(false);
    expect(currentHash()).toBe('#/axis/2');
  });

  it('直接開啟 #/people：底層是 00', () => {
    start('#/people');
    expect(useAppStore.getState().peopleOpen).toBe(true);
    expect(useAppStore.getState().page).toBe(0);
  });

  it('追蹤中的人物顯示在側欄，可取消', async () => {
    start('#/');
    act(() => useAppStore.getState().trackPerson('fane'));
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('法恩')).toBeInTheDocument();
    await userEvent.click(within(nav).getByRole('button', { name: '取消追蹤' }));
    expect(within(nav).queryByText('法恩')).toBeNull();
  });
});

describe('App：流式版', () => {
  it('窄螢幕：渲染底部導覽列（人物誌、伏筆、未追蹤、頁面），沒有舞台', () => {
    start('#/axis/1', [390, 844]);
    expect(document.querySelector('[data-stage]')).toBeNull();
    expect(document.querySelector('[data-flow]')).not.toBeNull();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('人物誌')).toBeInTheDocument();
    expect(within(nav).getByText('未追蹤')).toBeInTheDocument();
    expect(document.documentElement.dataset.layout).toBe('flow');
  });

  it('流式版不處理方向鍵（保留原生捲動）', async () => {
    start('#/axis/1', [390, 844]);
    await userEvent.keyboard('{ArrowDown}');
    expect(currentHash()).toBe('#/axis/1');
  });

  it('點「頁面」開啟選單，選擇後換頁並關閉', async () => {
    start('#/', [390, 844]);
    await userEvent.click(screen.getByRole('button', { name: /頁面/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /02/ }));
    expect(currentHash()).toBe('#/axis/2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
