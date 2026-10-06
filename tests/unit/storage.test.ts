import { describe, expect, it } from 'vitest';
import { createSafeStorage } from '../../src/lib/storage';

function memoryBackend(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('createSafeStorage', () => {
  it('寫入後可讀回（JSON），並加上 draven: 前綴', () => {
    const backend = memoryBackend();
    const store = createSafeStorage(() => backend);
    store.set('hints', { owned: ['a', 'b'] });
    expect(store.get('hints', null)).toEqual({ owned: ['a', 'b'] });
    expect(backend.getItem('draven:hints')).toBe('{"owned":["a","b"]}');
  });

  it('沒有資料時回傳預設值', () => {
    const store = createSafeStorage(() => memoryBackend());
    expect(store.get('missing', 42)).toBe(42);
  });

  it('資料損壞（不是合法 JSON）時回傳預設值，不丟錯', () => {
    const backend = memoryBackend();
    backend.setItem('draven:x', '{壞掉的');
    expect(createSafeStorage(() => backend).get('x', 'fallback')).toBe('fallback');
  });

  it('remove 會刪除', () => {
    const store = createSafeStorage(() => memoryBackend());
    store.set('k', 1);
    store.remove('k');
    expect(store.get('k', 0)).toBe(0);
  });

  it('隱私模式：取得 storage 時丟錯 → 退化為記憶體，行為不變', () => {
    const store = createSafeStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    store.set('tracked', 'elian');
    expect(store.get('tracked', null)).toBe('elian');
    store.remove('tracked');
    expect(store.get('tracked', null)).toBeNull();
  });

  it('寫入時配額已滿（setItem 丟錯）→ 值仍可在本次工作階段讀到', () => {
    const backend = memoryBackend();
    backend.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    const store = createSafeStorage(() => backend);
    store.set('solved', ['x']);
    expect(store.get('solved', [])).toEqual(['x']);
  });
});
