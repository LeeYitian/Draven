import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { localPoint } from '../../lib/localPoint';
import { runSpring } from '../../lib/spring';
import type { Vec } from './layout';

/** 移動超過這個距離才算拖曳；沒超過就是一般的點擊（聚焦節點） */
const DRAG_THRESHOLD = 4;

export interface NodeDragOptions {
  /** 關係圖視口（座標以它為基準，見 layout 合約 §4） */
  viewportRef: RefObject<HTMLElement | null>;
  /** 目前縮放與平移：圖座標 = (視口本地座標 − pan) ÷ zoom */
  getView: () => { zoom: number; pan: readonly [number, number] };
  /** 流式版停用（與平移衝突） */
  enabled: boolean;
  reduceMotion: boolean;
}

interface Active {
  id: string;
  pointerId: number;
  /** 按下時指標的圖座標與該節點當時的位移 */
  start: Vec;
  origin: Vec;
  /** 按下時的 client 座標（判斷是否超過門檻） */
  clientX: number;
  clientY: number;
  moved: boolean;
}

/**
 * 節點拖曳（任務 T062，research R11）：Pointer Events＋setPointerCapture。
 * 位移存在狀態裡，連線讀同一份位移，所以全程跟著節點；放開後以彈簧（≈400ms、過衝 ≈6%）推回 0。
 */
export function useNodeDrag({ viewportRef, getView, enabled, reduceMotion }: NodeDragOptions) {
  const [offsets, setOffsets] = useState<Record<string, Vec>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const active = useRef<Active | null>(null);
  const springs = useRef(new Map<string, () => void>());
  /** 拖曳結束後緊接著的 click 要吞掉，避免放開時又觸發聚焦 */
  const suppressClick = useRef(false);

  const graphPoint = useCallback(
    (clientX: number, clientY: number): Vec => {
      const el = viewportRef.current;
      if (!el) return [clientX, clientY];
      const { zoom, pan } = getView();
      const p = localPoint(el, clientX, clientY);
      return [(p.x - pan[0]) / zoom, (p.y - pan[1]) / zoom];
    },
    [getView, viewportRef],
  );

  const springBack = useCallback(
    (id: string, from: Vec) => {
      springs.current.get(id)?.();
      const stop = runSpring(
        (p) => setOffsets((prev) => ({ ...prev, [id]: [from[0] * (1 - p), from[1] * (1 - p)] })),
        {
          reduceMotion,
          onDone: () => {
            springs.current.delete(id);
            setOffsets((prev) => {
              const { [id]: _removed, ...rest } = prev;
              return rest;
            });
          },
        },
      );
      springs.current.set(id, stop);
    },
    [reduceMotion],
  );

  // 版型切換或卸載：取消進行中的拖曳與回彈，位移歸零
  useEffect(() => {
    const running = springs.current;
    return () => {
      running.forEach((stop) => stop());
      running.clear();
      active.current = null;
      setOffsets({});
      setDraggingId(null);
    };
  }, [enabled]);

  const onPointerDown = (id: string) => (event: PointerEvent<HTMLElement>) => {
    if (!enabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation(); // 不要同時觸發視口的平移
    suppressClick.current = false; // 上一次拖曳若沒有產生 click（例如在節點外放開），不要吞掉這次
    springs.current.get(id)?.(); // 回彈中再次抓住：從目前位置繼續拖
    springs.current.delete(id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    active.current = {
      id,
      pointerId: event.pointerId,
      start: graphPoint(event.clientX, event.clientY),
      origin: offsets[id] ?? [0, 0],
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const a = active.current;
    if (!a || a.pointerId !== event.pointerId) return;
    if (!a.moved) {
      if (Math.hypot(event.clientX - a.clientX, event.clientY - a.clientY) < DRAG_THRESHOLD) return;
      a.moved = true;
      setDraggingId(a.id);
    }
    const p = graphPoint(event.clientX, event.clientY);
    setOffsets((prev) => ({
      ...prev,
      [a.id]: [a.origin[0] + p[0] - a.start[0], a.origin[1] + p[1] - a.start[1]],
    }));
  };

  const finish = (event: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const a = active.current;
    if (!a || a.pointerId !== event.pointerId) return;
    active.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!a.moved) return;
    suppressClick.current = !cancelled;
    setDraggingId(null);
    const current = offsets[a.id];
    // 最新位移可能還沒反映到這次渲染：由 start/pointer 重新計算
    const p = graphPoint(event.clientX, event.clientY);
    const from: Vec = cancelled && current
      ? current
      : [a.origin[0] + p[0] - a.start[0], a.origin[1] + p[1] - a.start[1]];
    springBack(a.id, from);
  };

  /** 節點的 onClick 呼叫：回傳 true 表示這次 click 是拖曳的尾巴，應忽略 */
  const consumeClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  return {
    offsets,
    draggingId,
    consumeClick,
    handlersFor: (id: string) => ({
      onPointerDown: onPointerDown(id),
      onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => finish(e, true),
    }),
  };
}
