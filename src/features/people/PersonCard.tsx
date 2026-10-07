import { Eye } from 'lucide-react';
import { Bookmark } from '../../components/ui';
import { t } from '../../content';
import type { Person } from '../../content/schema';
import { cn } from '../../lib/cn';
import type { Rect } from './center';

const pad = (n: number) => String(n).padStart(2, '0');

export interface TrackButtonProps {
  person: Pick<Person, 'id' | 'name'>;
  tracked: boolean;
  /** 手機版卡片上的圖示按鈕（32×32，無文字） */
  icon?: boolean;
  onTrack: (id: string) => void;
  className?: string;
}

/**
 * 「追蹤」：卡片內獨立的點擊區。stopPropagation，所以不會觸發人物中心視角；
 * 已追蹤時顯示「追蹤中」（再點不做事，取消追蹤在側欄的 ×）。
 */
export function TrackButton({ person, tracked, icon, onTrack, className }: TrackButtonProps) {
  const label = tracked ? t('tracking.badge') : t('tracking.button');
  return (
    <button
      type="button"
      className={cn(
        'track-btn',
        icon && 'h-8 w-8 justify-center border-transparent px-0',
        className,
      )}
      aria-pressed={tracked}
      aria-label={t(tracked ? 'tracking.pressedLabel' : 'tracking.buttonLabel', { name: person.name })}
      data-track={person.id}
      onClick={(event) => {
        event.stopPropagation();
        if (!tracked) onTrack(person.id);
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {tracked ? (
        <Bookmark className={icon ? '' : 'h-3 w-2'} />
      ) : (
        <Eye size={icon ? 16 : 14} strokeWidth={1.5} aria-hidden="true" />
      )}
      {!icon && label}
    </button>
  );
}

export interface PersonCardProps {
  person: Person;
  /** 卡片區本地座標與尺寸（由 slot 或中心視角指派） */
  rect: Rect;
  /** 已登場（金頂線）；否則灰階 */
  onStage: boolean;
  /** 被標籤選中（浮起）：與登場是兩個獨立通道 */
  selected: boolean;
  center: boolean;
  compact: boolean;
  tracked: boolean;
  /** 中心視角中「沒有直接關係」的卡片：0.7 透明度 */
  dim?: boolean;
  /** 位置過渡中暫時不接受操作（例如被展開浮層蓋住時） */
  onActivate: (id: string) => void;
  onTrack: (id: string) => void;
}

/**
 * 人物卡（設計稿 §6-H）：外層 slot 只負責位置與尺寸（transform／width／height 過渡），
 * 內層卡片負責登場／選中等視覺狀態，兩者的 transform 互不覆蓋。
 */
export function PersonCard({
  person,
  rect,
  onStage,
  selected,
  center,
  compact,
  tracked,
  dim,
  onActivate,
  onTrack,
}: PersonCardProps) {
  const label = t('people.cardLabel', { name: person.name, role: person.role });

  return (
    <div
      className="person-slot"
      data-person-slot={person.id}
      data-dim={dim || undefined}
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.w,
        height: rect.h,
        opacity: dim ? 0.7 : 1,
      }}
    >
      {/* 卡片本身不是按鈕（裡面還有「追蹤」按鈕，按鈕不能包按鈕）：疊一顆透明的整張卡按鈕負責聚焦與鍵盤，點擊冒泡到卡片 */}
      <div
        className="person-card"
        data-fill
        data-person={person.id}
        data-on={onStage || undefined}
        data-selected={selected || undefined}
        data-center={center || undefined}
        data-compact={compact || undefined}
        data-tracked={tracked || undefined}
        onClick={() => onActivate(person.id)}
      >
        <button type="button" className="card-hit" aria-label={label} />
        {compact ? (
          <>
            <span className="person-card__name" aria-hidden="true">{person.name}</span>
            <span className="person-card__role truncate" aria-hidden="true">
              {person.role}
            </span>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="person-card__name" aria-hidden="true">
                {person.name}
              </span>
              <TrackButton person={person} tracked={tracked} onTrack={onTrack} />
            </div>
            <div className="flex items-center gap-2">
              <span className="person-card__role min-w-0 flex-1 truncate" aria-hidden="true">
                {person.role}
              </span>
              {person.spoilerAxis && (
                <span className="flex-none rounded-[3px] border border-dashed border-neutral-400 px-1.5 text-aux leading-[18px] text-neutral-600">
                  {t('people.spoilerTag', { axis: pad(person.spoilerAxis) })}
                </span>
              )}
            </div>
            <div className="person-card__intro line-clamp-2" aria-hidden="true">
              {person.intro}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

