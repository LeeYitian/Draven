import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { Eyebrow } from '../../components/ui';
import { getPerson, t } from '../../content';
import type { AxisPage, GraphNode as GraphNodeData } from '../../content/schema';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { edgeState, effectiveEdgeLabels, nodeState, visibleEdges } from '../../store/selectors';
import { useAppStore, type AxisKey } from '../../store/store';
import { GraphControls } from './GraphControls';
import { GraphEdge } from './GraphEdge';
import { GraphLegend } from './GraphLegend';
import { GraphNode } from './GraphNode';
import {
  edgeSegment,
  nodeBox,
  normalizeLayout,
  projectNodes,
  type Box,
  type Vec,
} from './layout';
import { useEdgeReveal } from './useEdgeReveal';
import { useGraphViewport } from './useGraphViewport';
import { useNodeDrag } from './useNodeDrag';

export interface RelationGraphProps {
  axis: AxisKey;
  page: AxisPage;
}

/** 視口的本地尺寸（offsetWidth/Height 不受舞台縮放影響）；量不到（0）時沿用 fallback */
function useElementSize(ref: RefObject<HTMLElement | null>, fallback: Vec, resetKey: string) {
  const [size, setSize] = useState({ w: fallback[0], h: fallback[1] });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, resetKey]);
  return size;
}

const displayName = (node: GraphNodeData) =>
  node.label ?? getPerson(node.id)?.name ?? node.id;

/**
 * 關係圖（不使用圖表套件，research R3）：節點座標存為 0–1 比例，執行時乘容器實際尺寸；
 * 連線由 layout.ts 以節點邊界計算；SVG 連線層在下、HTML 節點層在上，兩層共用同一個 zoom／pan 變換。
 * 節點只「聚焦」，不開 Popover（G-09）。
 */
