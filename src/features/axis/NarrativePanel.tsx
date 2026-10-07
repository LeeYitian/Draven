import { useEffect, useRef, useState } from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { RichText } from '../../components/text/RichText';
import { Button, DisplayNum, Eyebrow } from '../../components/ui';
import { t } from '../../content';
import type { AxisEvent } from '../../content/schema';
import { AXIS_FRAME, MOTION } from '../../lib/stage-metrics';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { useAppStore, type AxisKey } from '../../store/store';
import { HintSlotLayer } from '../hints/HintSlotLayer';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 切換事件的淡出淡入（淡出 120ms → 換內容 → 淡入 180ms）。
 * 「目標事件」與「顯示中的事件」不同＝正在淡出；淡出結束才換成新事件並淡入。
 * reduced-motion 時直接顯示目標事件。
 */
function useCrossfade(event: AxisEvent, reduceMotion: boolean) {
  const [shown, setShown] = useState(event);

  useEffect(() => {
    if (reduceMotion || event.n === shown.n) return;
    const timer = window.setTimeout(() => setShown(event), MOTION.fadeOut);
    return () => window.clearTimeout(timer);
  }, [event, shown.n, reduceMotion]);

  return reduceMotion ? { shown: event, visible: true } : { shown, visible: event.n === shown.n };
}

export interface NarrativePanelProps {
  axis: AxisKey;
  events: readonly AxisEvent[];
  /** 點擊事件文字中的 {x:target|…} 交叉連結 */
  onCrossLink?: (target: string) => void;
}

/**
 * 目前事件的敘述面板：事件編號／標題／標籤＋敘述（RichText）。
 * 舞台版：左欄 620＝敘述文字 470＋旁註欄 150（行高 36，伏筆框格放旁註欄，Phase 7）。
 * 流式版：單欄，敘述下方有「上一個／下一個」。
 */
export function NarrativePanel({ axis, events, onCrossLink }: NarrativePanelProps) {
  const { mode } = useLayout();
  const reduceMotion = useReducedMotion();
  const eventIndex = useAppStore((s) => s.axis[axis].eventIndex);
  const stepEvent = useAppStore((s) => s.stepEvent);
  const current = events[eventIndex]!;
  const { shown, visible } = useCrossfade(current, reduceMotion);
  const flow = mode === 'flow';
  const sectionRef = useRef<HTMLElement>(null);

  const body = (
    <div
      data-narrative-body
      aria-live="polite"
      aria-atomic="true"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${visible ? MOTION.fadeIn : MOTION.fadeOut}ms ease`,
      }}
    >
      <div className="flex items-baseline gap-3.5 flow:gap-3">
        <DisplayNum className="text-[40px] flow:text-[32px]">{pad(shown.n)}</DisplayNum>
        <h2 className="m-0 text-title font-semibold">{shown.title}</h2>
        <Eyebrow>{shown.tag}</Eyebrow>
      </div>
      <p className="m-0 mt-3 text-justify text-body leading-[36px] flow:mt-2.5 flow:leading-[1.85]">
        <RichText text={shown.text} {...(onCrossLink ? { onCrossLink } : {})} />
      </p>
    </div>
  );

  if (flow) {
    return (
      <section className="flex flex-col gap-2.5" aria-label={t('axis.eventBar')}>
        {body}
        <div className="flex justify-between gap-2.5">
          <Button
            className="h-11 flex-1"
            disabled={eventIndex === 0}
            onClick={() => stepEvent(axis, -1, events.length)}
          >
            {t('axis.prev')}
          </Button>
          <Button
            variant="primary"
            className="h-11 flex-1"
            disabled={eventIndex === events.length - 1}
            onClick={() => stepEvent(axis, 1, events.length)}
          >
            {t('axis.next')}
          </Button>
        </div>
      </section>
    );
  }

  const { leftWidth, narrativeTextWidth } = AXIS_FRAME.lower;
  return (
    <section
      ref={sectionRef}
      data-narrative
      className="relative flex-none"
      style={{ width: leftWidth }}
      aria-label={t('axis.eventBar')}
    >
      <div style={{ width: narrativeTextWidth }}>{body}</div>
      <HintSlotLayer panelRef={sectionRef} eventKey={shown.n} visible={visible} />
    </section>
  );
}
