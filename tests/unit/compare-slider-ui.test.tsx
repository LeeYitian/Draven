import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { getAxisPage } from '../../src/content';
import { firstSentence } from '../../src/features/extras/compare';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

// 02：比較滑桿、時間感（--age）、分區標示。拖曳與真實幾何在 e2e 驗證（jsdom 沒有版面）。

function start(hash = '#/axis/2', size: [number, number] = [1440, 720]) {
  history.replaceState(null, '', `/${hash}`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
  return render(<App />);
}
const handle = () => screen.getByRole('slider', { name: '兩種面對時間的方式：左右拖曳比較' });
const root = () => document.documentElement;
const col = (side: 'left' | 'right') => document.querySelector(`[data-side="${side}"]`)!;
// 文字從內容檔讀：改文案不會讓測試失敗，測試只驗證「寬側完整、窄側截短」的行為
const compare = () => getAxisPage(2)!.extras.compare!;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreForTests();
  usePopoverStore.setState({ open: null });
  useUiStore.setState({ hintsTrayOpen: false, pagesMenuOpen: false });
});
afterEach(() => {
  history.replaceState(null, '', '/');
  root().removeAttribute('data-layout');
  root().removeAttribute('data-compact');
  root().removeAttribute('data-aged');
  root().style.removeProperty('--age');
});

describe('02 頁面：事件與關係圖', () => {
  it('6 個事件、6 個節點、分成「長生者 · 魔女」與「凡人」兩區', () => {
    start();
    expect(document.querySelectorAll('[data-event]')).toHaveLength(6);
    expect(document.querySelectorAll('[data-node]')).toHaveLength(6);
    const zones = [...document.querySelectorAll('[data-zone-label]')].map((e) => e.textContent);
    expect(zones).toEqual(['長生者 · 魔女 · 4', '凡人 · 2']);
    // 分區只是標示，不是按鈕
    expect(document.querySelectorAll('[data-layer-head]')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('魔女集會與時間考驗');
    expect(screen.getByText('事件進程 · 孩子與國王')).toBeInTheDocument();
  });

  it('進頁：背景關係（養母）與事件 1 的線可見；事件推進後依序畫出', () => {
    start();
    const visible = () =>
      [...document.querySelectorAll('.edge:not([data-state="unrevealed"])')].map((e) =>
        e.getAttribute('data-edge'),
      );
    expect(visible().sort()).toEqual(['elis-dravin', 'elis-elian']);
    act(() => useAppStore.getState().selectEvent(2, 3));
    expect(visible().sort()).toEqual(
      ['elis-dravin', 'elis-elian', 'nor-elian', 'sevia-elian'].sort(),
    );
  });
});

describe('02 比較滑桿', () => {
  it('role=slider；預設 50／50；範圍 20–80', () => {
    start();
    expect(handle()).toHaveAttribute('aria-valuenow', '50');
    expect(handle()).toHaveAttribute('aria-valuemin', '20');
    expect(handle()).toHaveAttribute('aria-valuemax', '80');
    expect(handle()).toHaveAttribute('aria-valuetext', '左欄 50%、右欄 50%');
    expect(col('left')).not.toHaveAttribute('data-emphasis');
    expect(col('right')).not.toHaveAttribute('data-emphasis');
  });

  it('← → 每次 10%，到 20／80 停住；只移動把手，不換事件、不換頁', async () => {
    start();
    handle().focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}');
    expect(handle()).toHaveAttribute('aria-valuenow', '60');
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(handle()).toHaveAttribute('aria-valuenow', '80');
    await user.keyboard(
      '{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}',
    );
    expect(handle()).toHaveAttribute('aria-valuenow', '20');
    expect(useAppStore.getState().axis[2].eventIndex).toBe(0);
    expect(useAppStore.getState().page).toBe(2);
    expect(fireEvent.keyDown(handle(), { key: 'ArrowRight' })).toBe(false); // 已 preventDefault
  });

  it('連按時以 store 的最新值為準（不會因為渲染落後而少算）', () => {
    start();
    handle().focus();
    for (let i = 0; i < 3; i++) fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(useAppStore.getState().compareSlider).toBe(80);
  });

  it('把手偏右：左側變寬、右側淡出只留標題與首句；偏左則相反', () => {
    const { left, right } = compare();
    start();
    act(() => useAppStore.getState().setCompare(72));
    expect(col('left')).toHaveAttribute('data-emphasis', 'wide');
    expect(col('right')).toHaveAttribute('data-emphasis', 'narrow');
    // 寬側：標題、整段引言、出處都在
    expect(col('left')).toHaveTextContent(left.label);
    expect(col('left')).toHaveTextContent(left.quote);
    expect(col('left')).toHaveTextContent(left.source);
    // 窄側：標題＋首句，不顯示出處
    const first = firstSentence(right.quote);
    expect(col('right')).toHaveTextContent(right.label);
    expect(col('right')).toHaveTextContent(first.text);
    expect(col('right')).not.toHaveTextContent(right.source);
    if (first.more) expect(col('right')).not.toHaveTextContent(right.quote);

    act(() => useAppStore.getState().setCompare(30));
    expect(col('left')).toHaveAttribute('data-emphasis', 'narrow');
    expect(col('right')).toHaveAttribute('data-emphasis', 'wide');
    expect(col('right')).toHaveTextContent(right.quote);
  });

  it('窄側的「⋯」只在引言真的被截短時才出現（本來就是一句就完整顯示）', () => {
    const { left, right } = compare();
    start();
    act(() => useAppStore.getState().setCompare(30)); // 左側變窄
    expect(col('left').textContent?.includes('⋯')).toBe(firstSentence(left.quote).more);
    act(() => useAppStore.getState().setCompare(72)); // 右側變窄
    expect(col('right').textContent?.includes('⋯')).toBe(firstSentence(right.quote).more);
  });
});

