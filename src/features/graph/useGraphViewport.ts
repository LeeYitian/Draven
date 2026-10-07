import { useCallback, useEffect, useMemo, useRef, type PointerEvent, type RefObject } from 'react';
import { localPoint } from '../../lib/localPoint';
import { useAppStore, type AxisKey } from '../../store/store';

export const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
/** 拖曳超過這個距離才算平移（之後的 click 會被吞掉，不會誤觸節點） */
const PAN_THRESHOLD = 4;
/** 平移時內容最多可以離開視口的邊距（避免整張圖被推到看不見） */
const PAN_SLACK = 60;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 平移範圍：縮放後內容比視口大 → 可在 [視口−內容, 0] 內移動；比視口小 → 可在 [0, 視口−內容] 內移動；兩端各多留 slack */
export function clampPan(
  pan: readonly [number, number],
  zoom: number,
  size: { w: number; h: number },
): [number, number] {
  const range = (view: number) => {
    const extra = view - view * zoom;
    return [Math.min(0, extra) - PAN_SLACK, Math.max(0, extra) + PAN_SLACK] as const;
  };
  const [minX, maxX] = range(size.w);
  const [minY, maxY] = range(size.h);
  return [clamp(pan[0], minX, maxX), clamp(pan[1], minY, maxY)];
}

/** 以視口內某點為中心縮放：該點下的內容縮放前後留在原地 */
export function zoomAround(
  pan: readonly [number, number],
  zoom: number,
  nextZoom: number,
  point: { x: number; y: number },
): [number, number] {
  const ratio = nextZoom / zoom;
  return [point.x - (point.x - pan[0]) * ratio, point.y - (point.y - pan[1]) * ratio];
}

type Gesture =
  | { kind: 'pan'; x: number; y: number; pan: [number, number]; k: number }
  | { kind: 'pinch'; distance: number; zoom: number };

/**
 * 關係圖縮放與平移（任務 T063；觸控規則見 research R12）：
 * - 按鈕 ±25%（保證可用的替代操作）、Ctrl＋滾輪（含觸控板雙指）、雙指縮放（盡力而為）。
 * - 縮放 ≠ 100% 時，單指／滑鼠拖曳平移，touch-action:none；縮放 = 100% 時 touch-action:pan-y，
 *   單指垂直滑動仍是頁面捲動。
 * 縮放與平移存在 store（每頁各自一份），所以換頁再回來、或換版型都會保留。
 */
export function useGraphViewport(axis: AxisKey, viewportRef: RefObject<HTMLElement | null>) {
  const zoom = useAppStore((s) => s.axis[axis].view.zoom);
  const pan = useAppStore((s) => s.axis[axis].view.pan);
  const setZoomState = useAppStore((s) => s.setZoom);
  const setPanState = useAppStore((s) => s.setPan);
  const resetView = useAppStore((s) => s.resetView);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const moved = useRef(false);

  const size = useCallback(() => {
    const el = viewportRef.current;
    return { w: el?.offsetWidth ?? 0, h: el?.offsetHeight ?? 0 };
  }, [viewportRef]);

  /** 以視口中的 point（本地座標）為中心縮放到 nextZoom */
  const zoomTo = useCallback(
    (nextZoom: number, point?: { x: number; y: number }) => {
      const view = useAppStore.getState().axis[axis].view;
      const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
      if (z === view.zoom) return;
      const box = size();
      const origin = point ?? { x: box.w / 2, y: box.h / 2 };
      setZoomState(axis, z);
      setPanState(axis, clampPan(zoomAround(view.pan, view.zoom, z, origin), z, box));
    },
    [axis, setPanState, setZoomState, size],
  );

  const step = useCallback(
    (delta: number) => {
      const current = useAppStore.getState().axis[axis].view.zoom;
      // 先吸附到 25% 的倍數，按鈕才不會停在 1.0399 這種數字
      zoomTo(Math.round((current + delta) / ZOOM_STEP) * ZOOM_STEP);
    },
    [axis, zoomTo],
  );

  // Ctrl＋滾輪：需要非 passive 監聽才能擋掉瀏覽器自己的頁面縮放
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const current = useAppStore.getState().axis[axis].view.zoom;
      const p = localPoint(el, event.clientX, event.clientY);
      zoomTo(current * Math.exp(-event.deltaY * 0.0015), p);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [axis, viewportRef, zoomTo]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved.current = false;
    const el = viewportRef.current;
    if (!el) return;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      gesture.current = {
        kind: 'pinch',
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: useAppStore.getState().axis[axis].view.zoom,
      };
      return;
    }
    const view = useAppStore.getState().axis[axis].view;
    if (view.zoom !== 1) {
      gesture.current = {
        kind: 'pan',
        x: event.clientX,
        y: event.clientY,
        pan: [...view.pan],
        k: localPoint(el, 0, 0).k,
      };
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const el = viewportRef.current;
    const g = gesture.current;
    if (!el || !g || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      moved.current = true;
      const mid = localPoint(el, (a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomTo(g.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / g.distance), mid);
      return;
    }

    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!moved.current && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
    if (!moved.current) {
      moved.current = true;
      el.setPointerCapture?.(event.pointerId);
    }
    const view = useAppStore.getState().axis[axis].view;
    setPanState(axis, clampPan([g.pan[0] + dx / g.k, g.pan[1] + dy / g.k], view.zoom, size()));
  };

  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2 && gesture.current?.kind === 'pinch') gesture.current = null;
    if (pointers.current.size === 0) gesture.current = null;
  };

  /** 拖曳平移後緊接著的 click 不應觸發節點聚焦或連結 */
  const onClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!moved.current) return;
    moved.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  const bind = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
    }),
    // 處理器都從 store／ref 讀最新值，不依賴渲染期的閉包
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis, zoomTo, size],
  );

  return {
    zoom,
    pan,
    isDefault: zoom === 1 && pan[0] === 0 && pan[1] === 0,
    zoomIn: () => step(ZOOM_STEP),
    zoomOut: () => step(-ZOOM_STEP),
    reset: () => resetView(axis),
    bind,
    /** 縮放 100%：單指垂直滑動＝捲動頁面；縮放後：單指拖曳＝平移 */
    touchAction: zoom === 1 ? ('pan-y' as const) : ('none' as const),
  };
}
