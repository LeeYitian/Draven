import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { localPoint } from '../../lib/localPoint';
import { useAppStore } from '../../store/store';
import { useUiStore } from '../../store/ui';
import { placeHintAction } from './actions';

/** 移動超過這個距離才算拖曳；沒超過就是一般點擊（點選 toggle） */
const DRAG_THRESHOLD = 4;

export interface DragImage {
  id: string;
  /** 拖曳影像左上角（舞台座標） */
  x: number;
  y: number;
  /** 關鍵字原本的寬度（原位留下同寬的虛線空位） */
  width: number;
}

interface Active {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  grabX: number;
  grabY: number;
  width: number;
  dragging: boolean;
}

/**
 * 關鍵字拖曳（任務 T097；contracts §5）：Pointer Events（觸控也能用）。
 * - 移動超過 4px 才算拖曳：此時選取該關鍵字（所有空框格變「可以放置」），原位留虛線空位。
 * - 放開時以 elementsFromPoint 對框格做命中測試（拖曳影像 pointer-events:none，不會擋住）。
 * - 答對／答錯交給 placeHintAction；沒放到任何框格＝關鍵字回托盤、取消選取。
 * - 拖曳中視窗縮放或版型切換、按 Esc：取消，關鍵字回托盤。
 * 位置一律以舞台元素為基準換算（localPoint），不需要知道舞台倍率。
 */
export function useHintDrag({
  stageRef,
  enabled,
}: {
  stageRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  const [image, setImage] = useState<DragImage | null>(null);
  const active = useRef<Active | null>(null);
  const suppressClick = useRef(false);

  const end = useCallback((deselect: boolean) => {
    const a = active.current;
    active.current = null;
    setImage(null);
    useUiStore.getState().setHintDragging(false);
    // 拖曳結束（含 Esc／縮放取消）之後放開滑鼠會補一個 click，要吞掉，免得又 toggle 選取
    if (a?.dragging) suppressClick.current = true;
    if (a?.dragging && deselect) useAppStore.getState().selectHint(null);
  }, []);

  // 取消：視窗縮放、Esc、卸載
  useEffect(() => {
    if (!enabled) return;
    const cancel = () => active.current?.dragging && end(true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel();
    window.addEventListener('resize', cancel);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', cancel);
      document.removeEventListener('keydown', onKey);
      cancel();
    };
  }, [enabled, end]);

  const handlersFor = (id: string, solved: boolean) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!enabled || solved) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      suppressClick.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      active.current = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        grabX: event.clientX - rect.left,
        grabY: event.clientY - rect.top,
        width: event.currentTarget.offsetWidth,
        dragging: false,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const a = active.current;
      const stage = stageRef.current;
      if (!a || a.pointerId !== event.pointerId || !stage) return;
      if (!a.dragging) {
        if (Math.hypot(event.clientX - a.startX, event.clientY - a.startY) < DRAG_THRESHOLD) return;
        a.dragging = true;
        useAppStore.getState().selectHint(null); // 先清再選：確保拖曳中一定是「已選」
        useAppStore.getState().selectHint(a.id);
        useUiStore.getState().setHintDragging(true);
      }
      const p = localPoint(stage, event.clientX, event.clientY);
      // 抓取點在關鍵字上的位置是螢幕 px，換成舞台座標要除以總倍率 k
      setImage({ id: a.id, x: p.x - a.grabX / p.k, y: p.y - a.grabY / p.k, width: a.width });
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const a = active.current;
      if (!a || a.pointerId !== event.pointerId) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (!a.dragging) {
        active.current = null;
        return; // 沒有移動：交給 onClick
      }
      suppressClick.current = true;
      const slot = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((el) => (el as HTMLElement).dataset?.hintSlot !== undefined) as
        HTMLElement | undefined;
      if (slot) {
        end(false);
        placeHintAction(slot.dataset.hintSlot!);
      } else {
        end(true); // 沒放到框格：回托盤
      }
    },
    onPointerCancel: () => end(true),
  });

  /** 點擊事件呼叫：回傳 true 表示這次 click 是拖曳的尾巴，應忽略 */
  const consumeClick = () => {
    const was = suppressClick.current;
    suppressClick.current = false;
    return was;
  };

  return { image, handlersFor, consumeClick };
}
