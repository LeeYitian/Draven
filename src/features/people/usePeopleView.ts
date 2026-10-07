import { useMemo } from 'react';
import { people } from '../../content';
import { closePeople } from '../../lib/hash-router';
import { progress as progressOf } from '../../store/selectors';
import { useAppStore } from '../../store/store';
import { centerLayoutAt, arrangementFor, selectedIds } from './model';

/** 人物誌（舞台版與流式版共用）的狀態與動作：進度、排列、標籤、中心視角、追蹤 */
export function usePeopleView() {
  const page = useAppStore((s) => s.page);
  const unlocked = useAppStore((s) => s.page04Unlocked);
  const view = useAppStore((s) => s.people);
  const trackedId = useAppStore((s) => s.trackedPersonId);
  const setTag = useAppStore((s) => s.setTag);
  const setSort = useAppStore((s) => s.setSort);
  const centerOn = useAppStore((s) => s.centerOn);
  const clearCenter = useAppStore((s) => s.clearCenter);
  const setExpanded = useAppStore((s) => s.setExpanded);
  const trackPerson = useAppStore((s) => s.trackPerson);

  const progress = progressOf(page, unlocked);
  const selected = useMemo(() => selectedIds(view.tag), [view.tag]);
  const arrangement = useMemo(() => arrangementFor(view.sort), [view.sort]);
  const layout = useMemo(
    () => (view.center ? centerLayoutAt(view.center, progress) : null),
    [view.center, progress],
  );
  const centerPerson = view.center ? people.find((p) => p.id === view.center) : undefined;

  /** 追蹤：寫入追蹤、關閉人物誌回到原頁（直接由 #/people 進入者回到 00） */
  const track = (id: string) => {
    trackPerson(id);
    closePeople();
  };

  return {
    progress,
    ...view,
    selected,
    arrangement,
    layout,
    centerPerson,
    trackedId,
    setTag,
    setSort,
    centerOn,
    clearCenter,
    setExpanded,
    track,
  };
}
