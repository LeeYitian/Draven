import type { ReactNode } from 'react';
import { AXIS_FRAME, DOCK, CONTENT } from '../../lib/stage-metrics';
import { useLayout } from './LayoutProvider';

export interface PageFrameProps {
  header: ReactNode;
  /** 事件進程小標列（左：標題；右：方向鍵提示） */
  eventsLabel: ReactNode;
  /** 事件列 */
  events: ReactNode;
  /** 目前事件的敘述面板（舞台版：左欄上方，含右側旁註欄） */
  narrative: ReactNode;
  /** 本頁專屬區塊（01 光譜、03 引言、04 對照卡…）：舞台版在敘述下方，流式版在關係圖之後 */
  extras?: ReactNode;
  /** 關係圖 */
  graph: ReactNode;
}

/**
 * 主軸頁框架網格（設計稿 §1-A；01–04 統一，clarifications G-05）：
 * 頁首 y28 h72 → 分隔線 y116 → 事件進程小標 y134 → 事件列 y162 h56 → 下方區 y238 h457，
 * 左欄 620（敘述文字 470＋旁註欄 150）、欄距 40、右欄 628（關係圖）。
 * 流式版改為單欄堆疊：頁首、事件列（黏在頂端）、敘述、關係圖、專屬區塊。
 */
export function PageFrame({
  header,
  eventsLabel,
  events,
  narrative,
  extras,
  graph,
}: PageFrameProps) {
  const { mode } = useLayout();

  if (mode === 'flow') {
    return (
      <div className="flex flex-col gap-[26px]">
        {header}
        {/* 事件列黏在視窗頂端；左右各延伸到螢幕邊緣（抵銷容器的 24px 邊距） */}
        <div className="sticky top-0 z-(--z-page) -mx-6 flex flex-col gap-2 border-b border-divider bg-bg pt-2.5">
          <div className="px-6">{eventsLabel}</div>
          {events}
        </div>
        {narrative}
        {graph}
        {extras}
      </div>
    );
  }

  const { header: h, divider, eventLabelRow, eventRow, lower } = AXIS_FRAME;
  return (
    <div
      className="absolute inset-y-0 right-0 flex flex-col"
      style={{
        left: DOCK.width,
        paddingTop: h.y,
        paddingBottom: 25,
        paddingLeft: CONTENT.x - DOCK.width,
        paddingRight: 40,
      }}
    >
      <div className="flex-none" style={{ height: h.height }}>
        {header}
      </div>
      {/* 分隔線：頁首底（y100）到 y116 之間留 16，線畫在 y116 */}
      <div
        className="flex-none border-b border-divider"
        style={{ height: divider.y - (h.y + h.height) }}
      />
      <div className="flex-none" style={{ height: eventLabelRow.y - divider.y }} />
      <div
        className="flex flex-none items-center justify-between"
        style={{ height: eventLabelRow.height }}
      >
        {eventsLabel}
      </div>
      <div
        className="flex-none"
        style={{ height: eventRow.y - (eventLabelRow.y + eventLabelRow.height) }}
      />
      <div className="flex-none" style={{ height: eventRow.height }}>
        {events}
      </div>
      <div className="flex-none" style={{ height: lower.y - (eventRow.y + eventRow.height) }} />
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: `${lower.leftWidth}px minmax(0, 1fr)`, columnGap: lower.gap }}
      >
        <div className="flex min-h-0 min-w-0 flex-col gap-[22px]">
          {narrative}
          {extras}
        </div>
        <div className="relative min-w-0">{graph}</div>
      </div>
    </div>
  );
}
