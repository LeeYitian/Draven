import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { currentHash } from '../../src/lib/hash-router';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

function start(hash: string, size: [number, number]) {
  history.replaceState(null, '', `/${hash}`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
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

const SIZES: Array<[string, [number, number]]> = [
  ['舞台版 1440×720', [1440, 720]],
  ['流式版 390×844', [390, 844]],
];

describe.each(SIZES)('00 世界觀導讀（%s）', (_name, size) => {
  it('顯示標題、導言、核心關係、三個世界、四條主軸', () => {
    start('#/', size);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: '世界觀導讀' })).toBeInTheDocument();
    expect(main.textContent).toContain('人類主導的王國裡');
    expect(main.textContent).toContain('核心關係');
    expect(main.textContent).toContain('三個世界');
    expect(main.textContent).toContain('四條主軸');
    expect(main.textContent).toContain('長生的母親、會老去的國王、急著長大的孩子');
  });

  it('核心關係：艾莉絲 —養母→ 德雷文 —養父→ 艾利安（人名可點）', () => {
    start('#/', size);
    const main = screen.getByRole('main');
    for (const name of ['艾莉絲', '德雷文', '艾利安']) {
      expect(within(main).getAllByRole('button', { name }).length).toBeGreaterThan(0);
    }
    expect(main.textContent).toContain('養母');
    expect(main.textContent).toContain('養父');
  });

  it('三個世界：名稱與說明（名詞可點）', () => {
    start('#/', size);
    const main = screen.getByRole('main');
    for (const name of ['人間', '地底交界', '異界']) {
      expect(within(main).getByRole('button', { name })).toHaveClass('link-term');
    }
    expect(within(main).getByRole('button', { name: '魔女集會' })).toHaveClass('link-term');
    expect(main.textContent).toContain('昏睡氣味瀰漫');
  });

  it('四條主軸：整列可點，進入該主軸', async () => {
    start('#/', size);
    const main = screen.getByRole('main');
    const rows = within(main).getAllByRole('button', { name: /0[1-4]/ });
    expect(rows).toHaveLength(4);
    expect(rows[1]!.textContent).toContain('魔女集會與時間考驗');
    await userEvent.click(rows[2]!);
    expect(currentHash()).toBe('#/axis/3');
  });

  it('不再有「出場人物」區塊（已移到人物誌）', () => {
    start('#/', size);
    expect(screen.getByRole('main').textContent).not.toContain('出場人物');
  });
});

describe('00 舞台版專屬', () => {
  it('有「↓ 進入第一主軸」提示；↓ 鍵進入 01', async () => {
    start('#/', [1440, 720]);
    expect(screen.getByRole('main').textContent).toContain('進入第一主軸');
    await userEvent.keyboard('{ArrowDown}');
    expect(currentHash()).toBe('#/axis/1');
  });

  it('三欄網格：440／1fr／1fr、欄距 56，內容區 x112 寬 1288', () => {
    start('#/', [1440, 720]);
    const main = screen.getByRole('main');
    expect(main.style.left).toBe('112px');
    expect(main.style.width).toBe('1288px');
    expect(main.style.gridTemplateColumns).toBe('440px minmax(0, 1fr) minmax(0, 1fr)');
    expect(main.style.columnGap).toBe('56px');
  });
});

describe('00 流式版專屬', () => {
  it('單欄捲動、沒有舞台，沒有方向鍵提示', () => {
    start('#/', [390, 844]);
    expect(document.querySelector('[data-stage]')).toBeNull();
    expect(screen.getByRole('main').textContent).not.toContain('進入第一主軸');
  });
});
