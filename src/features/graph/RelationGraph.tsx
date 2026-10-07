import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { Eyebrow } from '../../components/ui';
import { getPerson, t } from '../../content';
import type { AxisPage, GraphNode as GraphNodeData } from '../../content/schema';
import { GRAPH_BARS } from '../../lib/stage-metrics';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { edgeState, effectiveEdgeLabels, nodeState, visibleEdges } from '../../store/selectors';
import { useAppStore, type AxisKey } from '../../store/store';
import { GraphControls } from './GraphControls';
import { GraphEdge } from './GraphEdge';
import { GraphLegend } from './GraphLegend';
import { GraphNode } from './GraphNode';
import { LayerBand, LayerHead } from './LayerBand';
import {
  edgeSegment,
  nodeBox,
  normalizeLayout,
  offsetSegment,
  projectNodes,
  type Box,
  type Vec,
} from './layout';
import {
  UNDERGROUND_LAYER,
  collapseTargets,
  headerAnchor,
  isOnly,
  layoutLayers,
  toggleOnly,
} from './layers';
import { useEdgeReveal } from './useEdgeReveal';
import { useGraphViewport } from './useGraphViewport';
import { useLayerTween } from './useLayerTween';
import { useNodeDrag } from './useNodeDrag';

// 開發專用的座標校正器：只在 dev 模式、網址有 ?editor=1 時載入，正式建置會整段移除
const LayoutEditor = import.meta.env.DEV ? lazy(() => import('../../dev/LayoutEditor')) : null;
const editorRequested = () =>
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('editor') === '1';

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

