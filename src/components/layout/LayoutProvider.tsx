import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LAYOUT_RULES, STAGE } from '../../lib/stage-metrics';

/**
 * 版型決策的「單一出處」（contracts/layout-and-coordinates.md §1、憲章 II）。
 * 元件不得自行讀 window.innerWidth 判斷版型；一律用 useLayout()，或用 Tailwind 的 stage:／flow:／compact: variant。
 */
export interface LayoutState {
  mode: 'stage' | 'flow';
  /** 舞台縮放倍率 min(寬/1440, 高/720)；流式版僅供參考 */
  s: number;
  /** 舞台倍率 < 0.89：輔助字 13→14、內文 16→17、敘述標題 26→24 */
  compact: boolean;
  width: number;
  height: number;
}

export function decideLayout(width: number, height: number): LayoutState {
  const s = Math.min(width / STAGE.width, height / STAGE.height);
  const portrait = height > width;
  const flow = width < LAYOUT_RULES.flowBelowWidth || portrait || s < LAYOUT_RULES.flowBelowScale;
  return {
    mode: flow ? 'flow' : 'stage',
    s,
    compact: !flow && s < LAYOUT_RULES.compactBelowScale,
    width,
    height,
  };
}

const read = () => decideLayout(window.innerWidth, window.innerHeight);
const same = (a: LayoutState, b: LayoutState) =>
  a.mode === b.mode && a.s === b.s && a.compact === b.compact;

const LayoutContext = createContext<LayoutState | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  // 同步計算初值：第一次渲染就是正確的版型，不會先渲染再切換（避免閃爍）
  const [layout, setLayout] = useState<LayoutState>(read);

  useEffect(() => {
    const update = () => setLayout((prev) => (same(prev, read()) ? prev : read()));
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update(); // 掛載後再校正一次（例如載入期間視窗大小改變）
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // 寫到根元素：CSS 的 stage／flow／compact variant 與 --stage-scale 都靠這些屬性
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.layout = layout.mode;
    root.toggleAttribute('data-compact', layout.compact);
    root.style.setProperty('--stage-scale', String(layout.s));
  }, [layout]);

  const value = useMemo(() => layout, [layout]);
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutState {
  const layout = useContext(LayoutContext);
  if (!layout) throw new Error('useLayout must be used inside <LayoutProvider>');
  return layout;
}
