import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { localPoint } from '../../lib/localPoint';

export interface UseTrackDragOptions {
  /** 軌道元素：座標一律以它為基準（舞台縮放不影響，contracts §4） */
  trackRef: RefObject<HTMLElement | null>;
  /** 拖曳中持續呼叫；fraction 是指標在軌道上的位置（0–1，已夾緊） */
  onMove: (fraction: number) => void;
  /** 放開（或被中斷）時呼叫：光譜在這裡做吸附 */
  onEnd?: () => void;
}

/**
 * 沿著軌道水平拖曳（光譜、比較滑桿共用）。
 * - 滑鼠：按下軌道任何位置立刻跳到那裡並開始拖曳。
 * - 觸控：按在把手（`data-drag-handle`）上立刻開始拖曳；按在軌道其他位置要先水平移動超過 4px 才算拖曳，
 *   垂直移動則放給瀏覽器捲動頁面（容器 touch-action: pan-y，research R12）；只輕點則跳到該位置。
 */
export function useTrackDrag({ trackRef, onMove, onEnd }: UseTrackDragOptions) {
  const [dragging, setDragging] = useState(false);
  const press = useRef<{ id: number; x: number; y: number; started: boolean } | null>(null);

  const fractionAt = (clientX: number) => {
    const track = trackRef.current;
    if (!track || track.offsetWidth === 0) return 0;
    return Math.min(1, Math.max(0, localPoint(track, clientX, 0).x / track.offsetWidth));
  };

  const begin = (e: ReactPointerEvent<HTMLElement>) => {
    const p = press.current!;
    p.started = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    onMove(fractionAt(e.clientX));
  };

  const finish = () => {
    press.current = null;
    setDragging(false);
    onEnd?.();
  };

  return {
    dragging,
    bind: {
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if ((e.target as Element).closest('[data-no-drag]')) return; // 人名等可點元素自己處理
        press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, started: false };
        const onHandle = (e.target as Element).closest('[data-drag-handle]') !== null;
        if (onHandle || e.pointerType === 'mouse') begin(e);
      },
      onPointerMove(e: ReactPointerEvent<HTMLElement>) {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        if (p.started) return onMove(fractionAt(e.clientX));
        const dx = Math.abs(e.clientX - p.x);
        const dy = Math.abs(e.clientY - p.y);
        if (dx > 4 && dx > dy) begin(e);
      },
      onPointerUp(e: ReactPointerEvent<HTMLElement>) {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        if (p.started) {
          if (e.currentTarget.hasPointerCapture?.(e.pointerId))
            e.currentTarget.releasePointerCapture?.(e.pointerId);
          return finish();
        }
        // 觸控輕點軌道：跳到該位置
        onMove(fractionAt(e.clientX));
        finish();
      },
      onPointerCancel(e: ReactPointerEvent<HTMLElement>) {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        if (p.started) return finish();
        press.current = null; // 還沒開始拖曳就被瀏覽器接管（垂直捲動）：什麼都不做
      },
    },
  };
}
