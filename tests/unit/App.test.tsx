import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';

describe('App 空殼首頁', () => {
  it('顯示來自 ui.yaml 的站名與副標', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: '德雷文' })).toBeInTheDocument();
    expect(screen.getByText('故事導覽')).toBeInTheDocument();
  });
});
