import type { LocalRect } from '../../lib/localPoint';
import { STAGE } from '../../lib/stage-metrics';

export interface PopoverPlacement {
  /** 舞台座標（左上角） */
  x: number;
  y: number;
  placement: 'below' | 'above';
  /** 箭頭左緣相對 popover 左緣的位置，指向錨點中心 */
  arrowX: number;
}

const MARGIN = 16;
const GAP = 12;
const ARROW = 10;
const ARROW_MIN = 12;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Popover 定位（舞台版，research R5）：預設在錨點下方 12px，空間不足翻到上方；
 * 水平夾在舞台內。錨點矩形必須已換算成舞台座標（rectToLocal）。
 */
export function placePopover(
  anchor: Pick<LocalRect, 'left' | 'top' | 'right' | 'bottom' | 'width'>,
  size: { width: number; height: number },
): PopoverPlacement {
  const x = clamp(anchor.left, MARGIN, STAGE.width - size.width - MARGIN);

  let placement: PopoverPlacement['placement'] = 'below';
  let y = anchor.bottom + GAP;
  if (y + size.height > STAGE.height - MARGIN) {
    placement = 'above';
    y = anchor.top - GAP - size.height;
  }
  // 兩邊都放不下時，至少不要超出舞台
  y = clamp(y, MARGIN, Math.max(MARGIN, STAGE.height - size.height - MARGIN));

  const anchorCenter = anchor.left + anchor.width / 2;
  const arrowX = clamp(anchorCenter - x - ARROW / 2, ARROW_MIN, size.width - ARROW_MIN - ARROW);
  return { x, y, placement, arrowX };
}
