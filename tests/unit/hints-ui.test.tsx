import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { HINT_TOAST_MS } from '../../src/features/hints/HintToast';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

function start(hash: string, size: [number, number] = [1440, 720]) {
  history.replaceState(null, '', `/${hash}`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
  return render(<App />);
}
const store = () => useAppStore.getState();
/** 側欄／導覽列的「伏筆」按鈕（框格的 aria-label 也以「伏筆」開頭，所以限定在導覽區內找） */
const dockHints = () => within(screen.getByRole('navigation')).getByRole('button', { name: /^伏筆/ });
const slot = (id: string) => document.querySelector<HTMLElement>(`[data-hint-slot="${id}"]`)!;
const keyword = (id: string) => document.querySelector<HTMLElement>(`[data-hint-keyword="${id}"]`)!;
/** 直接設定持有的伏筆（模擬已讀過前面的主軸），然後到 03 事件 06 */
function ownAll() {
  useAppStore.setState({
    hints: {
      ...store().hints,
      owned: ['forgotten-gift', 'useful-to-witch', 'spirit-scent', 'cold-hand', 'divine-language'],
    },
  });
}

/** jsdom 沒有版面：替每個伏筆片語假造 getClientRects（由上到下、每行 36px），讓舞台版量測得到錨點 */
const realGetClientRects = HTMLElement.prototype.getClientRects;
function mockAnchorRects() {
  HTMLElement.prototype.getClientRects = function (this: HTMLElement) {
    const id = this.dataset?.hint;
    if (!id) return realGetClientRects.call(this);
    const order = ['useful-to-witch', 'forgotten-gift', 'spirit-scent'].indexOf(id);
    const top = 200 + (order < 0 ? 0 : order) * 36;
    return [{ left: 100, right: 300, top, bottom: top + 30, width: 200, height: 30 }] as unknown as DOMRectList;
  };
}

/** 等到敘述面板顯示指定標題的事件（切換事件有 120ms 淡出） */
const untilEvent = (title: string) =>
  vi.waitFor(() =>
    expect(document.querySelector('[data-narrative-body] h2')).toHaveTextContent(title),
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreForTests();
  usePopoverStore.setState({ open: null });
  useUiStore.setState({
    hintsTrayOpen: false,
    pagesMenuOpen: false,
    hintDragging: false,
    hintFeedback: null,
    announcement: null,
  });
});
afterEach(() => {
  HTMLElement.prototype.getClientRects = realGetClientRects;
  vi.restoreAllMocks();
  vi.useRealTimers();
  history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('data-layout');
  document.documentElement.removeAttribute('data-compact');
});

