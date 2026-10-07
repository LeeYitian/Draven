import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { localPoint } from '../../lib/localPoint';
import { HintSlot, useSlotState } from './HintSlot';

interface ArcGeometry {
  id: string;
  d: string;
  x: number;
  y: number;
}

const f = (n: number) => Number(n.toFixed(1));

/**
 * 量測這一列裡每個框格的弧線：起點＝雙底線片語最後一行的末端（以列容器為本地座標，量一次），
 * 終點＝框格上緣中央。片語在列的上方，所以起點 y 是負的。
 */
function useArcs(rowRef: RefObject<HTMLElement | null>, hintIds: readonly string[]) {
  const [arcs, setArcs] = useState<ArcGeometry[]>([]);

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const paragraph = row.closest('p') ?? row.parentElement ?? row;
    const next: ArcGeometry[] = [];
    for (const id of hintIds) {
      const anchor = paragraph.querySelector<HTMLElement>(`[data-hint="${id}"]`);
      const slot = row.querySelector<HTMLElement>(`[data-hint-cell="${id}"]`);
      const rects = anchor?.getClientRects();
      const last = rects && rects[rects.length - 1];
      if (!last || !slot) continue;
      const end = localPoint(row, last.right, last.bottom);
      const sx = end.x + 2;
      const sy = end.y - 6;
      const ex = slot.offsetLeft + Math.min(slot.offsetWidth, 80) / 2;
      const ey = slot.offsetTop;
      next.push({
        id,
        x: sx,
        y: sy,
        d: `M${f(sx)} ${f(sy)} C${f(sx + 9)} ${f(sy + 12)} ${f(ex - 12)} ${f(ey - 14)} ${f(ex)} ${f(ey)}`,
      });
    }
    setArcs((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [rowRef, hintIds]);

  useLayoutEffect(() => {
    measure();
    const row = rowRef.current;
    const target = row?.closest('p') ?? row;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (target) observer?.observe(target);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(measure);
    fonts?.addEventListener?.('loadingdone', measure);
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener?.('loadingdone', measure);
    };
  }, [measure, rowRef]);

  return arcs;
}

function NoteArc({ arc }: { arc: ArcGeometry }) {
  const { state } = useSlotState(arc.id);
  const dim = state === 'empty';
  return (
    <g data-hint-arc={arc.id} data-state={state}>
      <path className="hint-arc" data-dim={dim || undefined} d={arc.d} />
      <circle className="hint-arc-dot" data-dim={dim || undefined} cx={arc.x} cy={arc.y} r={2.5} />
    </g>
  );
}

/**
 * 流式版的註記列（任務 T100）：插在回收片語之後第一個標點之後的整列區塊，內含框格與短弧線。
 * **必須是 display:block**（inline-block＋width:100% 搭配兩端對齊，會把上一行的字距拉開；
 * 實測見設計決策文件 §3.1）。同一子句有兩處時並排，放不下就堆疊（flex-wrap）。
 * 以 span 實作（p 裡不能放 div）；display 寫在 style 上，單元測試守住它。
 */
export function NoteRow({ hintIds }: { hintIds: readonly string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const arcs = useArcs(ref, hintIds);
  return (
    <span
      ref={ref}
      data-note-row
      data-hints={hintIds.join(',')}
      style={{ display: 'block', position: 'relative', minHeight: 50 }}
      className="py-2"
    >
      <svg
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        width={1}
        height={1}
        aria-hidden="true"
      >
        {arcs.map((arc) => (
          <NoteArc key={arc.id} arc={arc} />
        ))}
      </svg>
      <span className="flex flex-wrap items-start gap-2">
        {hintIds.map((id, i) => (
          <HintSlot key={id} hintId={id} index={i} className="inline-block max-w-full" />
        ))}
      </span>
    </span>
  );
}
