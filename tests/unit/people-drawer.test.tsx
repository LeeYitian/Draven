import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { people } from '../../src/content';
import { currentHash, openPeople } from '../../src/lib/hash-router';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

function start(hash: string, size: [number, number] = [1440, 720]) {
  history.replaceState(null, '', `/${hash}`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size[0] });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: size[1] });
  return render(<App />);
}
const drawer = () => document.querySelector<HTMLElement>('[data-people-drawer]');
const card = (id: string) => document.querySelector<HTMLElement>(`[data-person="${id}"]`)!;
const slotOf = (id: string) => document.querySelector<HTMLElement>(`[data-person-slot="${id}"]`)!;
const cards = () => [...document.querySelectorAll<HTMLElement>('[data-person]')];
const store = () => useAppStore.getState();

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

describe('人物誌：開啟、進度與登場', () => {
  it('開啟人物誌：15 張卡、dialog 語意、底下的頁面與側欄 inert', () => {
    start('#/axis/2');
    act(() => openPeople());
    expect(drawer()).not.toBeNull();
    expect(drawer()).toHaveAttribute('role', 'dialog');
    expect(cards()).toHaveLength(15);
    expect(document.querySelector('[data-stage] > .contents')).toHaveAttribute('inert');
  });

  it('在 02 開啟：第一次出場主軸 ≤ 02 的人彩色（data-on），其餘灰階；進度標示 02', () => {
    start('#/axis/2');
    act(() => openPeople());
    expect(drawer()).toHaveTextContent('目前進度 02');
    for (const p of people)
      expect(card(p.id).hasAttribute('data-on'), p.name).toBe(p.firstAppearance.axis <= 2);
  });

  it('在 00 或直接由 #/people 進入：全部灰階（進度 00）', () => {
    start('#/people');
    expect(drawer()).toHaveTextContent('目前進度 00');
    expect(document.querySelectorAll('[data-person][data-on]')).toHaveLength(0);
  });

  it('不記錄最遠進度：回到 01 再開，彩色的人比 03 時少', () => {
    start('#/axis/3');
    act(() => openPeople());
    const at3 = document.querySelectorAll('[data-person][data-on]').length;
    act(() => useAppStore.getState().setPage(1));
    const at1 = document.querySelectorAll('[data-person][data-on]').length;
    expect(at1).toBeLessThan(at3);
  });

  it('04 遮罩沒打開前進度算 03', () => {
    start('#/axis/4');
    act(() => openPeople());
    expect(drawer()).toHaveTextContent('目前進度 03');
  });
});

describe('人物誌：關閉', () => {
  it('✕ 關閉並回到原頁（hash 還原、頁面進度不變）', async () => {
    start('#/axis/2');
    act(() => openPeople());
    await userEvent.click(screen.getByRole('button', { name: '關閉人物誌' }));
    await waitFor(() => expect(currentHash()).toBe('#/axis/2'));
    await waitFor(() => expect(drawer()).toBeNull());
    expect(store().page).toBe(2);
  });

  it('Esc 關閉；直接由 #/people 進入者關閉後回到 00', async () => {
    start('#/people');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(currentHash()).toBe('#/'));
    await waitFor(() => expect(drawer()).toBeNull());
  });

  it('關閉後底下頁面不再 inert', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(drawer()).toBeNull());
    expect(document.querySelector('[data-stage] > .contents')).not.toHaveAttribute('inert');
  });

  it('人物誌開啟時 ←→ ↑↓ 不處理（不換事件、不換頁）', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    expect(store().axis[1].eventIndex).toBe(0);
    expect(store().page).toBe(1);
  });
});

