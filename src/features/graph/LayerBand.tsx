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

/**
 * 分層關係圖的一層（畫布座標）：虛線上緣、層頭（層名＋人數＋收合箭頭）、收合時 neutral-100 底。
 * 層頭整條可點（收合後整個 46 高的帶狀區域都是層頭）。
 */
export function LayerBand({
  band,
  label,
  count,
  first,
  collapsible,
  collapsed,
  onToggle,
}: LayerBandProps) {
  const text = collapsed
    ? `${t('layer.count', { name: label, n: count })} · ${t('layer.collapsed')}`
    : t('layer.count', { name: label, n: count });

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
        backgroundColor: `color-mix(in oklch, var(--color-neutral-100) ${Math.round(band.t * 100)}%, transparent)`,
      }}
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
