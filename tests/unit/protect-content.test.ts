import { afterEach, describe, expect, it } from 'vitest';
import { installContentProtection } from '../../src/lib/protect-content';

const cleanups: Array<() => void> = [];
function install(options?: Parameters<typeof installContentProtection>[0]) {
  const off = installContentProtection(options);
  cleanups.push(off);
  return off;
}
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function fire(type: string): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  return event;
}

// jsdom 沒有 ClipboardEvent／DataTransfer，用最小的假物件模擬剪貼簿
function fireCopy() {
  const store = new Map<string, string>([['text/plain', '原本選到的文字']]);
  const event = new Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? '',
    },
  });
  document.dispatchEvent(event);
  return { event, text: store.get('text/plain') };
}

describe('installContentProtection', () => {
  it('取消 selectstart、dragstart、cut', () => {
    install();
    expect(fire('selectstart').defaultPrevented).toBe(true);
    expect(fire('dragstart').defaultPrevented).toBe(true);
    expect(fire('cut').defaultPrevented).toBe(true);
  });

  it('copy 會被取消，且剪貼簿內容被清空', () => {
    install();
    const { event, text } = fireCopy();
    expect(event.defaultPrevented).toBe(true);
    expect(text).toBe('');
  });

  it('預設不攔截右鍵選單；開旗標後才攔截', () => {
    const off = install();
    expect(fire('contextmenu').defaultPrevented).toBe(false);
    off();
    install({ contextMenu: true });
    expect(fire('contextmenu').defaultPrevented).toBe(true);
  });

  it('回傳的函式會移除所有監聽', () => {
    const off = install({ contextMenu: true });
    off();
    expect(fire('selectstart').defaultPrevented).toBe(false);
    expect(fire('contextmenu').defaultPrevented).toBe(false);
    expect(fireCopy().event.defaultPrevented).toBe(false);
  });
});
