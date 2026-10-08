import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Eyebrow, Segmented } from '../../components/ui';
import { people, t } from '../../content';
import type { Person } from '../../content/schema';
import { cn } from '../../lib/cn';
import { closePeople } from '../../lib/hash-router';
import type { CenterLayout, RingPlacement } from './center';
import { FilterBar } from './FilterBar';
import { layoutFlowTree, TREE, type TreeCell } from './flowTree';
import type { SortMode } from './model';
import { PersonBio } from './PersonBio';
import { TrackButton } from './PersonCard';
import { usePeopleView } from './usePeopleView';
import { useReducedMotion } from '../../lib/useReducedMotion';

// const pad = (n: number) => String(n).padStart(2, '0');
const SORTS: readonly SortMode[] = ['group', 'order', 'world'];

const activateOnKey = (onActivate: () => void) => (event: KeyboardEvent<HTMLElement>) => {
  if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  onActivate();
};

interface CardCommon {
  person: Person;
  onStage: boolean;
  selected: boolean;
  onActivate: (id: string) => void;
}

/** 手機版人物卡（網格排列）：96 高、不顯示簡介；追蹤是右上角的圖示按鈕 */
function FlowCard({
  person,
  onStage,
  selected,
  tracked,
  onActivate,
  onTrack,
}: CardCommon & { tracked: boolean; onTrack: (id: string) => void }) {
  return (
    <div className="flex flex-col items-center" data-flow-person={person.id}>
      <div className="relative h-24 w-full">
        <div
          role="button"
          tabIndex={0}
          className="person-card"
          data-fill
          data-flow
          data-person={person.id}
          data-on={onStage || undefined}
          data-selected={selected || undefined}
          aria-label={t('people.cardLabel', { name: person.name, role: person.role })}
          onClick={() => onActivate(person.id)}
          onKeyDown={activateOnKey(() => onActivate(person.id))}
        >
          <span className="person-card__name">{person.name}</span>
          <span className="person-card__role">{person.role}</span>
        </div>
        <TrackButton
          person={person}
          tracked={tracked}
          icon
          onTrack={onTrack}
          className="absolute top-1 right-1"
        />
      </div>
    </div>
  );
}

/** 中心視角裡的關係人物小卡（只有姓名與身分，不放追蹤）；點它就換成以他為中心 */
function CompactCard({ person, onStage, selected, onActivate }: CardCommon) {
  return (
    <div role="presentation" className="h-full w-full" data-flow-person={person.id}>
      <div
        role="button"
        tabIndex={0}
        className="person-card"
        data-fill
        data-compact
        data-flow-compact
        data-person={person.id}
        data-on={onStage || undefined}
        data-selected={selected || undefined}
        aria-label={t('people.cardLabel', { name: person.name, role: person.role })}
        onClick={() => onActivate(person.id)}
        onKeyDown={activateOnKey(() => onActivate(person.id))}
      >
        <span className="person-card__name">{person.name}</span>
        <span className="person-card__role truncate">{person.role}</span>
      </div>
    </div>
  );
}

