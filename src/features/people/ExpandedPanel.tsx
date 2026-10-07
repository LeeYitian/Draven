import { X } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { t } from '../../content';
import type { Person } from '../../content/schema';
import { PEOPLE } from '../../lib/stage-metrics';
import { CENTER_RECT } from './center';
import { PersonBio } from './PersonBio';
import { TrackButton } from './PersonCard';

/**
 * 展開浮層（任務 T085）：從中心卡片「原位」放大成 600×508。
 * 位置與起點都是已知資料（中心卡固定在卡片區 (436, 212)），所以不需要量測 DOM：
 * 以 CSS 變數把「卡片相對浮層的位移與縮放」交給 keyframes（expand-in／expand-out）。
 * 座標是舞台座標（浮層與卡片區同在人物誌抽屜內）。
 */
const { expanded, area } = PEOPLE;
const CARD = {
  x: area.x + CENTER_RECT.x,
  y: area.y + CENTER_RECT.y,
  w: CENTER_RECT.w,
  h: CENTER_RECT.h,
};
/** 水平置中在中心卡上（設計稿 D：卡中心 x=608 → 浮層左緣 308）；上緣固定 168 */
export const PANEL = { x: CARD.x + CARD.w / 2 - expanded.width / 2, y: 168 } as const;

const fromCard: CSSProperties = {
  ['--fx' as string]: `${CARD.x - PANEL.x}px`,
  ['--fy' as string]: `${CARD.y - PANEL.y}px`,
  ['--fsx' as string]: CARD.w / expanded.width,
  ['--fsy' as string]: CARD.h / expanded.height,
};

export interface ExpandedPanelProps {
  person: Person;
  progress: number;
  tracked: boolean;
  closing: boolean;
  onTrack: (id: string) => void;
  onClose: () => void;
}

export function ExpandedPanel({ person, progress, tracked, closing, onTrack, onClose }: ExpandedPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={person.name}
      tabIndex={-1}
      data-expanded-panel
      data-closing={closing}
      className="expand-anim absolute z-[2] box-border flex flex-col gap-4 overflow-hidden rounded-md border border-accent border-t-2 bg-bg px-8 pt-[26px] pb-6 shadow-lg outline-none"
      style={{
        left: PANEL.x,
        top: PANEL.y,
        width: expanded.width,
        height: expanded.height,
        ...fromCard,
      }}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-[34px] leading-[1.1] font-medium">{person.name}</span>
            <span className="rounded-[3px] border border-divider px-2 py-px text-aux text-neutral-700">
              {t(`people.groups.${person.group}`)}
            </span>
          </div>
          <span className="text-[14px] text-accent-700">{person.role}</span>
        </div>
        <TrackButton person={person} tracked={tracked} onTrack={onTrack} className="h-8 px-2.5 text-[14px]" />
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-divider text-neutral-800 hover:bg-accent-100"
          aria-label={t('people.collapseCard')}
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="border-t border-divider" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" data-no-arrows>
        <PersonBio person={person} progress={progress} />
      </div>
    </div>
  );
}
