import { ChevronDown } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { Eyebrow, Kbd } from '../../components/ui';
import { t } from '../../content';
import type { AxisEvent } from '../../content/schema';
import { cn } from '../../lib/cn';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { eventMarkedByNodeFocus, eventTracked } from '../../store/selectors';
import { useAppStore, type AxisKey } from '../../store/store';

const pad = (n: number) => String(n).padStart(2, '0');

/** 事件進程小標列：舞台版右側是方向鍵提示，流式版是「n / N · 左右滑動」 */
export function EventsLabel({ axis, heading, total }: { axis: AxisKey; heading: string; total: number }) {
  const { mode } = useLayout();
  const eventIndex = useAppStore((s) => s.axis[axis].eventIndex);

  if (mode === 'flow') {
    return (
      <div className="flex items-baseline justify-between">
        <Eyebrow>{heading}</Eyebrow>
        <span className="text-aux text-neutral-600">
          {t('axis.eventOf', { n: pad(eventIndex + 1), total: pad(total) })}
        </span>
      </div>
    );
  }
  return (
    <>
      <Eyebrow>{heading}</Eyebrow>
      <span className="flex items-center gap-1.5 text-aux text-neutral-600">
        <Kbd>←</Kbd>
        <Kbd>→</Kbd>
        {t('keys.events')}
      </span>
    </>
  );
}

interface EventCellProps {
  event: AxisEvent;
  state: 'past' | 'current' | 'upcoming';
  tracked: boolean;
  marked: boolean;
  flow: boolean;
  onSelect: (n: number) => void;
}

/** 事件格（設計稿 §6-D）：編號＋標題＋箭頭；三種狀態；追蹤書籤與節點焦點標記由 data-* 觸發 */
function EventCell({ event, state, tracked, marked, flow, onSelect }: EventCellProps) {
  return (
    <button
      type="button"
      className={cn('event-cell', flow && 'h-12 w-28 flex-none gap-1.5 px-2.5')}
      data-state={state}
      data-tracked={tracked || undefined}
      data-marked={marked || undefined}
      data-event={event.n}
      aria-current={state === 'current' ? 'step' : undefined}
      aria-label={t('axis.eventButton', { n: event.n, title: event.title })}
      title={event.title}
      onClick={() => onSelect(event.n)}
    >
      <span className={cn('event-cell__num', flow && 'text-[17px]')}>{pad(event.n)}</span>
      <span className={cn('event-cell__title', flow && 'text-[14px]')}>{event.title}</span>
      {!flow && <ChevronDown className="event-cell__chev" size={16} strokeWidth={1.5} aria-hidden="true" />}
    </button>
  );
}

/**
 * 事件列：舞台版 N 等分（間距 8）；流式版橫向滑動，目前事件自動置中。
 * 點事件＝設為目前事件並聚焦（事件焦點與節點焦點互斥）。
 */
export function EventBar({ axis, events }: { axis: AxisKey; events: readonly AxisEvent[] }) {
  const { mode } = useLayout();
  const reduceMotion = useReducedMotion();
  const { eventIndex, focus } = useAppStore((s) => s.axis[axis]);
  const trackedId = useAppStore((s) => s.trackedPersonId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const flow = mode === 'flow';
  const scroller = useRef<HTMLDivElement>(null);

  // 流式版：目前事件置中（只動這條事件列的橫向捲動，不捲頁面）
  useEffect(() => {
    const bar = scroller.current;
    const cell = bar?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!flow || !bar || !cell) return;
    const left = cell.offsetLeft - (bar.clientWidth - cell.offsetWidth) / 2;
    if (typeof bar.scrollTo === 'function')
      bar.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
    else bar.scrollLeft = left;
  }, [flow, eventIndex, reduceMotion]);

  const cells = events.map((event, i) => (
    <EventCell
      key={event.n}
      event={event}
      state={i === eventIndex ? 'current' : i > eventIndex ? 'upcoming' : 'past'}
      tracked={eventTracked(event, trackedId)}
      marked={eventMarkedByNodeFocus(event, focus)}
      flow={flow}
      onSelect={(n) => selectEvent(axis, n)}
    />
  ));

  if (flow) {
    return (
      <div
        ref={scroller}
        role="group"
        aria-label={t('axis.eventBar')}
        className="flex gap-1.5 overflow-x-auto px-6 [scrollbar-width:none]"
      >
        {cells}
      </div>
    );
  }
  return (
    <div
      role="group"
      aria-label={t('axis.eventBar')}
      className="grid h-full"
      style={{ gridTemplateColumns: `repeat(${events.length}, minmax(0, 1fr))`, columnGap: 8 }}
    >
      {cells}
    </div>
  );
}
