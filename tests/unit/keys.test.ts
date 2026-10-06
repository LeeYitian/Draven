import { describe, expect, it } from 'vitest';
import { resolveKey, type KeyContext } from '../../src/features/axis/resolveKey';

const base: KeyContext = { mode: 'stage', page: 2, peopleOpen: false, page04Unlocked: true };

function key(
  name: string,
  opts: {
    target?: Element | null;
    prevented?: boolean;
    mods?: Partial<Record<'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey', boolean>>;
  } = {},
) {
  return {
    key: name,
    defaultPrevented: opts.prevented ?? false,
    target: opts.target ?? document.body,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    ...opts.mods,
  };
}

describe('resolveKey：基本動作（舞台版）', () => {
  it('↓／↑ 換頁（00–04）', () => {
    expect(resolveKey(key('ArrowDown'), base)).toEqual({ type: 'page', delta: 1 });
    expect(resolveKey(key('ArrowUp'), base)).toEqual({ type: 'page', delta: -1 });
  });

  it('頁面邊界不動作：00 按 ↑、04 按 ↓', () => {
    expect(resolveKey(key('ArrowUp'), { ...base, page: 0 })).toBeNull();
    expect(resolveKey(key('ArrowDown'), { ...base, page: 4 })).toBeNull();
  });

  it('→／← 只在 01–04 推進事件', () => {
    expect(resolveKey(key('ArrowRight'), base)).toEqual({ type: 'event', delta: 1 });
    expect(resolveKey(key('ArrowLeft'), base)).toEqual({ type: 'event', delta: -1 });
    expect(resolveKey(key('ArrowRight'), { ...base, page: 0 })).toBeNull();
  });

  it('其他按鍵不處理', () => {
    expect(resolveKey(key('Enter'), base)).toBeNull();
    expect(resolveKey(key('a'), base)).toBeNull();
  });
});

describe('resolveKey：必須略過的情況（contracts/state-and-events.md §2）', () => {
  it('元件已處理過（defaultPrevented）', () => {
    expect(resolveKey(key('ArrowRight', { prevented: true }), base)).toBeNull();
  });

  it('焦點在 input、textarea、select、contenteditable', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(
        resolveKey(key('ArrowRight', { target: document.createElement(tag) }), base),
      ).toBeNull();
    }
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(resolveKey(key('ArrowRight', { target: editable }), base)).toBeNull();
  });

  it('焦點在 [role=slider]（光譜、比較滑桿）或其子孫、或 [data-no-arrows]', () => {
    const slider = document.createElement('div');
    slider.setAttribute('role', 'slider');
    expect(resolveKey(key('ArrowLeft', { target: slider }), base)).toBeNull();

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-no-arrows', '');
    const child = document.createElement('span');
    wrapper.appendChild(child);
    expect(resolveKey(key('ArrowLeft', { target: child }), base)).toBeNull();
  });

  it('人物誌開啟時不處理', () => {
    expect(resolveKey(key('ArrowDown'), { ...base, peopleOpen: true })).toBeNull();
    expect(resolveKey(key('ArrowRight'), { ...base, peopleOpen: true })).toBeNull();
  });

  it('流式版（含桌機窄視窗）不處理，保留原生捲動', () => {
    expect(resolveKey(key('ArrowDown'), { ...base, mode: 'flow' })).toBeNull();
  });

  it('帶修飾鍵（瀏覽器快捷鍵）不處理', () => {
    for (const mod of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey'] as const) {
      expect(resolveKey(key('ArrowRight', { mods: { [mod]: true } }), base)).toBeNull();
    }
  });

  it('04 遮罩未打開：只允許 ↑↓（←→ 不能推進被遮住的事件）', () => {
    const locked = { ...base, page: 4 as const, page04Unlocked: false };
    expect(resolveKey(key('ArrowRight'), locked)).toBeNull();
    expect(resolveKey(key('ArrowLeft'), locked)).toBeNull();
    expect(resolveKey(key('ArrowUp'), locked)).toEqual({ type: 'page', delta: -1 });
  });

  it('04 遮罩打開後 ←→ 恢復', () => {
    expect(resolveKey(key('ArrowRight'), { ...base, page: 4, page04Unlocked: true })).toEqual({
      type: 'event',
      delta: 1,
    });
  });
});
