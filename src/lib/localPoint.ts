/**
 * 座標換算（contracts/layout-and-coordinates.md §4）。
 *
 * 舞台版整個頁面被 transform: scale(s) 縮放，關係圖還會再疊一層 zoom，所以
 * 「滑鼠的 client 座標」和「元素本地（未縮放）座標」不同。這裡不需要知道任何倍率：
 * 用元素「縮放後的螢幕寬」除以「未縮放的本地寬（offsetWidth）」就是總倍率 k，
 * 對任意層數的 uniform scale 祖先都成立（已用 research S2 實驗驗證）。
 */
export interface LocalPoint {
  x: number;
  y: number;
  /** 該元素目前相對本地座標的總倍率（螢幕 px ÷ 本地 px） */
  k: number;
}

function localWidth(el: Element, screenWidth: number): number {
  const html = el as HTMLElement;
  if (html.offsetWidth > 0) return html.offsetWidth;
  // SVG 元素沒有 offsetWidth：改用 bbox
  const svg = el as SVGGraphicsElement;
  if (typeof svg.getBBox === 'function') {
    try {
      const w = svg.getBBox().width;
      if (w > 0) return w;
    } catch {
      /* 元素尚未渲染時 getBBox 會丟錯，退化為 k=1 */
    }
  }
  return screenWidth;
}

export function localPoint(el: Element, clientX: number, clientY: number): LocalPoint {
  const rect = el.getBoundingClientRect();
  const width = localWidth(el, rect.width);
  const k = width > 0 && rect.width > 0 ? rect.width / width : 1;
  return { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k, k };
}

export interface LocalRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** 把螢幕上的矩形（例如錨點的 getBoundingClientRect）換成 el 的本地座標 */
export function rectToLocal(
  el: Element,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): LocalRect {
  const { x: left, y: top, k } = localPoint(el, rect.left, rect.top);
  const width = rect.width / k;
  const height = rect.height / k;
  return { left, top, right: left + width, bottom: top + height, width, height };
}
