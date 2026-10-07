import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { ChevronsLeftRight } from 'lucide-react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { RichText } from '../../components/text/RichText';
import { t } from '../../content';
import type { AxisExtrasCompare } from '../../content/schema';
import { useAppStore } from '../../store/store';
import {
  ageOf,
  clampCompare,
  compareRange,
  emphasisOf,
  firstSentence,
  quantizeAge,
  stepCompare,
} from './compare';
import { useAge } from './useAge';
import { useTrackDrag } from './useTrackDrag';

/** 容器寬度（offsetWidth 不受舞台縮放影響）；量不到時用後備值 */
function useWidth(ref: RefObject<HTMLElement | null>, fallback: number) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      if (el.offsetWidth > 0) setWidth(el.offsetWidth);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

type Column = AxisExtrasCompare['left'];

function CompareColumn({
  side,
  column,
  emphasis,
}: {
  side: 'left' | 'right';
  column: Column;
  emphasis: 'wide' | 'narrow' | null;
}) {
  const narrow = emphasis === 'narrow';
  const first = firstSentence(column.quote);
  return (
    <div className="compare__col" data-side={side} data-emphasis={emphasis ?? undefined}>
      <span className="compare__label">{column.label}</span>
      <p className="compare__quote">
        <RichText text={narrow ? first.text : column.quote} />
        {narrow && first.more && '⋯'}
      </p>
      {!narrow && (
        <span className="compare__source">
          <RichText text={column.source} />
        </span>
      )}
    </div>
  );
}

/**
 * 02 比較滑桿「兩種面對時間的方式」（設計稿 D3）：左右分割，把手 20–80%（流式版再保證窄側 ≥ 96px），
 * 放開不回彈；寬側引言放大、窄側淡出只留標題與首句；鍵盤 ← → 每次 10%（preventDefault）。
 * 把手位置同時決定整頁的「時間感」：age 越大，頁面越舊（useAge）。
 */
export function CompareSlider({ compare }: { compare: AxisExtrasCompare }) {
  const { mode } = useLayout();
  const position = useAppStore((s) => s.compareSlider);
  const setCompare = useAppStore((s) => s.setCompare);
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const width = useWidth(trackRef, mode === 'stage' ? 1288 : 342);
  const [min, max] = compareRange(width);
  const pos = clampCompare(position, width);
  const emphasis = emphasisOf(pos);

  useAge(quantizeAge(ageOf(pos, width)));

  const { dragging, bind } = useTrackDrag({
    trackRef,
    handleOnly: true,
    onMove: (fraction) => {
      setCompare(clampCompare(fraction * 100, width));
      handleRef.current?.focus({ preventScroll: true });
    },
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); // 只移動把手：不換事件、不換頁
    // 從 store 取最新值（連按時渲染可能還沒跟上）
    const latest = clampCompare(useAppStore.getState().compareSlider, width);
    setCompare(stepCompare(latest, e.key === 'ArrowRight' ? 1 : -1, width));
  };

  const sideEmphasis = (side: 'left' | 'right') =>
    emphasis === null ? null : emphasis === side ? 'wide' : 'narrow';

  return (
    <section data-compare className="compare" aria-label={t('compare.label')}>
      <div
        ref={trackRef}
        data-compare-track
        className="compare__track"
        data-dragging={dragging || undefined}
        style={{ gridTemplateColumns: `${pos}% ${100 - pos}%` }}
        {...bind}
      >
        <CompareColumn side="left" column={compare.left} emphasis={sideEmphasis('left')} />
        <CompareColumn side="right" column={compare.right} emphasis={sideEmphasis('right')} />
        <div
          data-drag-handle
          className="compare__line"
          style={{ left: `${pos}%` }}
          aria-hidden="true"
        />
        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          data-drag-handle
          data-compare-handle
          aria-label={t('compare.label')}
          aria-valuemin={Math.round(min)}
          aria-valuemax={Math.round(max)}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={t('compare.valueText', {
            left: Math.round(pos),
            right: Math.round(100 - pos),
          })}
          aria-orientation="horizontal"
          className="compare__handle"
          data-dragging={dragging || undefined}
          style={{ left: `${pos}%` }}
          onKeyDown={onKeyDown}
        >
          <ChevronsLeftRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
