import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LayoutProvider,
  decideLayout,
  useLayout,
} from '../../src/components/layout/LayoutProvider';
import { FlowShell } from '../../src/components/layout/FlowShell';
import { Stage } from '../../src/components/layout/Stage';

describe('decideLayout（版型決策，視窗矩陣）', () => {
  const stage = (w: number, h: number) => decideLayout(w, h);

  it('桌機矩陣：舞台版，倍率 = min(寬/1440, 高/720)', () => {
    expect(stage(1920, 950)).toMatchObject({ mode: 'stage', compact: false });
    expect(stage(1920, 950).s).toBeCloseTo(1.319, 3);
    expect(stage(1536, 740).s).toBeCloseTo(1.028, 3);
    expect(stage(1440, 795)).toMatchObject({ mode: 'stage', s: 1, compact: false });
    expect(stage(2560, 1300)).toMatchObject({ mode: 'stage', compact: false });
  });

  it('倍率 < 0.89 啟用 compact（1366×640、1280×600）', () => {
    expect(stage(1366, 640)).toMatchObject({ mode: 'stage', compact: true });
    expect(stage(1366, 640).s).toBeCloseTo(0.889, 3);
    expect(stage(1280, 600)).toMatchObject({ mode: 'stage', compact: true });
    expect(stage(1280, 600).s).toBeCloseTo(0.833, 3);
  });

  it('倍率剛好在 0.89 以上不 compact', () => {
    expect(stage(1282, 720).compact).toBe(false); // s=0.8903
  });

  it('寬 < 1024 → 流式（含橫向手機 844×390、平板直立 768×1024）', () => {
    expect(stage(390, 844).mode).toBe('flow');
    expect(stage(360, 740).mode).toBe('flow');
    expect(stage(320, 640).mode).toBe('flow');
    expect(stage(768, 1024).mode).toBe('flow');
    expect(stage(844, 390).mode).toBe('flow');
    expect(stage(1023, 800).mode).toBe('flow');
  });

  it('直立（高 > 寬）一律流式，即使寬度夠大', () => {
    expect(stage(1100, 1200).mode).toBe('flow');
  });

  it('倍率 < 0.72 → 流式（矮視窗 1024×480 文字會太小，G-01）', () => {
    expect(stage(1024, 480).mode).toBe('flow');
    expect(stage(1200, 500).mode).toBe('flow'); // s=0.694
  });

  it('流式版沒有 compact', () => {
    expect(stage(390, 844).compact).toBe(false);
  });

  it('剛好過門檻的舞台版（寬 1037）', () => {
    expect(stage(1037, 720).mode).toBe('stage');
    expect(stage(1037, 720).compact).toBe(true);
  });
});

function Probe() {
  const layout = useLayout();
  return (
    <output data-testid="probe">{`${layout.mode}|${layout.compact}|${layout.s.toFixed(3)}`}</output>
  );
}

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

afterEach(() => {
  document.documentElement.removeAttribute('data-layout');
  document.documentElement.removeAttribute('data-compact');
  document.documentElement.style.removeProperty('--stage-scale');
});

describe('LayoutProvider', () => {
  it('同步計算初值（沒有先渲染再切換的閃爍），並寫入根元素屬性與倍率變數', () => {
    setViewport(1280, 600);
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('stage|true|0.833');
    const root = document.documentElement;
    expect(root.dataset.layout).toBe('stage');
    expect(root.hasAttribute('data-compact')).toBe(true);
    expect(root.style.getPropertyValue('--stage-scale')).toBe('0.8333333333333334');
  });

  it('視窗縮放時重新計算：跨越門檻就切換版型、更新屬性', () => {
    setViewport(1920, 950);
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );
    expect(document.documentElement.dataset.layout).toBe('stage');
    act(() => {
      setViewport(390, 844);
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('probe').textContent).toMatch(/^flow\|false\|/);
    expect(document.documentElement.dataset.layout).toBe('flow');
    expect(document.documentElement.hasAttribute('data-compact')).toBe(false);
  });

  it('useLayout 在 Provider 外使用時丟出清楚的錯誤', () => {
    expect(() => render(<Probe />)).toThrow(/LayoutProvider/);
  });
});

describe('Stage／FlowShell', () => {
  it('Stage：固定 1440×720，依倍率置中縮放，不使用 will-change（避免文字模糊）', () => {
    setViewport(1920, 950);
    render(
      <LayoutProvider>
        <Stage>
          <span>內容</span>
        </Stage>
      </LayoutProvider>,
    );
    const el = document.querySelector('[data-stage]') as HTMLElement;
    expect(el.style.width).toBe('1440px');
    expect(el.style.height).toBe('720px');
    expect(el.style.transform).toBe('translate(-50%, -50%) scale(1.3194444444444444)');
    expect(el.style.willChange).toBe('');
  });

  it('FlowShell：最大寬 640、置中', () => {
    setViewport(390, 844);
    render(
      <LayoutProvider>
        <FlowShell>
          <span>內容</span>
        </FlowShell>
      </LayoutProvider>,
    );
    const el = document.querySelector('[data-flow]') as HTMLElement;
    expect(el.style.maxWidth).toBe('640px');
  });
});