const displayName = (node: GraphNodeData) => node.label ?? getPerson(node.id)?.name ?? node.id;

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
  const setLayerCollapsed = useAppStore((s) => s.setLayerCollapsed);
  const [legendShown, setLegendShown] = useState(true);

  const viewportRef = useRef<HTMLDivElement>(null);
  const layout = flow ? graph.layout.flow : graph.layout.desktop;
  const size = useElementSize(viewportRef, layout.size, mode);
  const viewport = useGraphViewport(axis, viewportRef);
  const progress = useEdgeReveal(axis, graph.edges, reduceMotion);

  const editor = editorRequested();
  const drag = useNodeDrag({
    viewportRef,
    getView: () => {
      const v = useAppStore.getState().axis[axis].view;
      return { zoom: v.zoom, pan: v.pan };
    },
    enabled: !flow || editor,
    reduceMotion,
    persist: editor,
  });

  // ── 位置：比例 × 容器尺寸，再加拖曳位移 ──
  const ratios = useMemo(() => normalizeLayout(layout), [layout]);
  const base = useMemo(() => projectNodes(ratios, size.w, size.h), [ratios, size.w, size.h]);
  const width = nodeBox(mode, size.w).w;
  const nominal = nodeBox(mode, size.w);

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

  // ── 分層（02 分區、03 三界）：帶狀區域由節點位置推出，收合時節點與連線跟著 300ms 動畫 ──
  const layers = graph.layers;
  const collapsedMap = view.layerCollapsed;
  const layerTargets = useMemo(
    () => (layers ? collapseTargets(layers, collapsedMap) : {}),
    [layers, collapsedMap],
  );
  const tween = useLayerTween(layerTargets, reduceMotion);
  const layered = layers
    ? layoutLayers({ layers, positions: base, boxOf, height: size.h, collapse: tween })
    : null;
  const position = (id: string): Vec => {
    const b = layered?.positions[id] ?? base[id] ?? [0, 0];
    const o = drag.offsets[id] ?? [0, 0];
    return [b[0] + o[0], b[1] + o[1]];
  };
  const layerCollapsedOf = (id: string) => {
    const layerId = layered?.layerOf[id];
    return layerId !== undefined && !!collapsedMap[layerId];
  };

  // ── 亮暗與可見性 ──
  const visible = useMemo(() => visibleEdges(graph.edges, eventIndex), [graph.edges, eventIndex]);
  const participants = useMemo(
    () => new Set(focus?.type === 'event' ? (events[focus.n - 1]?.participants ?? []) : []),
    [focus, events],
  );
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const groupHidden = !view.legendOn.group;
  const isNodeHidden = (id: string) =>
    (groupHidden && nodeById.get(id)?.kind === 'group') || layerCollapsedOf(id);

  // 同一對人物有兩條方向相反的線（例如 03 的「傳授召喚儀式」與「扣留」）：各自往旁邊錯開，才不會疊成一條
  const twinned = new Set(
    graph.edges
      .filter((e) => graph.edges.some((o) => o.id !== e.id && o.from === e.to && o.to === e.from))
      .map((e) => e.id),
  );

  const summaries = visible.filter((e) => view.legendOn[e.kind]);
  const name = (id: string) => {
    const node = nodeById.get(id);
    return node ? displayName(node) : id;
  };

  const onNodeActivate = (id: string) => focusNode(axis, id);

  const editorPanel =
    editor && LayoutEditor ? (
      <Suspense fallback={null}>
        <LayoutEditor
          mode={mode}
          size={layout.size}
          nodes={Object.fromEntries(
            graph.nodes.map((n) => {
              const [x, y] = position(n.id);
              return [
                n.id,
                [(x / size.w) * layout.size[0], (y / size.h) * layout.size[1]] as const,
              ];
            }),
          )}
          onReset={drag.resetOffsets}
        />
      </Suspense>
    ) : null;

  const canvas = (
    <div
      ref={viewportRef}
      data-graph-viewport
      className={flow ? 'relative overflow-hidden' : 'absolute inset-0 overflow-hidden'}
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
        {layered &&
          layers!.map((layer, i) => (
            <LayerBand
              key={layer.id}
              band={layered.bands[i]!}
              first={i === 0}
              collapsed={!!collapsedMap[layer.id]}
            />
          ))}
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          {graph.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            const fromCollapsed = layerCollapsedOf(edge.from);
            const toCollapsed = layerCollapsedOf(edge.to);
            const groupGone = (id: string) => groupHidden && nodeById.get(id)?.kind === 'group';
            const hidden =
              !view.legendOn[edge.kind] ||
              groupGone(edge.from) ||
              groupGone(edge.to) ||
              (fromCollapsed && toCollapsed);
            let segment = null;
            let dot: 'start' | 'end' | undefined;
            if (from && to) {
              if (fromCollapsed !== toCollapsed) {
                // 跨層的線有一端在已收合的層：改連到該層層頭邊緣（終點加小圓點）
                const hiddenId = fromCollapsed ? edge.from : edge.to;
                const shownId = fromCollapsed ? edge.to : edge.from;
                const band = layered!.bands.find((b) => b.id === layered!.layerOf[hiddenId])!;
                const shown = { center: position(shownId), box: boxOf(shownId) };
                const anchor = {
                  center: headerAnchor(band, position(hiddenId)[0], shown.center[1]),
                  box: { w: 0, h: 0 },
                };
                segment = fromCollapsed
                  ? edgeSegment(anchor, shown, 0)
                  : edgeSegment(shown, anchor, 0);
                dot = fromCollapsed ? 'start' : 'end';
              } else {
                segment = edgeSegment(
                  { center: position(edge.from), box: boxOf(edge.from) },
                  { center: position(edge.to), box: boxOf(edge.to) },
                );
              }
            }
            if (segment && twinned.has(edge.id)) segment = offsetSegment(segment, 7);
            return (
              <GraphEdge
                key={edge.id}
                edge={edge}
                segment={segment}
                progress={progress[edge.id] ?? 1}
                state={edgeState(edge, eventIndex, focus)}
                hidden={hidden}
                showLabel={effectiveEdgeLabels(view.edgeLabelsOn, mode)}
                {...(dot ? { dot } : {})}
              />
            );
          })}
        </svg>
        {layered &&
          layers!.map((layer, i) => (
            <LayerHead
              key={layer.id}
              band={layered.bands[i]!}
              label={layer.label}
              count={layer.nodes.length}
              first={i === 0}
              collapsible={!!layer.collapsible}
              collapsed={!!collapsedMap[layer.id]}
              onToggle={() =>
                setLayerCollapsed(axis, { ...collapsedMap, [layer.id]: !collapsedMap[layer.id] })
              }
            />
          ))}
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
              draggable={!flow || editor}
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

  // 「只看地底」開關：只有可收合的分層圖（03）才有
  const onlyUnderground =
    layers && layers.some((l) => l.id === UNDERGROUND_LAYER && l.collapsible)
      ? {
          pressed: isOnly(layers, collapsedMap, UNDERGROUND_LAYER),
          onToggle: () =>
            setLayerCollapsed(axis, toggleOnly(layers, collapsedMap, UNDERGROUND_LAYER)),
        }
      : undefined;

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
      {...(onlyUnderground ? { onlyUnderground } : {})}
    />
  );

  if (flow) {
    return (
      <section className="flex flex-col gap-2" aria-label={t('axis.graphTitle')}>
        {/* 窄螢幕（寬 320）放不下標題＋四個控制項：控制項整組換到下一行，標題不折字 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow className="whitespace-nowrap">{t('axis.graphTitle')}</Eyebrow>
          {controls}
        </div>
        <div className="overflow-hidden rounded-md border border-divider">
          {canvas}
          <GraphLegend axis={axis} graph={graph} />
        </div>
        {readerList}
        {editorPanel}
      </section>
    );
  }

  // 舞台版：上（標題＋控制項）、中（畫布）、下（圖例）三段；功能列都在畫布之外，節點不會被蓋住。
  // 畫布高度＝圖框高度 − 上下兩條列（圖例收起時下條消失、畫布變高），節點座標是畫布的比例。
  return (
    <section
      data-graph-frame
      className="relative flex h-full flex-col overflow-hidden rounded-md"
      aria-label={t('axis.graphTitle')}
    >
      <div
        className="flex flex-none items-center justify-between border-b border-divider px-4 pr-2.5"
        style={{ height: GRAPH_BARS.top }}
      >
        <Eyebrow>{t('axis.graphTitle')}</Eyebrow>
        {controls}
      </div>
      <div className="relative min-h-0 flex-1">{canvas}</div>
      {legendShown && <GraphLegend axis={axis} graph={graph} />}
      {/* 外框畫在最上層，不佔版面 */}
      <div
        className="pointer-events-none absolute inset-0 rounded-md border border-divider"
        aria-hidden="true"
      />
      {readerList}
      {editorPanel}
    </section>
  );
}
