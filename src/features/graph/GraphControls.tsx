import { Layers, Menu, Minus, Plus, RotateCcw, Tag } from 'lucide-react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { Chip } from '../../components/ui';
import { t } from '../../content';
import { effectiveEdgeLabels } from '../../store/selectors';
import { useAppStore, type AxisKey } from '../../store/store';

export interface GraphControlsProps {
  axis: AxisKey;
  zoom: number;
  isDefault: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** 圖例列的顯示開關（舞台版才有；流式版圖例固定顯示） */
  legendShown: boolean;
  onToggleLegend: () => void;
  /** 「只看地底」（03 才有） */
  onlyUnderground?: { pressed: boolean; onToggle: () => void };
}

const stepButton =
  'flex h-[30px] w-8 items-center justify-center text-neutral-700 hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-40';

/** 縮放、線段標籤開關、圖例開關、重設（設計稿 §3、§7；縮放按鈕是觸控裝置保證可用的替代操作） */
export function GraphControls({
  axis,
  zoom,
  isDefault,
  onZoomIn,
  onZoomOut,
  onReset,
  legendShown,
  onToggleLegend,
  onlyUnderground,
}: GraphControlsProps) {
  const { mode } = useLayout();
  const labelSetting = useAppStore((s) => s.axis[axis].view.edgeLabelsOn);
  const edgeLabelsOn = effectiveEdgeLabels(labelSetting, mode);
  const toggleLabels = useAppStore((s) => s.toggleEdgeLabels);
  const percent = Math.round(zoom * 100);

  const zoomGroup = (
    <div
      role="group"
      aria-label={t('graph.zoomLevel', { percent })}
      className="flex h-8 items-center rounded-md border border-divider bg-bg"
    >
      <button
        type="button"
        className={stepButton}
        aria-label={t('graph.zoomOut')}
        disabled={zoom <= 0.5}
        onClick={onZoomOut}
      >
        <Minus size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <span
        data-zoom-level
        className="w-[46px] border-x border-divider text-center text-aux leading-[30px] tnum text-neutral-700"
      >
        {percent}%
      </span>
      <button
        type="button"
        className={stepButton}
        aria-label={t('graph.zoomIn')}
        disabled={zoom >= 2}
        onClick={onZoomIn}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );

  const labelsChip = (
    <Chip variant="toggle" pressed={edgeLabelsOn} onClick={() => toggleLabels(axis, edgeLabelsOn)}>
      <Tag size={14} strokeWidth={1.5} aria-hidden="true" />
      {t('graph.labels')}
    </Chip>
  );

  // 舞台版的控制列已經很擠（要讓出第一層的層名），「只看地底」只留圖示；流式版有字
  const undergroundChip = onlyUnderground && (
    <Chip
      variant="toggle"
      pressed={onlyUnderground.pressed}
      title={t('layer.onlyUnderground')}
      aria-label={t('layer.onlyUnderground')}
      onClick={onlyUnderground.onToggle}
    >
      <Layers size={14} strokeWidth={1.5} aria-hidden="true" />
      {mode === 'flow' && t('layer.onlyUnderground')}
    </Chip>
  );

  if (mode === 'flow') {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {undergroundChip}
        {labelsChip}
        {zoomGroup}
        <button
          type="button"
          className="h-8 rounded-md border border-divider px-2.5 text-aux text-neutral-700 disabled:opacity-40"
          disabled={isDefault}
          onClick={onReset}
        >
          {t('graph.reset')}
        </button>
      </div>
    );
  }

  return (
    <div data-graph-controls className="absolute top-2.5 right-2.5 z-[2] flex items-center gap-1.5">
      {zoomGroup}
      {undergroundChip}
      {labelsChip}
      <Chip variant="toggle" pressed={legendShown} onClick={onToggleLegend}>
        <Menu size={14} strokeWidth={1.5} aria-hidden="true" />
        {t('graph.legend')}
      </Chip>
      {!isDefault && (
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-divider bg-bg text-neutral-700 hover:bg-accent-100"
          aria-label={t('graph.reset')}
          title={t('graph.reset')}
          onClick={onReset}
        >
          <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
