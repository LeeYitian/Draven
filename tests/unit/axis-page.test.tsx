import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';
import { drawProgress, easeDraw } from '../../src/features/graph/useEdgeReveal';

// 01 主軸頁（舞台版與流式版）的組裝測試。jsdom 沒有版面，所以座標用設計尺寸當後備值；
// 實際的位置、重疊與動畫在 Playwright e2e 驗證。

function start(hash = '#/axis/1', size: [number, number] = [1440, 720]) {
  history.replaceState(null, '', `/${hash}`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
  return render(<App />);
}
const axis1 = () => useAppStore.getState().axis[1];
const edgeState = (id: string) =>
  document.querySelector(`[data-edge="${id}"]`)?.getAttribute('data-state');

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

describe('01 主軸頁（舞台版）', () => {
  it('頁首、6 個事件格、敘述面板與 8 個節點', () => {
    start();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('統一之杖：荊棘之王德雷文');
    const bar = screen.getByRole('group', { name: '事件進程' });
    const cells = within(bar).getAllByRole('button');
    expect(cells).toHaveLength(6);
    expect(cells[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('政策佈局');
    expect(document.querySelectorAll('[data-node]')).toHaveLength(8);
    expect(document.querySelectorAll('[data-node][data-group]')).toHaveLength(3);
  });

  it('事件格的三種狀態：已過、目前、未到', async () => {
    start();
    act(() => useAppStore.getState().selectEvent(1, 3));
    const states = [...document.querySelectorAll('[data-event]')].map((c) =>
      c.getAttribute('data-state'),
    );
    expect(states).toEqual(['past', 'past', 'current', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('點事件：切換目前事件與焦點；敘述淡出 120ms 後換成新事件', () => {
    vi.useFakeTimers();
    start();
    fireEvent.click(document.querySelector('[data-event="3"]')!);
    expect(axis1().eventIndex).toBe(2);
    expect(axis1().focus).toEqual({ type: 'event', n: 3 });
    // 淡出中：仍顯示舊事件、透明
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('政策佈局');
    expect(document.querySelector<HTMLElement>('[data-narrative-body]')!.style.opacity).toBe('0');
    act(() => vi.advanceTimersByTime(130));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('朝堂博弈');
    expect(document.querySelector<HTMLElement>('[data-narrative-body]')!.style.opacity).toBe('1');
  });

  it('← → 推進事件並聚焦；邊界不動作', async () => {
    start();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(axis1().eventIndex).toBe(2);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(axis1().eventIndex).toBe(0);
  });

  it('連線依事件累積：事件 1 只有背景關係；事件 3 加上朝堂三條；尚未到的 unrevealed', () => {
    start();
    expect(edgeState('dravin-elian')).toBe('dim'); // 背景關係已畫出，但不是事件 1 新畫的
    expect(edgeState('dravin-fane')).toBe('unrevealed');
    act(() => useAppStore.getState().selectEvent(1, 3));
    expect(edgeState('dravin-old')).toBe('lit');
    expect(edgeState('minor-old')).toBe('lit');
    expect(edgeState('dravin-fane')).toBe('dim');
    expect(edgeState('fane-bren')).toBe('unrevealed');
  });

  it('點節點：只聚焦（aria-pressed）、不改事件、不開 Popover，事件列標出該節點出場的事件', () => {
    start();
    act(() => useAppStore.getState().selectEvent(1, 3));
    fireEvent.click(document.querySelector('[data-node="fane"]')!);
    expect(axis1().focus).toEqual({ type: 'node', id: 'fane' });
    expect(axis1().eventIndex).toBe(2);
    expect(document.querySelector('[data-node="fane"]')).toHaveAttribute('aria-pressed', 'true');
    expect(usePopoverStore.getState().open).toBeNull();
    const marked = [...document.querySelectorAll('[data-event][data-marked]')].map((c) =>
      c.getAttribute('data-event'),
    );
    expect(marked).toEqual(['2', '3', '5', '6']);
    // 再點同一個節點：回到目前事件的焦點
    fireEvent.click(document.querySelector('[data-node="fane"]')!);
    expect(axis1().focus).toEqual({ type: 'event', n: 3 });
  });

  it('節點可用鍵盤聚焦：Enter 與空白鍵', async () => {
    start();
    const node = document.querySelector<HTMLElement>('[data-node="elis"]')!;
    node.focus();
    await userEvent.keyboard('{Enter}');
    expect(axis1().focus).toEqual({ type: 'node', id: 'elis' });
    await userEvent.keyboard(' ');
    expect(axis1().focus).toEqual({ type: 'event', n: 1 });
  });

  it('追蹤法恩：他出場的事件掛書籤（2、3、5、6）', () => {
    start();
    act(() => useAppStore.getState().trackPerson('fane'));
    const tracked = [...document.querySelectorAll('[data-event][data-tracked]')].map((c) =>
      c.getAttribute('data-event'),
    );
    expect(tracked).toEqual(['2', '3', '5', '6']);
  });

  it('圖例：關掉「衝突」隱藏衝突線；關掉「群體」隱藏群體節點與其連線', async () => {
    start();
    act(() => useAppStore.getState().selectEvent(1, 6));
    await userEvent.click(screen.getByRole('button', { name: '衝突' }));
    expect(document.querySelector('[data-edge="dravin-old"]')).toHaveAttribute('data-hidden');
    expect(document.querySelector('[data-edge="dravin-fane"]')).not.toHaveAttribute('data-hidden');
    await userEvent.click(screen.getByRole('button', { name: '群體' }));
    expect(document.querySelectorAll('[data-node][data-hidden]')).toHaveLength(3);
    expect(document.querySelector('[data-edge="dravin-minor"]')).toHaveAttribute('data-hidden');
    await userEvent.click(screen.getByRole('button', { name: '群體' }));
    expect(document.querySelectorAll('[data-node][data-hidden]')).toHaveLength(0);
  });

  it('線段標籤開關：舞台預設開，點一下關閉；關閉後文字不可見', async () => {
    start();
    act(() => useAppStore.getState().selectEvent(1, 3));
    const labels = () =>
      [...document.querySelectorAll('.edge__label')].map((l) => l.getAttribute('data-visible'));
    const toggle = screen.getByRole('button', { name: '線段標籤' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(labels().filter((v) => v === 'true').length).toBeGreaterThan(0);
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(labels().every((v) => v === 'false')).toBe(true);
  });

  it('縮放：按鈕 ±25%，範圍 50–200%；出現重設鈕，按下回到 100%', async () => {
    start();
    await userEvent.click(screen.getByRole('button', { name: '放大' }));
    expect(document.querySelector('[data-zoom-level]')).toHaveTextContent('125%');
    await userEvent.click(screen.getByRole('button', { name: '重設' }));
    expect(document.querySelector('[data-zoom-level]')).toHaveTextContent('100%');
    for (let i = 0; i < 6; i++) await userEvent.click(screen.getByRole('button', { name: '縮小' }));
    expect(document.querySelector('[data-zoom-level]')).toHaveTextContent('50%');
    expect(screen.getByRole('button', { name: '縮小' })).toBeDisabled();
  });

  it('螢幕閱讀器清單：只列出已畫出的關係', () => {
    start();
    const list = () => screen.getByRole('list', { name: '目前已畫出的人物關係' });
    expect(within(list()).getAllByRole('listitem')).toHaveLength(1);
    act(() => useAppStore.getState().selectEvent(1, 2));
    expect(within(list()).getAllByRole('listitem')).toHaveLength(3);
    expect(list()).toHaveTextContent('德雷文 → 法恩：任命特使・遴選子弟');
  });

  it('事件 5 的「見下方 ↓」交叉連結存在（光譜區塊於 Phase 8 實作）', () => {
    start();
    act(() => useAppStore.getState().selectEvent(1, 5));
    return vi.waitFor(() =>
      expect(screen.getByRole('button', { name: '見下方 ↓' })).toBeInTheDocument(),
    );
  });

  it('只有舞台版第一次進入顯示方向鍵提示，之後不再顯示', () => {
    vi.useFakeTimers();
    const first = start();
    expect(document.querySelector('[data-keys-hint]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(2750)); // 淡出中（仍在 DOM、透明）
    expect(document.querySelector<HTMLElement>('[data-keys-hint]')!.style.opacity).toBe('0');
    act(() => vi.advanceTimersByTime(300));
    expect(document.querySelector('[data-keys-hint]')).toBeNull();
    first.unmount();
    start();
    expect(document.querySelector('[data-keys-hint]')).toBeNull();
  });
});

describe('01 主軸頁（流式版）', () => {
  it('敘述下方有「上一個／下一個」；到邊界時停用；不處理方向鍵', async () => {
    start('#/axis/1', [390, 844]);
    expect(document.querySelector('[data-stage]')).toBeNull();
    const prev = screen.getByRole('button', { name: '← 上一個' });
    const next = screen.getByRole('button', { name: '下一個 →' });
    expect(prev).toBeDisabled();
    await userEvent.click(next);
    expect(axis1().eventIndex).toBe(1);
    expect(prev).toBeEnabled();
    await userEvent.keyboard('{ArrowRight}');
    expect(axis1().eventIndex).toBe(1);
  });

  it('事件列顯示「n / N · 左右滑動」；沒有舞台版的方向鍵提示', () => {
    start('#/axis/1', [390, 844]);
    expect(screen.getByText('01 / 06 · 左右滑動')).toBeInTheDocument();
    expect(document.querySelector('[data-keys-hint]')).toBeNull();
  });

  it('流式版線上文字預設關閉；點「線段標籤」才開', async () => {
    start('#/axis/1', [390, 844]);
    act(() => useAppStore.getState().selectEvent(1, 3));
    const toggle = screen.getByRole('button', { name: '線段標籤' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('點節點即聚焦；圖例列與操作提示存在', () => {
    start('#/axis/1', [390, 844]);
    fireEvent.click(document.querySelector('[data-node="bren"]')!);
    expect(axis1().focus).toEqual({ type: 'node', id: 'bren' });
    expect(document.querySelector('[data-graph-legend]')).toHaveTextContent('點圖例開關線種');
  });
});

describe('畫線進度（純函式）', () => {
  it('依序各 400ms、間隔 120ms：第 1 條 0–400，第 2 條 520–920', () => {
    expect(drawProgress(0, 0)).toBe(0);
    expect(drawProgress(200, 0)).toBeCloseTo(0.5);
    expect(drawProgress(400, 0)).toBe(1);
    expect(drawProgress(519, 1)).toBe(0);
    expect(drawProgress(720, 1)).toBeCloseTo(0.5);
    expect(drawProgress(920, 1)).toBe(1);
    expect(drawProgress(-50, 0)).toBe(0);
  });

  it('緩動：端點不變、前半段較快', () => {
    expect(easeDraw(0)).toBe(0);
    expect(easeDraw(1)).toBe(1);
    expect(easeDraw(0.5)).toBeGreaterThan(0.5);
  });
});
