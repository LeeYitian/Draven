import { ChevronDown } from 'lucide-react';
import { t } from '../../content';
import { COLLAPSED_HEIGHT, type LayerBand as BandGeometry } from './layers';

export interface LayerBandProps {
  band: BandGeometry;
  /** 層名 */
  label: string;
  /** 這層的節點數 */
  count: number;
  /** 是第一層（沒有上緣分隔線） */
  first: boolean;
  /** 可點層頭收合（03）；否則只是標示分區（02） */
  collapsible: boolean;
  /** 目標狀態是否已收合（不是動畫中途的 t） */
  collapsed: boolean;
  onToggle: () => void;
}

/** 一層的底（畫在連線之下）：虛線上緣、收合時 neutral-100 底 */
export function LayerBand({
  band,
  first,
  collapsed,
}: Pick<LayerBandProps, 'band' | 'first' | 'collapsed'>) {
  const shade = Math.round(band.t * 100);
  return (
    <div
      className="layer-band"
      data-layer={band.id}
      data-first={first || undefined}
      data-collapsed={collapsed || undefined}
      style={{
        top: band.top,
        height: band.height,
        // 收合程度連續變化：底色濃度跟著動
        backgroundColor: `color-mix(in oklch, var(--color-neutral-100) ${shade}%, transparent)`,
      }}
    />
  );
}

/**
 * 一層的層頭（畫在連線之上，才不會被連線的 hover 命中區擋住點擊）：層名＋人數＋收合箭頭。
 * 可收合時整條層頭都能點（收合後整個 46 高的帶狀區域都是層頭）；只標示分區時不接受操作。
 */
export function LayerHead({
  band,
  label,
  count,
  first,
  collapsible,
  collapsed,
  onToggle,
}: LayerBandProps) {
  const base = t('layer.count', { name: label, n: count });
  const text = collapsed ? `${base} · ${t('layer.collapsed')}` : base;

  return (
    <div
      className="layer-head-slot"
      data-first={first || undefined}
      style={{ top: band.top, height: band.height }}
    >
      {collapsible ? (
        <button
          type="button"
          className="layer-band__head"
          data-layer-head={band.id}
          aria-expanded={!collapsed}
          aria-label={t(collapsed ? 'layer.expand' : 'layer.collapse', { name: label })}
          style={{ height: band.height <= COLLAPSED_HEIGHT + 0.5 ? '100%' : undefined }}
          onClick={onToggle}
        >
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{ transform: `rotate(${-90 * band.t}deg)` }}
          />
          {text}
        </button>
      ) : (
        <div className="layer-band__head" data-zone-label>
          {text}
        </div>
      )}
    </div>
  );
}
