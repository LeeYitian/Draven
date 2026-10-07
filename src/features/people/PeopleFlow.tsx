import { X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Segmented } from '../../components/ui';
import { people, t } from '../../content';
import type { Person } from '../../content/schema';
import { closePeople } from '../../lib/hash-router';
import { cn } from '../../lib/cn';
import type { RingPlacement } from './center';
import { FilterBar } from './FilterBar';
import type { SortMode } from './model';
import { PersonBio } from './PersonBio';
import { TrackButton } from './PersonCard';
import { usePeopleView } from './usePeopleView';

const pad = (n: number) => String(n).padStart(2, '0');
const SORTS: readonly SortMode[] = ['group', 'order', 'world'];

interface FlowCardProps {
  person: Person;
  onStage: boolean;
  selected: boolean;
  tracked: boolean;
  center?: boolean;
  /** 中心卡是否已展開完整介紹（決定提示文字） */
  expanded?: boolean;
  dim?: boolean;
  onActivate: (id: string) => void;
  onTrack: (id: string) => void;
  /** 掛在卡片下緣的關係膠囊（人物中心視角） */
  pill?: { label: string; kind: string };
}

/** 手機版人物卡：96 高、不顯示簡介；追蹤是右上角的圖示按鈕；中心視角時關係膠囊掛在卡上 */
function FlowCard({
  person,
  onStage,
  selected,
  tracked,
  center,
  expanded,
  dim,
  onActivate,
  onTrack,
  pill,
}: FlowCardProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onActivate(person.id);
  };
  return (
    <div className={cn('flex flex-col items-center', dim && 'opacity-70')} data-flow-person={person.id}>
      <div className={cn('relative w-full', center ? 'h-[104px]' : 'h-24')}>
        <div
          role="button"
          tabIndex={0}
          className="person-card"
          data-fill
          data-flow
          data-person={person.id}
          data-on={onStage || undefined}
          data-selected={selected || undefined}
          data-center={center || undefined}
          aria-label={t('people.cardLabel', { name: person.name, role: person.role })}
          onClick={() => onActivate(person.id)}
          onKeyDown={onKeyDown}
        >
          <span className="person-card__name">{person.name}</span>
          <span className="person-card__role">{person.role}</span>
          {center && (
            <span className="mt-0.5 text-aux text-accent-800">
              {t(expanded ? 'people.collapseHint' : 'people.expandHint')} {expanded ? '↑' : '↓'}
            </span>
          )}
        </div>
        <TrackButton
          person={person}
          tracked={tracked}
          icon
          onTrack={onTrack}
          className="absolute top-1 right-1"
        />
      </div>
      {pill && (
        <span className="rel-pill relative z-[1] -mt-[11px] max-w-full" data-kind={pill.kind} data-pill={person.id}>
          <span className="truncate">{pill.label}</span>
        </span>
      )}
    </div>
  );
}

/**
 * 手機版人物誌（全螢幕頁；任務 T086）：
 * - 卡片 2 欄、不顯示簡介；標籤單列橫向滑動。
 * - 人物中心視角用「關係標籤膠囊掛在卡上」的版型（外框＝線種），沒有連線；直式樹狀為廢棄方案，不實作。
 * - 完整介紹改為中心卡下方就地展開。
 */
export function PeopleFlow() {
  const v = usePeopleView();

  const cardProps = (person: Person) => ({
    person,
    onStage: v.progress > 0 && person.firstAppearance.axis <= v.progress,
    selected: v.selected.has(person.id),
    tracked: v.trackedId === person.id,
    onTrack: v.track,
  });

  // 依排列分段：群體／世界各一段（有標題）；出場順序是單一清單
  const sections = (() => {
    const { arrangement, sort } = v;
    if (arrangement.headings.length === 0)
      return [{ key: 'all', title: null as string | null, members: [...people].sort((a, b) => a.order - b.order) }];
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

  const ringById = new Map<string, RingPlacement>(v.layout?.ring.map((r) => [r.id, r]));
  const centerPerson = v.centerPerson;

  return (
    <div className="mx-auto max-w-[640px] pb-8">
      <header className="sticky top-0 z-[2] flex flex-col gap-3 border-b border-divider bg-bg px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="m-0 font-heading text-[30px] leading-none font-medium">{t('people.title')}</h2>
          <span
            data-progress-badge
            className="rounded-md border border-divider px-2 py-0.5 text-aux text-neutral-700"
          >
            {t('people.progress', { page: pad(v.progress) })} · {t('people.progressLegend')}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-divider text-neutral-800 active:bg-accent-100"
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
          className="!flex w-full [&>button]:flex-1 [&>button]:py-[9px] [&>button]:text-[13px]"
        />
        <FilterBar value={v.tag} onToggle={v.setTag} className="-mr-6 gap-2 pr-6" />
      </header>

      {centerPerson && v.layout ? (
        <div className="flex flex-col gap-4 px-6 pt-4" data-flow-center-view>
          <div className="flex items-center gap-2.5">
            <span
              data-center-chip
              className="flex h-9 items-center gap-1.5 rounded-md border border-accent pr-1.5 pl-3 text-[14px] text-accent-800"
            >
              {t('people.centerOf', { name: centerPerson.name })}
              <button
                type="button"
                aria-label={t('people.centerClear')}
                className="flex h-7 w-7 items-center justify-center"
                onClick={v.clearCenter}
              >
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
          </div>

          <div className="mx-auto w-[220px]">
            <FlowCard
              {...cardProps(centerPerson)}
              center
              expanded={v.expanded}
              onActivate={() => (v.expanded ? v.setExpanded(false) : v.centerOn(centerPerson.id))}
            />
          </div>

          {v.expanded && (
            <section
              data-flow-expanded
              className="flex flex-col gap-3 rounded-md border border-accent border-t-2 p-4"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="font-heading text-[26px] leading-[1.1] font-medium">{centerPerson.name}</span>
                <span className="rounded-[3px] border border-divider px-2 text-aux text-neutral-700">
                  {t(`people.groups.${centerPerson.group}`)}
                </span>
                <button
                  type="button"
                  className="ml-auto text-aux text-accent-800"
                  onClick={() => v.setExpanded(false)}
                >
                  {t('people.collapseCard')}
                </button>
              </div>
              <PersonBio person={centerPerson} progress={v.progress} />
            </section>
          )}

          {v.layout.ring.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {v.layout.ring.map((r) => {
                const person = people.find((p) => p.id === r.id)!;
                return (
                  <FlowCard
                    key={r.id}
                    {...cardProps(person)}
                    onActivate={v.centerOn}
                    pill={{ label: ringById.get(r.id)!.relation.label, kind: r.relation.kind }}
                  />
                );
              })}
            </div>
          )}

          {v.layout.others.length > 0 && (
            <>
              <div className="eyebrow">{t('people.noRelation')}</div>
              <div className="-mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                {v.layout.others.map((o) => (
                  <FlowCard
                    key={o.id}
                    {...cardProps(people.find((p) => p.id === o.id)!)}
                    dim
                    onActivate={v.centerOn}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-[18px] px-6 pt-4">
          {sections.map((section) => (
            <section key={section.key} className="flex flex-col gap-2" data-flow-section={section.key}>
              {section.title && (
                <div className="flex items-baseline gap-2 border-b border-divider pb-1.5">
                  <span className="font-heading text-[18px] font-semibold">{section.title}</span>
                  <span className="tnum text-aux text-neutral-600">{section.members.length}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {section.members.map((person) => (
                  <FlowCard key={person.id} {...cardProps(person)} onActivate={v.centerOn} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