describe('人物誌：標籤選中', () => {
  it('點標籤：該標籤的人（含未登場者）浮起，其他卡片不隱藏、位置不變；再點同一個取消；點另一個取代', async () => {
    start('#/axis/1');
    act(() => openPeople());
    const before = Object.fromEntries(people.map((p) => [p.id, slotOf(p.id).style.transform]));
    await userEvent.click(document.querySelector('[data-filter="tag:family"]')!);
    const selected = cards().filter((c) => c.hasAttribute('data-selected')).map((c) => c.dataset.person);
    const expected = people.filter((p) => (p.tags as string[]).includes('family')).map((p) => p.id);
    expect(selected.sort()).toEqual(expected.sort());
    expect(cards()).toHaveLength(15); // 不隱藏
    for (const p of people) expect(slotOf(p.id).style.transform, p.name).toBe(before[p.id]); // 不重排
    // 利歐蘭 01 未登場、但屬於家人：浮起＋灰階（兩個獨立通道）
    expect(card('lioran')).toHaveAttribute('data-selected');
    expect(card('lioran')).not.toHaveAttribute('data-on');
    expect(drawer()).toHaveTextContent(`已選中 ${expected.length} 人`);

    await userEvent.click(document.querySelector('[data-filter="group:coven"]')!);
    expect(store().people.tag).toBe('group:coven');
    expect(card('dravin')).not.toHaveAttribute('data-selected');
    expect(card('elis')).toHaveAttribute('data-selected');

    await userEvent.click(document.querySelector('[data-filter="group:coven"]')!);
    expect(store().people.tag).toBeNull();
    expect(document.querySelectorAll('[data-person][data-selected]')).toHaveLength(0);
  });

  it('主軸標籤：01 選中出現在 01 的人（德雷文、法恩…），維洛不在其中', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(document.querySelector('[data-filter="axis:1"]')!);
    expect(card('fane')).toHaveAttribute('data-selected');
    expect(card('velo')).not.toHaveAttribute('data-selected');
  });
});

