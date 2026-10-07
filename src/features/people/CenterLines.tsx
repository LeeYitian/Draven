import type { CenterLayout } from './center';
import { AREA } from './center';

/**
 * 人物中心視角的關係線（舞台版）：直角折線從中心卡邊緣出發、終點畫小圓點，
 * 線上文字掛在最長的水平線段上（沒有夠長的水平段時掛在垂直段旁）。線種樣式沿用關係圖。
 * 卡片位移完成前線是隱藏的（CSS 的 transition-delay），避免線指向還在移動的卡片。
 */
export function CenterLines({ layout, visible }: { layout: CenterLayout; visible: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={AREA.width}
      height={AREA.height}
      viewBox={`0 0 ${AREA.width} ${AREA.height}`}
      aria-hidden="true"
    >
      {layout.ring.map((r) => {
        const end = r.route.at(-1)!;
        return (
          <g
            key={r.id}
            className="rel"
            data-kind={r.relation.kind}
            data-rel={r.id}
            data-hidden={!visible || undefined}
          >
            <path className="rel__line" d={r.route.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} />
            <circle className="rel__dot" cx={end.x} cy={end.y} r={2.5} />
            <text
              className="rel__label"
              x={r.label.x}
              y={r.label.y}
              dy="0.35em"
              style={{ textAnchor: r.label.anchor }}
            >
              {r.relation.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
