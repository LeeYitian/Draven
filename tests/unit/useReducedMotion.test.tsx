import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useReducedMotion } from '../../src/lib/useReducedMotion';

type Listener = (event: { matches: boolean }) => void;

function installMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const state = { matches: initial };
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes('reduce') ? state.matches : false;
    },
    media: query,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
  })) as unknown as typeof window.matchMedia;
  return {
    set(value: boolean) {
      state.matches = value;
      listeners.forEach((cb) => cb({ matches: value }));
    },
    listenerCount: () => listeners.size,
  };
}

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});

describe('useReducedMotion', () => {
  it('回傳目前的 prefers-reduced-motion 設定', () => {
    installMatchMedia(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
    installMatchMedia(false);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it('使用者在作業系統切換設定時即時更新', () => {
    const media = installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => media.set(true));
    expect(result.current).toBe(true);
  });

  it('卸載後移除監聽', () => {
    const media = installMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('沒有 matchMedia 的環境（舊瀏覽器、SSR）視為不減少動態', () => {
    // @ts-expect-error 刻意移除
    window.matchMedia = undefined;
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });
});
