import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { Eyebrow, Scrim, Segmented } from '../../components/ui';
import { people, t } from '../../content';
import { closePeople } from '../../lib/hash-router';
import { PEOPLE } from '../../lib/stage-metrics';
import { usePresence } from '../../lib/usePresence';
import { useAppStore } from '../../store/store';
import { CenterLines } from './CenterLines';
import { ExpandedPanel } from './ExpandedPanel';
import { FilterBar } from './FilterBar';
import { PeopleFlow } from './PeopleFlow';
import { PersonCard } from './PersonCard';
import { slotPosition, headingPosition } from './slots';
import { usePeopleView } from './usePeopleView';
import type { Rect } from './center';
import type { SortMode } from './model';

const pad = (n: number) => String(n).padStart(2, '0');
const SORTS: readonly SortMode[] = ['group', 'order', 'world'];

/**
 * 抽屜外殼：dialog 語意、進退場動畫、Esc（展開浮層開著時先收浮層，再按一次才關抽屜）、
 * 開啟時焦點進入、關閉時焦點回到原本的元素。
 */
function DrawerFrame({
  closing,
  children,
  className,
}: {
  closing: boolean;
  children: ReactNode;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 要在「渲染期間」記下原本聚焦的元素：提交 DOM 時底下的頁面會變 inert，焦點會先掉到 body，
  // 等到 effect 才讀就太晚了
  const [previous] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [previous]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      const { expanded } = useAppStore.getState().people;
      if (expanded) useAppStore.getState().setExpanded(false);
      else closePeople();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={t('people.title')}
      tabIndex={-1}
      data-people-drawer
      data-closing={closing}
      className={`drawer-anim outline-none ${className}`}
    >
      {children}
    </div>
  );
}

const sortOptions = () => SORTS.map((value) => ({ value, label: t(`people.sort.${value}`) }));

