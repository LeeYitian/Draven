import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

function start(size: [number, number] = [1440, 720]) {
  history.replaceState(null, '', '/#/');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreForTests();
});
afterEach(() => {
  history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('data-layout');
  document.documentElement.removeAttribute('data-compact');
});

/** 弄出一份「已經玩過」的進度 */
function dirty() {
  act(() => {
    const s = useAppStore.getState();
    s.setPage(1);
    s.setPage(2);
    s.trackPerson('elian');
    s.unlockPage04();
    s.setCompare(70);
    s.setSpectrum(30);
    s.selectEvent(3, 4);
    s.setPage(0);
  });
}

describe('重置進度（00 頁）', () => {
  it('第一下只出現確認，不會直接重置；取消後什麼都沒變', async () => {
    start();
    dirty();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '重置進度' }));
    expect(screen.getByText(/清除追蹤、伏筆與 04 的遮罩紀錄/)).toBeInTheDocument();
    expect(useAppStore.getState().trackedPersonId).toBe('elian');
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByText(/清除追蹤/)).toBeNull();
    expect(useAppStore.getState().trackedPersonId).toBe('elian');
    expect(useAppStore.getState().hints.owned.length).toBeGreaterThan(0);
  });

  it('確定重置：追蹤、伏筆、04 遮罩、各頁事件進度與專屬區塊狀態、儲存都清掉', async () => {
    start();
    dirty();
    expect(useAppStore.getState().hints.owned.length).toBeGreaterThan(0);
    expect(localStorage.getItem('draven:tracked')).not.toBeNull();
    expect(sessionStorage.getItem('draven:page04Unlocked')).not.toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '重置進度' }));
    await user.click(screen.getByRole('button', { name: '確定重置' }));
    const s = useAppStore.getState();
    expect(s.trackedPersonId).toBeNull();
    expect(s.hints).toMatchObject({ owned: [], solved: [], selected: null });
    expect(s.page04Unlocked).toBe(false);
    expect(s.axis[3].eventIndex).toBe(0);
    expect(s.compareSlider).toBe(50);
    expect(s.spectrum).toBe(100);
    expect(localStorage.getItem('draven:tracked')).toBeNull();
    expect(localStorage.getItem('draven:hints')).toBeNull();
    expect(sessionStorage.getItem('draven:page04Unlocked')).toBeNull();
    // 確認列收起來、播報區通知
    expect(screen.queryByText(/清除追蹤/)).toBeNull();
    expect(useUiStore.getState().announcement?.text).toBe('已重置進度');
  });

  it('流式版也有入口', () => {
    start([390, 844]);
    expect(screen.getByRole('button', { name: '重置進度' })).toBeInTheDocument();
  });
});