describe('人物誌：排列', () => {
  it('切換排列只換位置（transform），15 張卡都還在；依群體有欄標題、依出場順序沒有', async () => {
    start('#/axis/1');
    act(() => openPeople());
    expect(document.querySelectorAll('[data-heading]')).toHaveLength(5);
    const group = slotOf('fane').style.transform;
    await userEvent.click(screen.getByRole('radio', { name: '依出場順序' }));
    expect(document.querySelectorAll('[data-heading]')).toHaveLength(0);
    expect(slotOf('fane').style.transform).not.toBe(group);
    expect(cards()).toHaveLength(15);
    await userEvent.click(screen.getByRole('radio', { name: '依所在世界' }));
    expect([...document.querySelectorAll('[data-heading]')].map((h) => h.getAttribute('data-heading'))).toEqual([
      'human',
      'underground',
      'otherworld',
    ]);
  });

  it('排列方式在人物誌關閉後保留（只重設中心與展開）', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(screen.getByRole('radio', { name: '依出場順序' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(drawer()).toBeNull());
    act(() => openPeople());
    expect(screen.getByRole('radio', { name: '依出場順序' })).toBeChecked();
  });
});

describe('人物誌：中心視角與展開', () => {
  it('點卡片：以他為中心（金色全框）、其他卡變精簡卡；排列切換停用；顯示「以 X 為中心」', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(card('elian'));
    expect(store().people.center).toBe('elian');
    expect(card('elian')).toHaveAttribute('data-center');
    expect(card('dravin')).toHaveAttribute('data-compact');
    expect(card('elian')).not.toHaveAttribute('data-compact');
    expect(drawer()).toHaveTextContent('以 艾利安 為中心');
    expect(screen.getByRole('radiogroup', { name: '排列' })).toHaveAttribute('aria-disabled', 'true');
    // 關係線：進度 01 時艾利安與德雷文、艾莉絲、法恩有關係
    const lines = [...document.querySelectorAll('[data-rel]')].map((l) => l.getAttribute('data-rel'));
    expect(lines.sort()).toEqual(['dravin', 'elis', 'fane']);
    // 沒有直接關係者 0.7 透明度、在右側
    expect(slotOf('rumi').style.opacity).toBe('0.7');
    expect(slotOf('dravin').style.opacity).toBe('1');
  });

  it('關係線上的文字是合併後的關係（01：德雷文—艾利安「養父子」、艾莉絲—艾利安「同行」）', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(card('elian'));
    const label = (id: string) => document.querySelector(`[data-rel="${id}"] .rel__label`)?.textContent;
    expect(label('dravin')).toBe('養父子');
    expect(label('elis')).toBe('同行');
  });

  it('進度 00（直接進入）：任何人為中心都沒有關係線，其餘 14 人全在右側', async () => {
    start('#/people');
    await userEvent.click(card('dravin'));
    expect(document.querySelectorAll('[data-rel]')).toHaveLength(0);
    expect(cards().filter((c) => slotOf(c.dataset.person!).style.opacity === '0.7')).toHaveLength(14);
  });

  it('點中心卡：展開完整介紹浮層；劇透預設不渲染真實文字，點擊才顯示、可再隱藏', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(card('elian'));
    await userEvent.click(card('elian'));
    expect(store().people.expanded).toBe(true);
    const panel = document.querySelector<HTMLElement>('[data-expanded-panel]')!;
    expect(panel).toHaveAttribute('role', 'dialog');
    expect(panel).toHaveTextContent('人類孤兒，十歲');
    const spoilerText = people.find((p) => p.id === 'elian')!.bio.find((b) => b.type === 'spoiler')!.text;
    expect(document.body.textContent).not.toContain(spoilerText); // 真實文字不在 DOM 中
    expect(panel).toHaveTextContent('讀完第 02 主軸後解鎖（點擊仍可查看）');

    await userEvent.click(within(panel).getByRole('button', { name: /劇透 · 02/ }));
    expect(panel).toHaveTextContent(spoilerText.slice(0, 12));
    expect(panel).toHaveTextContent('劇透 · 02 · 已顯示');
    await userEvent.click(within(panel).getByRole('button', { name: '隱藏' }));
    expect(document.body.textContent).not.toContain(spoilerText);
  });

  it('劇透只由點擊決定：進度到了該主軸也不會自動打開', async () => {
    start('#/axis/3');
    act(() => openPeople());
    await userEvent.click(card('elian'));
    await userEvent.click(card('elian'));
    const spoilerText = people.find((p) => p.id === 'elian')!.bio.find((b) => b.type === 'spoiler')!.text;
    expect(document.body.textContent).not.toContain(spoilerText);
    expect(document.querySelector('[data-expanded-panel]')).toHaveTextContent('顯示劇透'); // 已讀過：提示改為「顯示劇透」
  });

  it('Esc：展開時先收浮層（人物誌仍開著），再按一次才關人物誌', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(card('elian'));
    await userEvent.click(card('elian'));
    await userEvent.keyboard('{Escape}');
    expect(store().people.expanded).toBe(false);
    expect(drawer()).not.toBeNull();
    expect(currentHash()).toBe('#/people');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(currentHash()).toBe('#/axis/1'));
  });

  it('點浮層外（scrim）收合；點「以 X 為中心 ×」回到網格排列', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(card('elian'));
    await userEvent.click(card('elian'));
    fireEvent.click(document.querySelector('[data-expanded-scrim]')!);
    expect(store().people.expanded).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: '取消中心視角' }));
    expect(store().people.center).toBeNull();
    expect(screen.getByRole('radiogroup', { name: '排列' })).not.toHaveAttribute('aria-disabled');
  });

  it('點另一個人＝換中心並收合展開', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(card('elian'));
    await userEvent.click(card('elian'));
    fireEvent.click(document.querySelector('[data-expanded-scrim]')!);
    await userEvent.click(card('dravin'));
    expect(store().people.center).toBe('dravin');
    expect(store().people.expanded).toBe(false);
  });
});

describe('人物誌：追蹤', () => {
  it('點卡上的「追蹤」：寫入追蹤、關閉人物誌回原頁、不觸發中心視角', async () => {
    start('#/axis/2');
    act(() => openPeople());
    await userEvent.click(within(card('fane')).getByRole('button', { name: '追蹤 法恩' }));
    expect(store().trackedPersonId).toBe('fane');
    expect(store().people.center).toBeNull();
    await waitFor(() => expect(currentHash()).toBe('#/axis/2'));
    await waitFor(() => expect(drawer()).toBeNull());
  });

  it('直接由 #/people 進入者追蹤後回到 00', async () => {
    start('#/people');
    await userEvent.click(within(card('elian')).getByRole('button', { name: '追蹤 艾利安' }));
    await waitFor(() => expect(currentHash()).toBe('#/'));
  });

  it('已追蹤的卡顯示「追蹤中」，再點不做事；一次只追蹤一人（改追另一人會取代）', async () => {
    localStorage.setItem('draven:tracked', JSON.stringify('fane'));
    resetStoreForTests();
    start('#/axis/1');
    act(() => openPeople());
    const tracked = within(card('fane')).getByRole('button', { name: '追蹤中：法恩' });
    expect(tracked).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(tracked);
    expect(drawer()).not.toBeNull();
    await userEvent.click(within(card('elian')).getByRole('button', { name: '追蹤 艾利安' }));
    expect(store().trackedPersonId).toBe('elian');
  });

  it('展開浮層裡也能追蹤', async () => {
    start('#/axis/1');
    act(() => openPeople());
    await userEvent.click(card('elian'));
    await userEvent.click(card('elian'));
    const panel = document.querySelector<HTMLElement>('[data-expanded-panel]')!;
    await userEvent.click(within(panel).getByRole('button', { name: '追蹤 艾利安' }));
    expect(store().trackedPersonId).toBe('elian');
  });
});