function StageDrawer({ closing }: { closing: boolean }) {
  const v = usePeopleView();
  const { present: panelPresent, closing: panelClosing } = usePresence(
    v.expanded && !!v.centerPerson,
    320,
  );
  // 浮層退場動畫期間（中心可能已被清掉）仍要有人物可畫
  const [lastPerson, setLastPerson] = useState(v.centerPerson);
  if (v.centerPerson && v.centerPerson !== lastPerson) setLastPerson(v.centerPerson);
  const panelPerson = v.centerPerson ?? lastPerson;

  const rectOf = (id: string): Rect => {
    if (v.layout) {
      const hit =
        v.layout.center.id === id
          ? v.layout.center
          : (v.layout.ring.find((r) => r.id === id) ?? v.layout.others.find((o) => o.id === id));
      if (hit) return hit.rect;
    }
    const p = slotPosition(v.arrangement.slots[id] ?? 0);
    return { x: p.x, y: p.y, w: PEOPLE.card.width, h: PEOPLE.card.height };
  };
  const othersIds = new Set(v.layout?.others.map((o) => o.id));
  const headingKind = v.sort === 'world' ? 'worlds' : 'groups';

  return (
    <DrawerFrame closing={closing} className="absolute inset-0 z-(--z-drawer) overflow-hidden bg-bg">
      <div className="absolute top-7 right-12 left-12 flex h-12 items-center gap-5">
        <h2 className="m-0 font-heading text-[34px] leading-none font-medium">
          {t('people.title')}
        </h2>
        {!v.center && <Eyebrow>{t('people.total', { n: people.length })}</Eyebrow>}
        <span
          data-progress-badge
          className="flex items-center gap-1.5 rounded-md border border-divider px-2.5 py-[3px] text-aux text-neutral-700"
        >
          {t('people.progress', { page: pad(v.progress) })} · {t('people.progressLegend')}
        </span>
        {v.tag && (
          <span className="text-aux text-accent-800">
            {t('people.selected', { n: v.selected.size })}
          </span>
        )}
        {v.centerPerson && (
          <span
            data-center-chip
            className="flex items-center gap-1.5 rounded-md border border-accent py-1 pr-1.5 pl-3 text-[14px] text-accent-800"
          >
            {t('people.centerOf', { name: v.centerPerson.name })}
            <button
              type="button"
              aria-label={t('people.centerClear')}
              className="flex h-[22px] w-[22px] items-center justify-center rounded-md hover:bg-accent-100"
              onClick={v.clearCenter}
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </span>
        )}
        <div className="flex-1" />
        <span className="text-aux text-neutral-600">{t('people.sortLabel')}</span>
        <Segmented
          options={sortOptions()}
          value={v.sort}
          onChange={v.setSort}
          ariaLabel={t('people.sortLabel')}
          disabled={!!v.center}
        />
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-divider text-neutral-800 hover:bg-accent-100"
          aria-label={t('people.close')}
          onClick={closePeople}
        >
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <FilterBar
        value={v.tag}
        onToggle={v.setTag}
        className="absolute top-[92px] right-12 left-12 h-10 border-b border-divider"
      />

      <div
        data-people-area
        className="absolute"
        style={{
          left: PEOPLE.area.x,
          top: PEOPLE.area.y,
          width: PEOPLE.area.width,
          height: PEOPLE.area.height,
        }}
      >
        {/* 欄標題（依群體／依世界）：中心視角時淡出 */}
        {v.arrangement.headings.map((h) => (
          <div
            key={h.key}
            data-heading={h.key}
            className="absolute flex h-7 items-baseline gap-2 border-b border-divider transition-opacity duration-200"
            style={{
              left: headingPosition(h.column).x,
              top: headingPosition(h.column).y,
              width: PEOPLE.card.width,
              opacity: v.center ? 0 : 1,
            }}
          >
            <span className="font-heading text-[19px] font-semibold">
              {t(`people.${headingKind}.${h.key}`)}
            </span>
            <span className="tnum text-aux text-neutral-600">{h.count}</span>
          </div>
        ))}

        {v.layout && <CenterLines layout={v.layout} visible={!!v.center} />}

        {v.layout?.othersHeader && (
          <Eyebrow
            className="absolute h-5"
            style={{ left: v.layout.othersHeader.x, top: v.layout.othersHeader.y }}
          >
            {t('people.noRelation')}
          </Eyebrow>
        )}

        {people.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            rect={rectOf(person.id)}
            onStage={person.firstAppearance.axis <= v.progress && v.progress > 0}
            selected={v.selected.has(person.id)}
            center={v.center === person.id}
            compact={!!v.center && v.center !== person.id}
            tracked={v.trackedId === person.id}
            dim={othersIds.has(person.id)}
            onActivate={v.centerOn}
            onTrack={v.track}
          />
        ))}

        {v.center && !v.expanded && (
          <div
            className="pointer-events-none absolute text-center text-aux text-accent-800"
            style={{ left: 436, top: 336, width: 248 }}
          >
            {t('people.expandHint')}
          </div>
        )}
      </div>

      {panelPresent && panelPerson && (
        <>
          <div className="absolute inset-0 z-[1]" onClick={() => v.setExpanded(false)} data-expanded-scrim>
            <Scrim tone="paper" />
          </div>
          <ExpandedPanel
            person={panelPerson}
            progress={v.progress}
            tracked={v.trackedId === panelPerson.id}
            closing={panelClosing}
            onTrack={v.track}
            onClose={() => v.setExpanded(false)}
          />
        </>
      )}
    </DrawerFrame>
  );
}

/** 人物誌抽屜（路由 #/people）：舞台版為全版抽屜，流式版為全螢幕頁；`closing` 時播放退場動畫 */
export function PeopleDrawer({ closing }: { closing: boolean }) {
  const { mode } = useLayout();
  return mode === 'stage' ? (
    <StageDrawer closing={closing} />
  ) : (
    <DrawerFrame closing={closing} className="fixed inset-0 z-(--z-drawer) overflow-y-auto overscroll-contain bg-bg">
      <PeopleFlow />
    </DrawerFrame>
  );
}
