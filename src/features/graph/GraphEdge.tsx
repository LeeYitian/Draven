import { memo, useState } from 'react';
import type { GraphEdge as GraphEdgeData } from '../../content/schema';
import type { EdgeVisualState } from '../../store/selectors';
import { easeDraw } from './useEdgeReveal';
import { arrowHead, labelPosition, lerpPoint, type Segment } from './layout';

export interface GraphEdgeProps {
  edge: GraphEdgeData;
  /** 兩端節點邊界之間的線；節點重疊到沒有空間時為 null */
  segment: Segment | null;
  /** 畫線進度 0–1；1＝已畫完 */
  progress: number;
  state: EdgeVisualState;
  /** 圖例把這種線隱藏（或端點的群體被隱藏） */
  hidden: boolean;
  /** 「線段標籤」開關 */
  showLabel: boolean;
  /** 這一端連到已收合層的層頭邊緣：不畫箭頭，改畫小圓點（03 三界分層） */
  dot?: 'start' | 'end';
}

const points = (list: readonly (readonly [number, number])[]) =>
  list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/**
 * 一條關係線：直線＋自繪箭頭＋線上文字（SVG）。
 * 畫線＝終點從起點插值到終點（虛線的花紋不會跟著變）；箭頭與文字在線畫完後才淡入。
 */
export const GraphEdge = memo(function GraphEdge({
  edge,
  segment,
  progress,
  state,
  hidden,
  showLabel,
  dot,
}: GraphEdgeProps) {
  const [hover, setHover] = useState(false);
  if (!segment) return null;

  // 尚未畫出（unrevealed）的線：箭頭與文字一律先隱藏，這樣新線開始畫時它們才會從零開始淡入
  const drawn = progress >= 1 && state !== 'unrevealed';
  const end = lerpPoint(segment.start, segment.end, easeDraw(progress));
  const label = labelPosition(segment.start, segment.end, edge.labelOffset);
  const labelVisible = drawn && (showLabel || hover);

  return (
    <g
      className="edge"
      data-kind={edge.kind}
      data-state={state}
      data-edge={edge.id}
      data-hidden={hidden || undefined}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <line
        className="edge__hit"
        x1={segment.start[0]}
        y1={segment.start[1]}
        x2={segment.end[0]}
        y2={segment.end[1]}
      />
      <line
        className="edge__line"
        x1={segment.start[0]}
        y1={segment.start[1]}
        x2={end[0]}
        y2={end[1]}
      />
      {dot !== 'end' && (
        <polygon
          className="edge__arrow"
          data-visible={drawn}
          points={points(arrowHead(segment.end, segment.start))}
        />
      )}
      {edge.both && dot !== 'start' && (
        <polygon
          className="edge__arrow"
          data-visible={drawn}
          points={points(arrowHead(segment.start, segment.end))}
        />
      )}
      {dot && (
        <circle
          className="edge__dot"
          data-visible={drawn}
          cx={(dot === 'end' ? segment.end : segment.start)[0]}
          cy={(dot === 'end' ? segment.end : segment.start)[1]}
          r={3}
        />
      )}
      <text
        className="edge__label"
        data-visible={labelVisible}
        x={label[0]}
        y={label[1]}
        dy="0.35em"
      >
        {edge.label}
      </text>
    </g>
  );
});
