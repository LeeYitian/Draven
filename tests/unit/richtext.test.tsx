import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichText } from '../../src/components/text/RichText';
import { usePopoverStore } from '../../src/store/popover';
import { resetStoreForTests, useAppStore } from '../../src/store/store';

beforeEach(() => {
  localStorage.clear();
  resetStoreForTests();
  usePopoverStore.setState({ open: null });
});

describe('RichText', () => {
  it('不改變可見文字：人名、名詞自動辨識為可點的按鈕', () => {
    const { container } = render(<RichText text="德雷文以東方晨星之名，請法恩幫忙。" />);
    expect(container.textContent).toBe('德雷文以東方晨星之名，請法恩幫忙。');
    expect(screen.getByRole('button', { name: '德雷文' })).toHaveClass('link-name');
    expect(screen.getByRole('button', { name: '法恩' })).toHaveClass('link-name');
    expect(screen.getByRole('button', { name: '東方晨星' })).toHaveClass('link-term');
  });

  it('同一人物在同一段落每次出現都可點', () => {
    render(<RichText text="法恩對布倫說，法恩願意" />);
    expect(screen.getAllByRole('button', { name: '法恩' })).toHaveLength(2);
  });

  it('群體（守舊貴族）不是人物，不可點', () => {
    render(<RichText text="守舊貴族抗命" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('點人名：開啟該人的 Popover 目標；再點同一處＝關閉；點另一處＝切換', async () => {
    render(<RichText text="德雷文與法恩" />);
    const dravin = screen.getByRole('button', { name: '德雷文' });
    await userEvent.click(dravin);
    expect(usePopoverStore.getState().open).toMatchObject({ kind: 'person', id: 'dravin' });
    expect(dravin).toHaveAttribute('data-open');
    expect(dravin).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(screen.getByRole('button', { name: '法恩' }));
    expect(usePopoverStore.getState().open).toMatchObject({ id: 'fane' });
    expect(dravin).not.toHaveAttribute('data-open');

    await userEvent.click(screen.getByRole('button', { name: '法恩' }));
    expect(usePopoverStore.getState().open).toBeNull();
  });

  it('同一個人名出現在兩處時，只有被點的那一處呈現「開啟中」', async () => {
    render(<RichText text="法恩與法恩" />);
    const [first, second] = screen.getAllByRole('button', { name: '法恩' });
    await userEvent.click(first!);
    expect(first).toHaveAttribute('data-open');
    expect(second).not.toHaveAttribute('data-open');
  });

  it('手寫 {p:id|文字}：歧義別名「安」只在明確標記時連結', () => {
    const { container } = render(<RichText text="化名{p:elian|安}，安靜地離開" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.textContent).toBe('安');
    expect(container.textContent).toBe('化名安，安靜地離開');
  });

  it('伏筆回收處：輸出帶 data-hint 的雙底線片語，內含的人名仍可點', () => {
    const { container } = render(
      <RichText text="{h:forgotten-gift|法恩用馬蹄鐵敲出火}，然後離開" />,
    );
    const anchor = container.querySelector('[data-hint="forgotten-gift"]')!;
    expect(anchor).toHaveClass('hint-anchor');
    expect(anchor.textContent).toBe('法恩用馬蹄鐵敲出火');
    expect(anchor.querySelector('[role="button"].link-name')?.textContent).toBe('法恩');
  });

  it('已解開的伏筆：片語標示 data-solved', () => {
    useAppStore.setState({
      hints: { ...useAppStore.getState().hints, solved: ['forgotten-gift'] },
    });
    const { container } = render(<RichText text="{h:forgotten-gift|馬蹄鐵}" />);
    expect(container.querySelector('[data-hint]')).toHaveAttribute('data-solved');
  });

  it('人名連結為 aria-haspopup=dialog 的按鈕角色，可用鍵盤聚焦與啟動', async () => {
    render(<RichText text="艾利安" />);
    const button = screen.getByRole('button', { name: '艾利安' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('tabindex', '0');
    // 刻意不是 <button>：button 是不可拆的行內方塊，後面的全形標點會被擠到行首（避頭尾）
    expect(button.tagName).toBe('SPAN');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
