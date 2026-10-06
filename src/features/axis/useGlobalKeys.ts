import { useEffect } from 'react';
import { getAxisPage } from '../../content';
import { useLayout } from '../../components/layout/LayoutProvider';
import { navigate, routeForPage } from '../../lib/hash-router';
import { useAppStore, type AxisKey } from '../../store/store';
import { resolveKey } from './resolveKey';

/** 事件數的預設值（主軸頁內容尚未載入時使用；01、02、04 為 6，03 為 7） */
const FALLBACK_EVENT_COUNT = 6;

/**
 * 全域方向鍵（舞台版）：↑↓ 換頁、←→ 推進事件。規則與略過條件見 resolveKey。
 * 真正執行時 preventDefault()，擋掉瀏覽器原生的捲動。
 */
export function useGlobalKeys() {
  const { mode } = useLayout();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useAppStore.getState();
      const action = resolveKey(event, {
        mode,
        page: state.page,
        peopleOpen: state.peopleOpen,
        page04Unlocked: state.page04Unlocked,
      });
      if (!action) return;
      event.preventDefault();
      if (action.type === 'page') {
        navigate(routeForPage(state.page + action.delta));
      } else {
        const axis = state.page as AxisKey;
        state.stepEvent(
          axis,
          action.delta,
          getAxisPage(axis)?.events.length ?? FALLBACK_EVENT_COUNT,
        );
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode]);
}
