import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Callout, Chip, Flash, Segmented, Sheet, Spoiler } from '../../src/components/ui';

describe('Spoiler（劇透區塊）', () => {
  const secret = '他最後忘了關於艾莉絲的一切';
  const renderSpoiler = (revealed: boolean, onToggle = () => {}) =>
    render(
      <Spoiler
        revealed={revealed}
        onToggle={onToggle}
        lockedLabel="鎖定標頭"
        shownLabel="已顯示標頭"
        hideLabel="隱藏"
      >
        <p>{secret}</p>
      </Spoiler>,
    );

  it('遮蔽時：真實文字完全不在 DOM 裡（不能被選取、搜尋或朗讀）', () => {
    const { container } = renderSpoiler(false);
    expect(container.textContent).not.toContain(secret);
    expect(screen.queryByText(secret)).toBeNull();
    expect(screen.getByRole('button', { name: /鎖定標頭/ })).toBeInTheDocument();
  });

  it('遮蔽時顯示灰條（不洩漏長度以外的資訊）', () => {
    const { container } = renderSpoiler(false);
    expect(container.querySelectorAll('.spoiler__bar')).toHaveLength(3);
  });

  it('點擊才顯示：呼叫 onToggle；顯示後內容出現、可再隱藏', async () => {
    const onToggle = vi.fn();
    const { rerender } = renderSpoiler(false, onToggle);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <Spoiler
        revealed
        onToggle={onToggle}
        lockedLabel="鎖定標頭"
        shownLabel="已顯示標頭"
        hideLabel="隱藏"
      >
        <p>{secret}</p>
      </Spoiler>,
    );
    expect(screen.getByText(secret)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '隱藏' }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

describe('Chip', () => {
  it('以 aria-pressed 表達開關狀態，並帶 data-variant', () => {
    render(
      <Chip variant="legend" pressed={false} lineKind="conflict">
        衝突
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: '衝突' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip).toHaveAttribute('data-variant', 'legend');
    expect(chip.querySelector('.chip-line')).toHaveAttribute('data-kind', 'conflict');
  });
});

describe('Button', () => {
  it('預設 type=button（不會意外送出表單），帶對應的變體類別', () => {
    render(<Button variant="primary">確定</Button>);
    const button = screen.getByRole('button', { name: '確定' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('btn', 'btn-primary');
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'group', label: '依群體' },
    { value: 'order', label: '依出場順序' },
    { value: 'world', label: '依所在世界' },
  ] as const;

  it('radiogroup 語意，只有選中的項目在 Tab 順序內', () => {
    render(<Segmented options={options} value="order" onChange={() => {}} ariaLabel="排列" />);
    expect(screen.getByRole('radiogroup', { name: '排列' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '依出場順序' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: '依群體' })).toHaveAttribute('tabindex', '-1');
  });

  it('←→ 切換選項並 preventDefault（全域方向鍵處理器因此會略過）', () => {
    const onChange = vi.fn();
    render(<Segmented options={options} value="group" onChange={onChange} ariaLabel="排列" />);
    const group = screen.getByRole('radiogroup');
    const right = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    group.dispatchEvent(right);
    expect(onChange).toHaveBeenCalledWith('order');
    expect(right.defaultPrevented).toBe(true);

    const left = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    group.dispatchEvent(left);
    expect(onChange).toHaveBeenLastCalledWith('world'); // 從 group 往左繞到最後一個
  });

  it('停用時不處理按鍵與點擊', () => {
    const onChange = vi.fn();
    render(
      <Segmented options={options} value="group" onChange={onChange} ariaLabel="排列" disabled />,
    );
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Callout', () => {
  it('帶方向與色調屬性，箭頭位置以 CSS 變數傳入', () => {
    render(
      <Callout placement="above" tone="accent" arrowX={25} role="dialog" aria-label="說明">
        內容
      </Callout>,
    );
    const el = screen.getByRole('dialog', { name: '說明' });
    expect(el).toHaveAttribute('data-placement', 'above');
    expect(el).toHaveAttribute('data-tone', 'accent');
    expect(el.style.getPropertyValue('--arrow-x')).toBe('25px');
  });
});

describe('Sheet', () => {
  it('關閉時不渲染；開啟時是 modal dialog，Esc 與點遮罩關閉', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet open={false} onClose={onClose}>
        <p>面板</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <Sheet open onClose={onClose}>
        <p>面板</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Flash', () => {
  it('trigger 為 0 不閃；改變後帶 data-flash，且每次改變都重新掛載（可重播）', () => {
    const { container, rerender } = render(<Flash trigger={0}>內容</Flash>);
    expect(container.querySelector('[data-flash]')).toBeNull();
    rerender(<Flash trigger={1}>內容</Flash>);
    const first = container.querySelector('[data-flash]');
    expect(first).not.toBeNull();
    rerender(<Flash trigger={2}>內容</Flash>);
    expect(container.querySelector('[data-flash]')).not.toBe(first);
  });
});
