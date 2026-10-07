import { memo, type KeyboardEvent, type PointerEvent, type Ref } from 'react';
import { t } from '../../content';
import type { NodeVisualState } from '../../store/selectors';

export interface GraphNodeProps {
  id: string;
  name: string;
  sub: string;
  group: boolean;
  state: NodeVisualState;
  /** 節點中心（圖座標，已含拖曳位移） */
  x: number;
  y: number;
  width: number;
  narrow: boolean;
  /** 目前被點選聚焦的節點（aria-pressed） */
  selected: boolean;
  dragging: boolean;
  /** 圖例把群體隱藏 */
  hidden: boolean;
  draggable: boolean;
  wrapperRef: Ref<HTMLDivElement>;
  /** 點擊或 Enter／Space：只聚焦，不開 Popover（G-09）；回傳前先由呼叫端過濾拖曳尾巴的 click */
  onActivate: (id: string) => void;
  dragHandlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  };
  consumeClick: () => boolean;
}

/**
 * 關係圖節點：純文字（姓名＋副標），三種狀態（一般／焦點／變暗）。
 * 外層 wrapper 只負責把中心點放到 (x, y)；內層 .node 才有縮放與陰影，兩者的 transform 不互相覆蓋。
 */
export const GraphNode = memo(function GraphNode({
  id,
  name,
  sub,
  group,
  state,
  x,
  y,
  width,
  narrow,
  selected,
  dragging,
  hidden,
  draggable,
  wrapperRef,
  onActivate,
  dragHandlers,
  consumeClick,
}: GraphNodeProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate(id);
  };

  return (
    <div
      ref={wrapperRef}
      data-node-wrapper={id}
      className="absolute"
      style={{
        left: x,
        top: y,
        width,
        transform: 'translate(-50%, -50%)',
        zIndex: dragging ? 2 : 1,
      }}
    >
      <div
        role="button"
        tabIndex={hidden ? -1 : 0}
        aria-hidden={hidden || undefined}
        aria-pressed={selected}
        aria-label={t('graph.node', { name, sub })}
        className="node"
        data-node={id}
        data-state={state}
        data-group={group || undefined}
        data-dragging={dragging || undefined}
        data-hidden={hidden || undefined}
        data-narrow={narrow || undefined}
        style={{ touchAction: draggable ? 'none' : undefined }}
        onClick={() => {
          if (consumeClick()) return;
          onActivate(id);
        }}
        onKeyDown={onKeyDown}
        {...dragHandlers}
      >
        <div className="node__name">{name}</div>
        <div className="node__sub">{sub}</div>
      </div>
    </div>
  );
});
