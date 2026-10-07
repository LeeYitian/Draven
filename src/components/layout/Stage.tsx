import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { STAGE } from '../../lib/stage-metrics';
import { useLayout } from './LayoutProvider';

const StageRefContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

/** 舞台元素的 ref：Popover 定位、伏筆拖曳等以它為基準做 localPoint 換算 */
export function useStageRef(): RefObject<HTMLDivElement | null> {
  const ref = useContext(StageRefContext);
  if (!ref) throw new Error('useStageRef must be used inside <Stage>');
  return ref;
}

/** 舞台版以外（流式版）沒有舞台元素，回傳 null；供兩種版型共用的元件使用 */
export function useOptionalStageRef(): RefObject<HTMLDivElement | null> | null {
  return useContext(StageRefContext);
}

/**
 * 舞台版容器：固定 1440×720，依倍率置中縮放（方式 A：transform）。
 * 舞台外的空白由 <html> 的 surface 底色填滿（index.css）。
 * 不加 will-change: transform——否則文字會被點陣化而模糊。
 */
export function Stage({ children }: { children: ReactNode }) {
  const { s } = useLayout();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <StageRefContext.Provider value={ref}>
      <div
        ref={ref}
        data-stage
        className="fixed top-1/2 left-1/2 isolate overflow-hidden bg-bg"
        style={{
          width: STAGE.width,
          height: STAGE.height,
          transform: `translate(-50%, -50%) scale(${s})`,
        }}
      >
        {children}
      </div>
    </StageRefContext.Provider>
  );
}
