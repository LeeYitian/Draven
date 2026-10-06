/**
 * 方向鍵合約（contracts/state-and-events.md §2）：決定一個 keydown 該做什麼。
 * 純函式，不碰 DOM 事件本身，方便測試；useGlobalKeys 負責掛監聽與執行。
 *
 *  ↑↓ 換頁（00–04，邊界不動作）；←→ 推進事件（僅 01–04）。
 *  略過：元件已處理（defaultPrevented）、焦點在輸入元件／滑桿、人物誌開啟、流式版、帶修飾鍵、
 *       04 遮罩未打開時的 ←→。
 */
export interface KeyContext {
  mode: 'stage' | 'flow';
  page: 0 | 1 | 2 | 3 | 4;
  peopleOpen: boolean;
  page04Unlocked: boolean;
}

export interface KeyLike {
  key: string;
  defaultPrevented: boolean;
  target: EventTarget | null;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type KeyAction = { type: 'page'; delta: 1 | -1 } | { type: 'event'; delta: 1 | -1 } | null;

const SKIP_TARGETS =
  'input, textarea, select, [contenteditable], [role="slider"], [data-no-arrows]';

function isSkippedTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return (target as Element).closest(SKIP_TARGETS) !== null;
}

export function resolveKey(event: KeyLike, ctx: KeyContext): KeyAction {
  if (event.defaultPrevented) return null; // 元件（光譜、比較滑桿）已經處理過
  if (ctx.mode !== 'stage' || ctx.peopleOpen) return null;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  if (isSkippedTarget(event.target)) return null;

  switch (event.key) {
    case 'ArrowDown':
      return ctx.page < 4 ? { type: 'page', delta: 1 } : null;
    case 'ArrowUp':
      return ctx.page > 0 ? { type: 'page', delta: -1 } : null;
    case 'ArrowRight':
    case 'ArrowLeft': {
      if (ctx.page === 0) return null;
      if (ctx.page === 4 && !ctx.page04Unlocked) return null; // 遮罩蓋住時不推進看不到的事件
      return { type: 'event', delta: event.key === 'ArrowRight' ? 1 : -1 };
    }
    default:
      return null;
  }
}
