import type { GraphDef } from '../../content/schema';
import { t } from '../../content';
import { Chip } from '../../components/ui';
import { useLayout } from '../../components/layout/LayoutProvider';
import { useAppStore, type AxisKey, type LegendKey } from '../../store/store';

/**
 * 圖例（可點的開關）：關掉某種線，圖上就不顯示該種線；有群體節點時多一個「群體」開關。
 * 舞台版是圖框左下的浮動列；流式版是圖框底部的圖例列，並附一行操作提示。
 */
export function GraphLegend({ axis, graph }: { axis: AxisKey; graph: GraphDef }) {
  const { mode } = useLayout();
  const legendOn = useAppStore((s) => s.axis[axis].view.legendOn);
  const toggle = useAppStore((s) => s.toggleLegend);
  const hasGroup = graph.nodes.some((n) => n.kind === 'group');

  const items: { key: LegendKey; label: string }[] = [
    ...graph.legend.map((l) => ({ key: l.kind as LegendKey, label: l.label })),
    ...(hasGroup ? [{ key: 'group' as const, label: t('graph.legendGroup') }] : []),
  ];

  const chips = items.map((item) => (
    <Chip
      key={item.key}
      variant="legend"
      lineKind={item.key}
      pressed={legendOn[item.key]}
      onClick={() => toggle(axis, item.key)}
    >
      {item.label}
    </Chip>
  ));

  if (mode === 'flow') {
    return (
      <div
        data-graph-legend
        className="flex flex-wrap content-start items-center gap-1.5 border-t border-divider bg-bg px-2 pt-2 pb-2"
      >
        {chips}
        <span className="basis-full text-aux text-neutral-600">{t('graph.hint')}</span>
      </div>
    );
  }
  return (
    <div data-graph-legend className="absolute bottom-3 left-3 z-[2] flex gap-1.5">
      {chips}
    </div>
  );
}