/** 容器內容寬（ResizeObserver）；量不到時沿用 fallback（jsdom） */
function useContentWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** 一個半區（上或下）：每個人＝小卡＋掛在卡上的關係膠囊，線從中心卡邊緣連到膠囊 */
function TreeHalf({
  group,
  height,
  width,
  cardW,
  cells,
  ring,
  cardProps,
}: {
  group: 'up' | 'down';
  height: number;
  width: number;
  cardW: number;
  cells: TreeCell[];
  ring: readonly RingPlacement[];
  cardProps: (person: Person) => Omit<CardCommon, 'person'>;
}) {
  if (height === 0) return null;
  return (
    <div className="relative" style={{ height }} data-flow-half={group}>
      <svg
        className="pointer-events-none absolute inset-0"
        width={width}
        height={height}
        aria-hidden="true"
      >
        {cells.map((cell) => {
          const r = ring[cell.index]!;
          return (
            <g key={r.id} className="rel" data-kind={r.relation.kind} data-rel={r.id}>
              <path className="rel__line" d={cell.path} style={{ strokeLinecap: 'round' }} />
            </g>
          );
        })}
      </svg>
      {cells.map((cell) => {
        const r = ring[cell.index]!;
        const person = people.find((p) => p.id === r.id)!;
        return (
          <div key={r.id}>
            <div
              className="absolute"
              style={{ left: cell.x, top: cell.cardTop, width: cardW, height: TREE.cardH }}
            >
              <CompactCard person={person} {...cardProps(person)} />
            </div>
            <span
              className="rel-pill absolute"
              data-kind={r.relation.kind}
              data-pill={r.id}
              style={{ left: cell.x, top: cell.pillTop, width: cardW }}
            >
              <span className="truncate">{r.relation.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 手機版人物中心視角：中心卡在畫面中間，關係人物分在上下兩半，每人＝小卡＋掛在卡上的關係膠囊
 * （外框＝線種），線從中心卡邊緣直接連到膠囊；沒有直接關係的放最下面。
 * 再點中心卡：完整介紹在中心卡下方就地展開（與中心卡同一個框，線仍從這個框的邊緣出發）。
 */
function FlowCenterView({
  layout,
  centerPerson,
  expanded,
  progress,
  trackedId,
  onTrack,
  onClear,
  onCenter,
  onExpand,
  cardProps,
}: {
  layout: CenterLayout;
  centerPerson: Person;
  expanded: boolean;
  progress: number;
  trackedId: string | null;
  onTrack: (id: string) => void;
  onClear: () => void;
  onCenter: (id: string) => void;
  onExpand: (expanded: boolean) => void;
  cardProps: (person: Person) => Omit<CardCommon, 'person'>;
}) {
  const { ref, width } = useContentWidth(342);
  const tree = layoutFlowTree(layout.ring.length, width);
  const up = tree.cells.filter((c) => c.group === 'up');
  const down = tree.cells.filter((c) => c.group === 'down');

  return (
    // key＝中心人物：換人時整塊重新掛載並播進場動畫（flow-center-in），和桌面版換中心時卡片移位的感覺一致
    <div key={centerPerson.id} className="flow-center-in px-6 pt-4" data-flow-center-view>
      {/* 量測用的內層：寬度＝內容寬（不含左右邊距），線與卡片的座標都以它為準 */}
      <div ref={ref} className="flex flex-col">
        <div className="mb-4 flex items-center gap-2.5">
          <span
            data-center-chip
            className="flex h-9 items-center gap-1.5 rounded-md border border-accent pr-1.5 pl-3 text-[14px] text-accent-800"
          >
            {t('people.centerOf', { name: centerPerson.name })}
            <button
              type="button"
              aria-label={t('people.centerClear')}
              className="flex h-7 w-7 items-center justify-center"
              onClick={onClear}
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </span>
        </div>

        <TreeHalf
          group="up"
          height={tree.upHeight}
          width={width}
          cardW={tree.cardW}
          cells={up}
          ring={layout.ring}
          cardProps={cardProps}
        />

        <div
          data-flow-person={centerPerson.id}
          className={cn(
            'mx-auto rounded-md border border-t-2 border-accent bg-bg shadow-sm',
            expanded ? 'w-full' : 'w-[200px]',
          )}
        >
          {/* 裡面有「追蹤」按鈕，所以卡片本身不是按鈕：疊一顆透明的整張卡按鈕負責聚焦與鍵盤，點擊冒泡到這裡 */}
          <div
            data-person={centerPerson.id}
            data-center
            className="relative flex cursor-pointer flex-col gap-0.5 px-3 py-2"
            onClick={() => onExpand(!expanded)}
          >
            <button
              type="button"
              className="card-hit"
              aria-expanded={expanded}
              aria-label={t('people.cardLabel', {
                name: centerPerson.name,
                role: centerPerson.role,
              })}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[18px] font-semibold" aria-hidden="true">
                {centerPerson.name}
              </span>
              <TrackButton
                person={centerPerson}
                tracked={trackedId === centerPerson.id}
                onTrack={onTrack}
                className="h-7 px-2 text-[12px]"
              />
            </div>
            <span className="text-aux text-accent-700">{centerPerson.role}</span>
            <span className="text-aux text-accent-800">
              {t(expanded ? 'people.collapseHint' : 'people.expandHint')} {expanded ? '↑' : '↓'}
            </span>
          </div>
          {expanded && (
            <section data-flow-expanded className="flex flex-col gap-3 border-t border-divider p-4">
              <div className="flex items-baseline gap-2.5">
                <span className="font-heading text-[26px] leading-[1.1] font-medium">
                  {centerPerson.name}
                </span>
                <span className="rounded-[3px] border border-divider px-2 text-aux text-neutral-700">
                  {t(`people.groups.${centerPerson.group}`)}
                </span>
                <button
                  type="button"
                  className="ml-auto text-aux text-accent-800"
                  onClick={() => onExpand(false)}
                >
                  {t('people.collapseCard')}
                </button>
              </div>
              <PersonBio person={centerPerson} progress={progress} />
            </section>
          )}
        </div>

        <TreeHalf
          group="down"
          height={tree.downHeight}
          width={width}
          cardW={tree.cardW}
          cells={down}
          ring={layout.ring}
          cardProps={cardProps}
        />

        {layout.others.length > 0 && (
          <div className="mt-7 flex flex-col gap-2" data-flow-others>
            <Eyebrow>{t('people.noRelation')}</Eyebrow>
            <div className="grid grid-cols-2 gap-x-[22px] gap-y-3">
              {layout.others.map((o) => {
                const person = people.find((p) => p.id === o.id)!;
                return (
                  <div key={o.id} data-dim className="h-12 opacity-70">
                    <CompactCard person={person} {...cardProps(person)} onActivate={onCenter} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 手機版人物誌（全螢幕頁；任務 T086）：
 * - 網格排列：卡片 2 欄、不顯示簡介；標籤單列橫向滑動。
 * - 人物中心視角：見 FlowCenterView（中心卡在中間、關係膠囊掛在卡上、線連到膠囊）。
 */
export function PeopleFlow() {
  const v = usePeopleView();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  // 換中心人物（或從網格進入中心視角）：頁面捲回頂端，新的中心人物與關係在最上面
  const centerId = v.centerPerson?.id ?? null;
  useEffect(() => {
    if (centerId === null) return;
    // 手機版人物誌是全螢幕抽屜（自己捲動的 fixed 容器），不是整個頁面在捲，所以要捲抽屜
    const scroller = rootRef.current?.closest<HTMLElement>('[data-people-drawer]');
    scroller?.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [centerId, reduceMotion]);

  const base = (person: Person) => ({
    onStage: v.progress > 0 && person.firstAppearance.axis <= v.progress,
    selected: v.selected.has(person.id),
    onActivate: v.centerOn,
  });

  // 依排列分段：群體／世界各一段（有標題）；出場順序是單一清單
  const sections = (() => {
    const { arrangement, sort } = v;
    if (arrangement.headings.length === 0)
      return [
        {
          key: 'all',
          title: null as string | null,
          members: [...people].sort((a, b) => a.order - b.order),
        },
      ];
    const heads = [...arrangement.headings].sort((a, b) => a.column - b.column);
    return heads.map((h, i) => {
      const next = heads[i + 1]?.column ?? Infinity;
      const members = people
        .filter((p) => {
          const column = Math.floor((arrangement.slots[p.id] ?? 0) / 4);
          return column >= h.column && column < next;
        })
        .sort((a, b) => (arrangement.slots[a.id] ?? 0) - (arrangement.slots[b.id] ?? 0));
      return {
        key: h.key,
        title: t(`people.${sort === 'world' ? 'worlds' : 'groups'}.${h.key}`),
        members,
      };
    });
  })();

  return (
    <div ref={rootRef} className="mx-auto max-w-[640px] pb-8">
      <header className="sticky top-0 z-[2] flex flex-col gap-3 border-b border-divider bg-bg px-6 pt-5 pb-3">
        {/* 標題、進度、關閉鈕同一列；進度的說明文字太長，手機版只留螢幕閱讀器讀 */}
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="m-0 flex-none font-heading text-[30px] leading-none font-medium whitespace-nowrap">
            {t('people.title')}
          </h2>
          <span
            data-progress-badge
            className="min-w-0 truncate rounded-md border border-divider px-2 py-0.5 text-aux text-neutral-700"
          >
            {/* {t('people.progress', { page: pad(v.progress) })} */}
            <span> · {t('people.instruction')}</span>
          </span>
          <button
            type="button"
            className="ml-auto flex h-10 w-10 flex-none items-center justify-center rounded-md border border-divider text-neutral-800 active:bg-accent-100"
            aria-label={t('people.close')}
            onClick={closePeople}
          >
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <Segmented
          options={SORTS.map((value) => ({ value, label: t(`people.sort.${value}`) }))}
          value={v.sort}
          onChange={v.setSort}
          ariaLabel={t('people.sortLabel')}
          disabled={!!v.center}
          className="!flex w-full [&>button]:flex-1 [&>button]:px-1 [&>button]:py-[9px] [&>button]:text-[13px] [&>button]:whitespace-nowrap"
        />
        <FilterBar value={v.tag} onToggle={v.setTag} className="-mr-6 gap-2 pr-6" />
      </header>

      {v.centerPerson && v.layout ? (
        <FlowCenterView
          layout={v.layout}
          centerPerson={v.centerPerson}
          expanded={v.expanded}
          progress={v.progress}
          trackedId={v.trackedId}
          onTrack={v.track}
          onClear={v.clearCenter}
          onCenter={v.centerOn}
          onExpand={v.setExpanded}
          cardProps={base}
        />
      ) : (
        <div className="flex flex-col gap-[18px] px-6 pt-4">
          {sections.map((section) => (
            <section
              key={section.key}
              className="flex flex-col gap-2"
              data-flow-section={section.key}
            >
              {section.title && (
                <div className="flex items-baseline gap-2 border-b border-divider pb-1.5">
                  <span className="font-heading text-[18px] font-semibold">{section.title}</span>
                  <span className="tnum text-aux text-neutral-600">{section.members.length}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {section.members.map((person) => (
                  <FlowCard
                    key={person.id}
                    person={person}
                    {...base(person)}
                    tracked={v.trackedId === person.id}
                    onTrack={v.track}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