describe('02 時間感（--age）', () => {
  it('預設與往左：沒有 --age 標記、沒有暈影（乾淨紙色）', () => {
    start();
    expect(root()).not.toHaveAttribute('data-aged');
    act(() => useAppStore.getState().setCompare(30));
    expect(root()).not.toHaveAttribute('data-aged');
    expect(root().style.getPropertyValue('--age')).toBe('0');
  });

  it('往右：age = (位置−50)/30，量化成 1/50 階梯；80% 為 1', () => {
    start();
    act(() => useAppStore.getState().setCompare(65));
    expect(root().style.getPropertyValue('--age')).toBe('0.5');
    expect(root()).toHaveAttribute('data-aged');
    act(() => useAppStore.getState().setCompare(80));
    expect(root().style.getPropertyValue('--age')).toBe('1');
    // 階梯內的小幅移動不會改變 --age（拖曳時不必每個像素都更新整頁樣式）
    act(() => useAppStore.getState().setCompare(65.1));
    expect(root().style.getPropertyValue('--age')).toBe('0.5');
  });

  it('02 頁有暈影疊層（在 main 之外）；01 頁沒有', () => {
    start();
    const vignette = document.querySelector('.age-vignette')!;
    expect(vignette).toBeInTheDocument();
    expect(vignette.closest('main')).toBeNull();
    expect(document.querySelector('[data-page-main]')).toBeInTheDocument();
  });

  it('離開 02：--age 與標記清除、把手回到 50%', () => {
    start();
    act(() => useAppStore.getState().setCompare(80));
    expect(root()).toHaveAttribute('data-aged');
    act(() => useAppStore.getState().setPage(1));
    expect(useAppStore.getState().compareSlider).toBe(50);
    // 元件卸載（換頁後）：變數與標記都不殘留
    history.replaceState(null, '', '/#/axis/1');
    act(() => void window.dispatchEvent(new HashChangeEvent('hashchange')));
    expect(root()).not.toHaveAttribute('data-aged');
    expect(root().style.getPropertyValue('--age')).toBe('');
    expect(document.querySelector('.age-vignette')).toBeNull();
  });
});

describe('02 流式版', () => {
  it('比較滑桿在關係圖之前、不堆疊（兩欄用 grid 並排）；範圍保證窄側 ≥ 96px', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    start('#/axis/2', [390, 844]);
    const track = document.querySelector('[data-compare-track]') as HTMLElement;
    expect(track).toBeInTheDocument();
    expect(track.style.gridTemplateColumns).toBe('50% 50%');
    const graph = document.querySelector('[data-graph-viewport]')!;
    expect(graph.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe('02 伏筆回收處', () => {
  it('事件 04 有「第一次感冒」、事件 05 有「不當王子」', () => {
    vi.useFakeTimers();
    start();
    act(() => useAppStore.getState().selectEvent(2, 4));
    act(() => void vi.advanceTimersByTime(400));
    expect(document.querySelector('[data-hint="first-cold"]')).toHaveTextContent('輕咳感冒');
    act(() => useAppStore.getState().selectEvent(2, 5));
    act(() => void vi.advanceTimersByTime(400));
    expect(document.querySelector('[data-hint="not-prince"]')).toHaveTextContent(
      '孩子能做到大人做不到的事',
    );
    vi.useRealTimers();
  });
});
