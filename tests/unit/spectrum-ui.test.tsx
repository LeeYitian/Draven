import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

// 01 邊界之辯光譜：slider 語意、鍵盤、人名 Popover。
// 拖曳與吸附的真實幾何在 e2e 驗證（jsdom 沒有版面）。

/** 光譜從事件 05 起才出現（extras.boundary.showFromEvent），所以預設先翻到事件 05 */
function start(hash = '#/axis/1', size: [number, number] = [1440, 720], event = 5) {
  history.replaceState(null, '', `/${hash}`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
  const view = render(<App />);
  act(() => useAppStore.getState().selectEvent(1, event));
  return view;
}
const slider = () => screen.getByRole('slider', { name: '邊界之辯光譜' });
const detail = () => document.querySelector('[data-spectrum-detail]');

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

describe('01 邊界之辯光譜', () => {
  it('事件 01–04 沒有光譜；翻到事件 05 才出現（之後事件 06 也還在）', () => {
    start('#/axis/1', [1440, 720], 1);
    for (const n of [1, 2, 3, 4]) {
      act(() => useAppStore.getState().selectEvent(1, n));
      expect(screen.queryByRole('slider', { name: '邊界之辯光譜' })).toBeNull();
    }
    act(() => useAppStore.getState().selectEvent(1, 5));
    expect(slider()).toBeInTheDocument();
    act(() => useAppStore.getState().selectEvent(1, 6));
    expect(slider()).toBeInTheDocument();
  });

  it('role=slider，0–100，預設在 100（德雷文）', () => {
    start();
    expect(slider()).toHaveAttribute('aria-valuemin', '0');
    expect(slider()).toHaveAttribute('aria-valuemax', '100');
    expect(slider()).toHaveAttribute('aria-valuenow', '100');
    expect(slider()).toHaveAttribute('aria-valuetext', '最接近的立場：德雷文');
    expect(detail()).toHaveTextContent('理想主義');
    expect(detail()).toHaveTextContent('我本人就是我的理念的最佳典範');
  });

  it('五個立場依位置排列，目前立場標記為 current', () => {
    start();
    const ids = [...document.querySelectorAll('[data-stance]')].map((e) =>
      e.getAttribute('data-stance'),
    );
    expect(ids).toEqual(['rumi', 'nor', 'fane', 'bren', 'dravin']);
    expect(document.querySelector('[data-stance="dravin"]')).toHaveAttribute('data-current');
  });

  it('← 往左一個立場，→ 往右；盡頭不動；Home／End 跳到兩端', async () => {
    start();
    slider().focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowLeft}');
    expect(slider()).toHaveAttribute('aria-valuenow', '75');
    expect(detail()).toHaveTextContent('基層信徒');
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(slider()).toHaveAttribute('aria-valuenow', '10');
    expect(detail()).toHaveTextContent('魔女');
    await user.keyboard('{ArrowRight}');
    expect(slider()).toHaveAttribute('aria-valuenow', '30');
    await user.keyboard('{End}');
    expect(slider()).toHaveAttribute('aria-valuenow', '100');
    await user.keyboard('{Home}');
    expect(slider()).toHaveAttribute('aria-valuenow', '10');
  });

  it('← → 只移動指標：不換事件、不換頁（preventDefault）', async () => {
    start();
    slider().focus();
    const user = userEvent.setup();
    const before = useAppStore.getState().axis[1].eventIndex;
    await user.keyboard('{ArrowLeft}{ArrowRight}{ArrowLeft}');
    expect(useAppStore.getState().axis[1].eventIndex).toBe(before);
    expect(useAppStore.getState().page).toBe(1);
    expect(fireEvent.keyDown(slider(), { key: 'ArrowLeft' })).toBe(false); // 已 preventDefault
  });

  it('焦點不在光譜時 → 照常換事件（事件 05 → 06）', async () => {
    start();
    const user = userEvent.setup();
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{ArrowRight}');
    expect(useAppStore.getState().axis[1].eventIndex).toBe(5);
  });

  it('軌道下的人名可開 Popover', async () => {
    start();
    const user = userEvent.setup();
    const name = document.querySelector('[data-stance="fane"] [role="button"]') as HTMLElement;
    await user.click(name);
    expect(usePopoverStore.getState().open?.id).toBe('fane');
  });
});