describe('獲得提示（HintToast）', () => {
  it('進入 02：「獲得 8 個新伏筆」，徽章顯示 8；3 秒後消失', () => {
    vi.useFakeTimers();
    start('#/axis/2');
    const toast = document.querySelector('[data-hint-toast]')!;
    expect(toast).toHaveTextContent('獲得 8 個新伏筆');
    expect(toast).toHaveTextContent('已獲得 8 個伏筆');
    expect(screen.getByLabelText('已獲得 8 個伏筆')).toHaveTextContent('8');
    act(() => vi.advanceTimersByTime(HINT_TOAST_MS - 50));
    expect(document.querySelector('[data-hint-toast]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(100));
    expect(document.querySelector('[data-hint-toast]')).toBeNull();
  });

  it('進入 01：單個顯示關鍵字「獲得新伏筆：忘了送的禮物」', () => {
    start('#/axis/1');
    expect(document.querySelector('[data-hint-toast]')).toHaveTextContent('獲得新伏筆：忘了送的禮物');
  });

  it('滑鼠移入暫停計時，移出後才開始倒數', () => {
    vi.useFakeTimers();
    start('#/axis/2');
    const toast = document.querySelector('[data-hint-toast]')!;
    fireEvent.pointerEnter(toast);
    act(() => vi.advanceTimersByTime(HINT_TOAST_MS * 3));
    expect(document.querySelector('[data-hint-toast]')).not.toBeNull();
    fireEvent.pointerLeave(toast);
    act(() => vi.advanceTimersByTime(HINT_TOAST_MS + 50));
    expect(document.querySelector('[data-hint-toast]')).toBeNull();
  });
});

describe('托盤（舞台版）', () => {
  it('沒有伏筆：開啟後顯示空狀態文字', async () => {
    start('#/');
    await userEvent.click(dockHints());
    const tray = document.querySelector('[data-hint-tray]')!;
    expect(tray).toHaveTextContent('還沒有伏筆');
    expect(tray.querySelector('[data-hint-keyword]')).toBeNull();
  });

  it('列出已獲得的關鍵字；已解開者在前、顯示 ✓ 且不可選；計數含已解開數', async () => {
    start('#/axis/2');
    useAppStore.setState({ hints: { ...store().hints, solved: ['first-cold'] } });
    await userEvent.click(dockHints());
    const tray = document.querySelector<HTMLElement>('[data-hint-tray]')!;
    expect(tray).toHaveTextContent('已獲得 8 個伏筆 · 已解開 1');
    const chips = [...tray.querySelectorAll<HTMLElement>('[data-hint-keyword]')];
    expect(chips).toHaveLength(8);
    expect(chips[0]).toHaveAttribute('data-hint-keyword', 'first-cold');
    expect(chips[0]).toHaveAttribute('data-state', 'solved');
    expect(chips[0]).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(chips[0]!);
    expect(store().hints.selected).toBeNull();
  });

  it('點關鍵字選取（再點取消）；選取中的關鍵字為 selected 狀態；Esc 取消選取', async () => {
    start('#/axis/2');
    await userEvent.click(dockHints());
    await userEvent.click(keyword('cold-hand'));
    expect(store().hints.selected).toBe('cold-hand');
    expect(keyword('cold-hand')).toHaveAttribute('data-state', 'selected');
    expect(keyword('cold-hand')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(keyword('cold-hand'));
    expect(store().hints.selected).toBeNull();
    await userEvent.click(keyword('cold-hand'));
    await userEvent.keyboard('{Escape}');
    expect(store().hints.selected).toBeNull();
  });

  it('鍵盤：聚焦關鍵字按 Enter 選取', async () => {
    start('#/axis/2');
    await userEvent.click(dockHints());
    keyword('cold-hand').focus();
    await userEvent.keyboard('{Enter}');
    expect(store().hints.selected).toBe('cold-hand');
  });

  it('收合按鈕關閉托盤', async () => {
    start('#/axis/2');
    await userEvent.click(dockHints());
    await userEvent.click(screen.getByRole('button', { name: '收合伏筆托盤' }));
    expect(useUiStore.getState().hintsTrayOpen).toBe(false);
  });
});

describe('框格（舞台版，錨點以假 rect 量測）', () => {
  beforeEach(() => mockAnchorRects());

  async function open03() {
    start('#/axis/3');
    ownAll();
    act(() => store().selectEvent(3, 6));
    await untilEvent('地底大洞');
    await userEvent.click(dockHints());
  }

  it('事件 06 有 3 個框格，依錨點由上到下排在旁註欄，互不重疊', async () => {
    await open03();
    const ids = [...document.querySelectorAll('[data-hint-slot]')].map((el) => el.getAttribute('data-hint-slot'));
    expect(ids).toEqual(['useful-to-witch', 'forgotten-gift', 'spirit-scent']);
    const tops = [...document.querySelectorAll<HTMLElement>('[data-hint-cell]')].map((el) => parseFloat(el.style.top));
    for (let i = 1; i < tops.length; i++) expect(tops[i]! - tops[i - 1]!).toBeGreaterThanOrEqual(28 + 8 - 0.01);
    for (const cell of document.querySelectorAll<HTMLElement>('[data-hint-cell]'))
      expect(cell.style.left).toBe('476px');
    expect(document.querySelectorAll('[data-hint-arc]')).toHaveLength(3);
  });

  it('空框格：「伏筆」灰色雙線框＋虛線弧線；有關鍵字被選中時全部變「可以放置」', async () => {
    await open03();
    expect(slot('forgotten-gift')).toHaveAttribute('data-state', 'empty');
    expect(slot('forgotten-gift')).toHaveTextContent('伏筆');
    expect(document.querySelector('[data-hint-arc="forgotten-gift"] .hint-arc')).toHaveAttribute('data-dim');
    await userEvent.click(keyword('forgotten-gift'));
    for (const id of ['useful-to-witch', 'forgotten-gift', 'spirit-scent']) {
      expect(slot(id)).toHaveAttribute('data-state', 'ready');
      expect(slot(id)).toHaveTextContent('點這裡放入');
    }
    act(() => useUiStore.getState().setHintDragging(true));
    expect(slot('forgotten-gift')).toHaveTextContent('放開以放入');
  });

  it('點選放置——答對：鎖定、顯示關鍵字與解開後說明、錨點底線變灰、框格閃動；其他框格回到空', async () => {
    await open03();
    await userEvent.click(keyword('forgotten-gift'));
    await userEvent.click(slot('forgotten-gift'));
    expect(slot('forgotten-gift')).toHaveAttribute('data-state', 'solved');
    expect(slot('forgotten-gift')).toHaveTextContent('忘了送的禮物');
    expect(slot('forgotten-gift')).toHaveAttribute('data-flash');
    expect(document.querySelector('[data-hint-explain="forgotten-gift"]')).toHaveTextContent(
      '法恩一直忘了送給德雷文的馬蹄鐵吊飾，在地底生了火。',
    );
    expect(document.querySelector('[data-hint="forgotten-gift"]')).toHaveAttribute('data-solved');
    expect(slot('spirit-scent')).toHaveAttribute('data-state', 'empty');
    expect(keyword('forgotten-gift')).toHaveAttribute('data-state', 'solved');
    expect(screen.getByText('答對了：忘了送的禮物')).toBeInTheDocument(); // aria-live
  });

  it('點選放置——答錯：框格震動並顯示「不是這個」、關鍵字回托盤（選取清除）；300ms 後恢復', async () => {
    await open03();
    await userEvent.click(keyword('spirit-scent'));
    await userEvent.click(slot('forgotten-gift'));
    expect(slot('forgotten-gift')).toHaveAttribute('data-state', 'wrong');
    expect(slot('forgotten-gift')).toHaveAttribute('data-shake');
    expect(slot('forgotten-gift')).toHaveTextContent('不是這個');
    expect(store().hints.selected).toBeNull();
    expect(keyword('spirit-scent')).toHaveAttribute('data-state', 'idle');
    expect(store().hints.solved).toEqual([]);
    await vi.waitFor(() => expect(slot('forgotten-gift')).toHaveAttribute('data-state', 'empty'), {
      timeout: 1000,
    });
  });

  it('鍵盤：Enter 選取關鍵字、聚焦框格按 Enter 放入', async () => {
    await open03();
    keyword('forgotten-gift').focus();
    await userEvent.keyboard('{Enter}');
    slot('forgotten-gift').focus();
    await userEvent.keyboard('{Enter}');
    expect(store().hints.solved).toEqual(['forgotten-gift']);
  });

  it('沒有選取時點框格不做事；尚未獲得的關鍵字其框格仍顯示（探索提示）', async () => {
    start('#/axis/3');
    act(() => store().selectEvent(3, 6));
    await untilEvent('地底大洞');
    await userEvent.click(slot('forgotten-gift'));
    expect(slot('forgotten-gift')).toHaveAttribute('data-state', 'empty');
    expect(store().hints.owned).not.toContain('forgotten-gift');
  });

  it('切換事件：框格跟著換成新事件的回收處（事件 03 只有「神語」一個）', async () => {
    await open03();
    act(() => store().selectEvent(3, 3));
    await untilEvent('主教發狂');
    const ids = [...document.querySelectorAll('[data-hint-slot]')].map((el) => el.getAttribute('data-hint-slot'));
    expect(ids).toEqual(['divine-language']);
  });
});

describe('流式版：註記列、說明條、底部面板', () => {
  async function open03Flow() {
    start('#/axis/3', [390, 844]);
    ownAll();
    act(() => store().selectEvent(3, 6));
    await untilEvent('地底大洞');
  }

  it('敘述裡有 2 個註記列（display:block）：第一列 1 個框格，第二列 2 個並排；沒有旁註欄框格層', async () => {
    await open03Flow();
    const rows = [...document.querySelectorAll<HTMLElement>('[data-note-row]')];
    expect(rows.map((r) => r.dataset.hints)).toEqual(['useful-to-witch', 'forgotten-gift,spirit-scent']);
    for (const row of rows) expect(row.style.display).toBe('block');
    expect(document.querySelector('[data-hint-layer]')).toBeNull();
  });

  it('註記列在回收片語之後的第一個標點之後（前一段文字以標點結尾）', async () => {
    await open03Flow();
    const row = document.querySelector('[data-note-row]')!;
    expect(row.previousSibling?.textContent).toMatch(/深入地底.*，$|，$/);
    expect(row.previousSibling?.textContent?.endsWith('，')).toBe(true);
  });

  it('托盤是導覽列上方的底部面板；選取關鍵字時頁面上方出現說明條，點「取消」清除', async () => {
    await open03Flow();
    await userEvent.click(dockHints());
    const tray = document.querySelector('[data-hint-tray]')!;
    expect(tray).toHaveClass('fixed');
    expect(document.querySelector('[data-hint-banner]')).toBeNull();
    await userEvent.click(keyword('forgotten-gift'));
    const banner = document.querySelector('[data-hint-banner]')!;
    expect(banner).toHaveTextContent('已選「忘了送的禮物」，點頁面上的框格放入。');
    await userEvent.click(within(banner as HTMLElement).getByRole('button', { name: '取消' }));
    expect(store().hints.selected).toBeNull();
    expect(document.querySelector('[data-hint-banner]')).toBeNull();
  });

  it('只用點選：關鍵字沒有拖曳處理；點框格放入、答對鎖定', async () => {
    await open03Flow();
    await userEvent.click(dockHints());
    await userEvent.click(keyword('forgotten-gift'));
    expect(slot('forgotten-gift')).toHaveTextContent('點這裡放入');
    await userEvent.click(slot('forgotten-gift'));
    expect(slot('forgotten-gift')).toHaveAttribute('data-state', 'solved');
    expect(document.querySelector('[data-hint-drag-image]')).toBeNull();
  });
});
