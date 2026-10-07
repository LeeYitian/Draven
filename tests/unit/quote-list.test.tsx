import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuoteList } from '../../src/features/extras/QuoteList';
import { resetStoreForTests, useAppStore } from '../../src/store/store';

const quotes = [
  { id: 'a', title: '第一則', text: '甲的話', speaker: 'elian', event: 7, showFromEvent: 1 },
  { id: 'b', title: '第二則', text: '乙的話', speaker: 'fane', event: 7, showFromEvent: 7 },
];

beforeEach(() => {
  localStorage.clear();
  resetStoreForTests();
});

describe('QuoteList（03 引言區）', () => {
  it('showFromEvent：預設整頁常駐；設成 7 的引言要到事件 07 才出現', () => {
    render(<QuoteList axis={3} quotes={quotes} />);
    expect(screen.getByText('甲的話')).toBeInTheDocument();
    expect(screen.queryByText('乙的話')).toBeNull();
    act(() => useAppStore.getState().selectEvent(3, 7));
    expect(screen.getByText('乙的話')).toBeInTheDocument();
  });

  it('被追蹤的說話者：引言掛書籤；其他人沒有', () => {
    act(() => useAppStore.getState().selectEvent(3, 7));
    render(<QuoteList axis={3} quotes={quotes} />);
    expect(document.querySelectorAll('.bookmark')).toHaveLength(0);
    act(() => useAppStore.getState().trackPerson('fane'));
    const marked = [...document.querySelectorAll('[data-quote]')].filter((q) =>
      q.querySelector('.bookmark'),
    );
    expect(marked.map((q) => q.getAttribute('data-quote'))).toEqual(['b']);
  });

  it('事件編號等於引言所屬事件時標示為目前', () => {
    render(<QuoteList axis={3} quotes={quotes} />);
    expect(document.querySelector('[data-quote][data-current]')).toBeNull();
    act(() => useAppStore.getState().selectEvent(3, 7));
    expect(document.querySelectorAll('[data-quote][data-current]')).toHaveLength(2);
  });

  it('沒有可顯示的引言就不渲染任何東西', () => {
    const { container } = render(<QuoteList axis={3} quotes={[quotes[1]!]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
