import { useMemo, useRef, type KeyboardEvent } from 'react';
import { NameLink, RichText } from '../../components/text/RichText';
import { Eyebrow } from '../../components/ui';
import { getPerson, t } from '../../content';
import type { AxisExtrasBoundary } from '../../content/schema';
import { useAppStore } from '../../store/store';
import { clampPercent, nearestIndex, snapPosition, stepPosition } from './spectrum';
import { useTrackDrag } from './useTrackDrag';

/**
 * 01 邊界之辯光譜（設計稿 D2）。
 * 指標是 role="slider"：拖曳時連續移動、最近立場即時切換、放開吸附（200ms）；← → 跳到上／下一個立場，
 * 並 preventDefault，所以不會換事件或換頁（contracts/state-and-events §2）。
 * 軌道下的人名可開 Popover。
 */
export function BoundarySpectrum({ boundary }: { boundary: AxisExtrasBoundary }) {
  const value = useAppStore((s) => s.spectrum);
  const setSpectrum = useAppStore((s) => s.setSpectrum);
  const stances = useMemo(
    () => [...boundary.stances].sort((a, b) => a.position - b.position),
    [boundary.stances],
  );
  const positions = useMemo(() => stances.map((s) => s.position), [stances]);
  const currentIndex = nearestIndex(positions, value);
  const current = stances[currentIndex]!;
  const currentName = getPerson(current.personId)?.name ?? current.label;

  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const { dragging, bind } = useTrackDrag({
    trackRef,
    onMove: (fraction) => {
      setSpectrum(clampPercent(fraction * 100));
      thumbRef.current?.focus({ preventScroll: true });
    },
    onEnd: () => setSpectrum(snapPosition(positions, useAppStore.getState().spectrum)),
  });

  const onKeyDown = (e: KeyboardEvent) => {
    let next: number | null = null;
    const latest = useAppStore.getState().spectrum; // 連按時渲染可能還沒跟上，取 store 最新值
    if (e.key === 'ArrowRight') next = stepPosition(positions, latest, 1);
    else if (e.key === 'ArrowLeft') next = stepPosition(positions, latest, -1);
    else if (e.key === 'Home') next = positions[0]!;
    else if (e.key === 'End') next = positions[positions.length - 1]!;
    if (next === null) return;
    e.preventDefault(); // 只移動指標：不換事件、不換頁
    setSpectrum(next);
  };

  const off = Math.abs(value - current.position) > 0.5;

  return (
    <section ref={rootRef} data-spectrum className="spectrum" aria-label={t('spectrum.label')}>
      <div className="spectrum__head">
        <Eyebrow>{boundary.title}</Eyebrow>
        <span className="spectrum__hint">{boundary.hint}</span>
      </div>
      <div
        ref={trackRef}
        data-spectrum-track
        data-dragging={dragging || undefined}
        className="spectrum__track"
        {...bind}
      >
        <div className="spectrum__rail" />
        {off && (
          <div
            className="spectrum__guide"
            style={{
              left: `${Math.min(value, current.position)}%`,
              width: `${Math.abs(value - current.position)}%`,
            }}
          />
        )}
        {stances.map((stance, i) => (
          <div
            key={stance.personId}
            data-stance={stance.personId}
            data-current={i === currentIndex || undefined}
          >
            <div className="spectrum__tick" style={{ left: `${stance.position}%` }} />
            <span
              className="spectrum__name"
              data-no-drag
              data-current={i === currentIndex || undefined}
              style={{ left: `${stance.position}%` }}
            >
              <NameLink personId={stance.personId} />
            </span>
          </div>
        ))}
        <div
          ref={thumbRef}
          role="slider"
          tabIndex={0}
          data-drag-handle
          data-spectrum-thumb
          aria-label={t('spectrum.label')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value)}
          aria-valuetext={t('spectrum.valueText', { name: currentName })}
          aria-orientation="horizontal"
          className="spectrum__thumb"
          data-dragging={dragging || undefined}
          style={{ left: `${value}%` }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="spectrum__ends" aria-hidden="true">
        <span>{boundary.leftLabel}</span>
        <span>{boundary.rightLabel}</span>
      </div>
      <div className="spectrum__detail" data-spectrum-detail aria-live="polite" aria-atomic="true">
        <div className="spectrum__who">
          <span className="spectrum__who-name">
            <NameLink personId={current.personId} />
          </span>
          <span className="spectrum__who-role">{current.label}</span>
        </div>
        <p className="spectrum__quote">
          <RichText text={current.quote} />
        </p>
      </div>
    </section>
  );
}