export function RelationGraph({ axis, page }: RelationGraphProps) {
  const { mode } = useLayout();
  const reduceMotion = useReducedMotion();
  const { graph, events } = page;
  const flow = mode === 'flow';

  const { eventIndex, focus, view } = useAppStore((s) => s.axis[axis]);
  const focusNode = useAppStore((s) => s.focusNode);
  const [legendShown, setLegendShown] = useState(true);

  const viewportRef = useRef<HTMLDivElement>(null);
  const layout = flow ? graph.layout.flow : graph.layout.desktop;
  const size = useElementSize(viewportRef, layout.size, mode);
  const viewport = useGraphViewport(axis, viewportRef);
  const progress = useEdgeReveal(axis, graph.edges, reduceMotion);

  const drag = useNodeDrag({
    viewportRef,
    getView: () => {
      const v = useAppStore.getState().axis[axis].view;
      return { zoom: v.zoom, pan: v.pan };
    },
    enabled: !flow,
    reduceMotion,
  });

  // ── 位置：比例 × 容器尺寸，再加拖曳位移 ──
  const ratios = useMemo(() => normalizeLayout(layout), [layout]);
  const base = useMemo(() => projectNodes(ratios, size.w, size.h), [ratios, size.w, size.h]);
  const width = nodeBox(mode, size.w).w;
  const nominal = nodeBox(mode, size.w);
  const position = (id: string): Vec => {
    const b = base[id] ?? [0, 0];
    const o = drag.offsets[id] ?? [0, 0];
    return [b[0] + o[0], b[1] + o[1]];
  };

  // 節點實際高度（副標換行時比名義高度高）：ResizeObserver 回報，連線端點才貼齊邊框
  const wrappers = useRef(new Map<string, HTMLDivElement>());
  const observer = useRef<ResizeObserver | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) =>
      setHeights((prev) => {
        let next = prev;
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.nodeWrapper!;
          if (el.offsetHeight > 0 && next[id] !== el.offsetHeight)
            next = { ...next, [id]: el.offsetHeight };
        }
        return next;
      }),
    );
    observer.current = ro;
    wrappers.current.forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      observer.current = null;
    };
  }, []);
  const boxOf = (id: string): Box => ({ w: width, h: heights[id] ?? nominal.h });

  // ── 亮暗與可見性 ──
  const visible = useMemo(() => visibleEdges(graph.edges, eventIndex), [graph.edges, eventIndex]);
  const participants = useMemo(
    () => new Set(focus?.type === 'event' ? (events[focus.n - 1]?.participants ?? []) : []),
    [focus, events],
  );
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const groupHidden = !view.legendOn.group;
  const isNodeHidden = (id: string) => groupHidden && nodeById.get(id)?.kind === 'group';

  const summaries = visible.filter((e) => view.legendOn[e.kind]);
  const name = (id: string) => {
    const node = nodeById.get(id);
    return node ? displayName(node) : id;
  };

  const onNodeActivate = (id: string) => focusNode(axis, id);

  const canvas = (
    <div
      ref={viewportRef}
      data-graph-viewport
      className={
        flow
          ? 'relative overflow-hidden'
          : 'absolute inset-0 overflow-hidden'
      }
      style={{
        touchAction: viewport.touchAction,
        cursor: viewport.zoom !== 1 ? 'grab' : undefined,
        aspectRatio: flow ? `${layout.size[0]} / ${layout.size[1]}` : undefined,
      }}
      {...viewport.bind}
    >
      <div
        data-graph-layer
        className="absolute top-0 left-0"
        style={{
          width: size.w,
          height: size.h,
          transformOrigin: '0 0',
          transform: `translate(${viewport.pan[0]}px, ${viewport.pan[1]}px) scale(${viewport.zoom})`,
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          {graph.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            const hidden =
              !view.legendOn[edge.kind] || isNodeHidden(edge.from) || isNodeHidden(edge.to);
            const segment =
              from && to
                ? edgeSegment(
                    { center: position(edge.from), box: boxOf(edge.from) },
                    { center: position(edge.to), box: boxOf(edge.to) },
                  )
                : null;
            return (
              <GraphEdge
                key={edge.id}
                edge={edge}
                segment={segment}
                progress={progress[edge.id] ?? 1}
                state={edgeState(edge, eventIndex, focus)}
                hidden={hidden}
                showLabel={effectiveEdgeLabels(view.edgeLabelsOn, mode)}
              />
            );
          })}
        </svg>
        {graph.nodes.map((node) => {
          const [x, y] = position(node.id);
          return (
            <GraphNode
              key={node.id}
              id={node.id}
              name={displayName(node)}
              sub={node.sub}
              group={node.kind === 'group'}
              state={nodeState(node.id, focus, { participants, edges: visible })}
              x={x}
              y={y}
              width={width}
              narrow={flow && size.w < 340}
              selected={focus?.type === 'node' && focus.id === node.id}
              dragging={drag.draggingId === node.id}
              hidden={isNodeHidden(node.id)}
              draggable={!flow}
              wrapperRef={(el) => {
                if (el) {
                  wrappers.current.set(node.id, el);
                  observer.current?.observe(el);
                } else wrappers.current.delete(node.id);
              }}
              onActivate={onNodeActivate}
              dragHandlers={drag.handlersFor(node.id)}
              consumeClick={drag.consumeClick}
            />
          );
        })}
      </div>
    </div>
  );

  // 螢幕閱讀器看的關係清單（圖本身是視覺的）
  const readerList = (
    <ul className="sr-only" aria-label={t('graph.edgeList')}>
      {summaries.map((e) => (
        <li key={e.id}>
          {t(e.both ? 'graph.edgeBoth' : 'graph.edge', {
            from: name(e.from),
            to: name(e.to),
            label: e.label,
          })}
        </li>
      ))}
    </ul>
  );

  const controls = (
    <GraphControls
      axis={axis}
      zoom={viewport.zoom}
      isDefault={viewport.isDefault}
      onZoomIn={viewport.zoomIn}
      onZoomOut={viewport.zoomOut}
      onReset={viewport.reset}
      legendShown={legendShown}
      onToggleLegend={() => setLegendShown((v) => !v)}
    />
  );

  if (flow) {
    return (
      <section className="flex flex-col gap-2" aria-label={t('axis.graphTitle')}>
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>{t('axis.graphTitle')}</Eyebrow>
          {controls}
        </div>
        <div className="overflow-hidden rounded-md border border-divider">
          {canvas}
          <GraphLegend axis={axis} graph={graph} />
        </div>
        {readerList}
      </section>
    );
  }

  return (
    <section
      className="relative h-full overflow-hidden rounded-md border border-divider"
      aria-label={t('axis.graphTitle')}
    >
      {canvas}
      <Eyebrow className="pointer-events-none absolute top-3.5 left-4">
        {t('axis.graphTitle')}
      </Eyebrow>
      {controls}
      {legendShown && <GraphLegend axis={axis} graph={graph} />}
      {readerList}
    </section>
  );
}
