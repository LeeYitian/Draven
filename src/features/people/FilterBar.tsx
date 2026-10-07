import { Chip } from '../../components/ui';
import { t } from '../../content';
import { GROUP_IDS, TAG_IDS } from '../../content/schema';
import { cn } from '../../lib/cn';

const AXES = [1, 2, 3, 4] as const;

export interface FilterBarProps {
  /** 目前選中的標籤鍵（單選），例如 'group:royal'、'axis:2'、'tag:family'；沒有則為 null */
  value: string | null;
  onToggle: (key: string) => void;
  className?: string;
}

/**
 * 篩選標籤（任務 T082）：群體／主軸／關係標籤三組，全部合起來單選；再點同一個取消。
 * 選中只是「浮起」卡片，不隱藏、不重排。內容太多時橫向捲動（手機版單列）。
 */
export function FilterBar({ value, onToggle, className }: FilterBarProps) {
  const groups: { label: string; items: { key: string; label: string }[] }[] = [
    {
      label: t('people.filter.group'),
      items: GROUP_IDS.map((id) => ({ key: `group:${id}`, label: t(`people.groups.${id}`) })),
    },
    {
      label: t('people.filter.axis'),
      items: AXES.map((n) => ({ key: `axis:${n}`, label: `0${n}` })),
    },
    {
      label: t('people.filter.tag'),
      items: TAG_IDS.map((id) => ({ key: `tag:${id}`, label: t(`people.tags.${id}`) })),
    },
  ];
  return (
    <div
      data-filter-bar
      className={cn('flex items-center gap-[22px] overflow-x-auto [scrollbar-width:none]', className)}
    >
      {groups.map((group) => (
        <div key={group.label} role="group" aria-label={group.label} className="flex flex-none items-center gap-1.5">
          <span className="mr-1 text-aux whitespace-nowrap text-neutral-600">{group.label}</span>
          {group.items.map((item) => (
            <Chip
              key={item.key}
              variant="filter"
              pressed={value === item.key}
              data-filter={item.key}
              onClick={() => onToggle(item.key)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      ))}
    </div>
  );
}
