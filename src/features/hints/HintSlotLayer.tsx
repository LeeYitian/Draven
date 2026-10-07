import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { AXIS_FRAME } from '../../lib/stage-metrics';
import { HintSlot, useSlotState } from './HintSlot';
import { arcPath, measureAnchors, placeSlots, staggerSameLine, type AnchorBox } from './measure';

/** 框格左緣＝敘述文字欄右緣＋6（旁註欄 150，框格最寬 144，與文字留 6px） */
const SLOT_LEFT = AXIS_FRAME.lower.narrativeTextWidth + 6;
const SLOT_WIDTH = 144;
const DEFAULT_HEIGHT = 28;

const sameAnchors = (a: readonly AnchorBox[], b: readonly AnchorBox[]) =>
  a.length === b.length &&
  a.every(
    (x, i) =>
      x.id === b[i]!.id &&
      Math.abs(x.endX - b[i]!.endX) < 0.25 &&
      Math.abs(x.lineBottom - b[i]!.lineBottom) < 0.25,
  );

/**
 * 重新量測錨點的時機（任務 T096）：面板尺寸改變（ResizeObserver）、字型載入完成
 * （fonts.ready＋loadingdone，字型換了換行就變）、事件切換、compact／版型改變。
 */
function useAnchors(panelRef: RefObject<HTMLElement | null>, eventKey: number, compact: boolean) {
  const [anchors, setAnchors] = useState<AnchorBox[]>([]);

  const measure = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const next = measureAnchors(panel);
    setAnchors((prev) => (sameAnchors(prev, next) ? prev : next));
  }, [panelRef]);

  useLayoutEffect(() => {
    measure();
    const panel = panelRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (panel) observer?.observe(panel);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(measure);
    fonts?.addEventListener?.('loadingdone', measure);
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener?.('loadingdone', measure);
    };
  }, [measure, panelRef, eventKey, compact]);

  return anchors;
}

function Arc({ id, d, startX, startY }: { id: string; d: string; startX: number; startY: number }) {
  const { state } = useSlotState(id);
  const dim = state === 'empty';
  return (
    <g data-hint-arc={id} data-state={state}>
      <path className="hint-arc" data-dim={dim || undefined} d={d} />
      <circle
        className="hint-arc-dot"
        data-dim={dim || undefined}
        cx={startX}
        cy={startY}
        r={2.5}
      />
    </g>
  );
}

/**
 * 舞台版的伏筆框格層（任務 T094–T095）：放在敘述面板的旁註欄。
 * 框格 y 對齊錨點所在行並防撞；弧線從雙底線片語最後一行的末端連到框格左緣中點。
 * 所有位置都由量測結果算出，不存任何座標——所以字型、compact、事件、視窗縮放改變後都會跟著文字。
 */
export function HintSlotLayer({
  panelRef,
  eventKey,
  visible,
}: {
  panelRef: RefObject<HTMLElement | null>;
  /** 目前顯示的事件編號（事件切換時重新量測） */
  eventKey: number;
  visible: boolean;
}) {
  const { compact, mode } = useLayout();
  const anchors = useAnchors(panelRef, eventKey, compact || mode !== 'stage');
  const [heights, setHeights] = useState<Record<string, number>>({});

  // 框格（含解開後說明）的實際高度：ResizeObserver 回報
  const cells = useMemo(() => new Map<string, HTMLSpanElement>(), []);
  const [observer] = useState(() =>
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver((entries) =>
          setHeights((prev) => {
            let next = prev;
            for (const entry of entries) {
              const el = entry.target as HTMLElement;
              const id = el.dataset.hintCell!;
              if (el.offsetHeight > 0 && next[id] !== el.offsetHeight)
                next = { ...next, [id]: el.offsetHeight };
            }
            return next;
          }),
        ),
  );
  useEffect(() => () => observer?.disconnect(), [observer]);

  const placements = useMemo(
    () =>
      placeSlots(
        anchors.map((a) => ({
          id: a.id,
          anchorMidY: a.midY,
          height: heights[a.id] ?? DEFAULT_HEIGHT,
        })),
      ),
    [anchors, heights],
  );
  const stagger = useMemo(() => staggerSameLine(anchors), [anchors]);
  const byId = new Map(anchors.map((a) => [a.id, a]));

  if (anchors.length === 0) return null;
  return (
    <div
      data-hint-layer
      className="pointer-events-none absolute inset-0 transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <svg
        className="absolute top-0 left-0 overflow-visible"
        width={1}
        height={1}
        aria-hidden="true"
      >
        {placements.map((p) => {
          const a = byId.get(p.id)!;
          const startX = a.endX + 2;
          const startY = a.lineBottom - 6 + (stagger[p.id] ?? 0);
          return (
            <Arc
              key={p.id}
              id={p.id}
              startX={startX}
              startY={startY}
              d={arcPath({ x: startX, y: startY }, SLOT_LEFT, p.y + DEFAULT_HEIGHT / 2, p.id)}
            />
          );
        })}
      </svg>
      {placements.map((p, i) => (
        <HintSlot
          key={p.id}
          hintId={p.id}
          index={i}
          className="pointer-events-auto absolute"
          cellRef={(el) => {
            if (el) {
              cells.set(p.id, el);
              observer?.observe(el);
            } else cells.delete(p.id);
          }}
          // left／top／寬度都是敘述面板的本地座標（＝舞台座標的平移）
          style={{ left: SLOT_LEFT, top: p.y, width: SLOT_WIDTH }}
        />
      ))}
    </div>
  );
}