describe('Popover →「在人物誌查看」（G-10）', () => {
  it('開啟人物誌並以該人為中心（不直接展開完整介紹）', async () => {
    start('#/axis/1');
    await userEvent.click(screen.getAllByRole('button', { name: '德雷文' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: '在人物誌查看 →' }));
    expect(currentHash()).toBe('#/people');
    await waitFor(() => expect(drawer()).not.toBeNull());
    expect(store().people.center).toBe('dravin');
    expect(store().people.expanded).toBe(false);
    expect(card('dravin')).toHaveAttribute('data-center');
  });
});

describe('人物誌（流式版）', () => {
  it('全螢幕頁、依群體分段、2 欄卡片、不顯示簡介；追蹤是圖示按鈕', () => {
    start('#/axis/1', [390, 844]);
    act(() => openPeople());
    expect(drawer()).toHaveClass('fixed');
    expect(document.querySelectorAll('[data-flow-section]')).toHaveLength(5);
    expect(document.querySelector('[data-flow-section="royal"] .grid')).toHaveClass('grid-cols-2');
    expect(document.body.textContent).not.toContain('推動多族共榮的君王'); // 卡片簡介不顯示
    const track = within(card('fane')).queryByRole('button') ?? document.querySelector('[data-track="fane"]');
    expect(track).not.toBeNull();
  });

  it('點卡進入中心視角：關係膠囊掛在卡上（外框＝線種），沒有連線；沒有關係者在「沒有直接關係」', async () => {
    start('#/axis/1', [390, 844]);
    act(() => openPeople());
    await userEvent.click(card('elian'));
    expect(document.querySelector('[data-flow-center-view]')).not.toBeNull();
    expect(document.querySelectorAll('[data-pill]')).toHaveLength(3);
    expect(document.querySelector('[data-pill="dravin"]')).toHaveTextContent('養父子');
    expect(document.querySelector('[data-pill="dravin"]')).toHaveAttribute('data-kind', 'relation');
    expect(document.querySelector('[data-rel], .rel')).toBeNull(); // 沒有連線
    expect(drawer()).toHaveTextContent('沒有直接關係');
  });

  it('再點中心卡：完整介紹在卡片下方就地展開；可收合', async () => {
    start('#/axis/1', [390, 844]);
    act(() => openPeople());
    await userEvent.click(card('elian'));
    await userEvent.click(card('elian'));
    const inline = document.querySelector('[data-flow-expanded]')!;
    expect(inline).toHaveTextContent('人類孤兒，十歲');
    expect(inline.querySelector('[role="dialog"]')).toBeNull(); // 不是浮層
    await userEvent.click(within(inline as HTMLElement).getByRole('button', { name: '收合完整介紹' }));
    expect(document.querySelector('[data-flow-expanded]')).toBeNull();
  });

  it('標籤列單列橫向滑動（overflow-x:auto）；追蹤後關閉回原頁', async () => {
    start('#/axis/1', [390, 844]);
    act(() => openPeople());
    expect(document.querySelector('[data-filter-bar]')).toHaveClass('overflow-x-auto');
    await userEvent.click(document.querySelector('[data-track="fane"]')!);
    expect(store().trackedPersonId).toBe('fane');
    await waitFor(() => expect(currentHash()).toBe('#/axis/1'));
  });
});
