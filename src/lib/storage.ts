/**
 * localStorage／sessionStorage 的安全包裝。
 * 隱私模式、封鎖網站資料、額度已滿時，瀏覽器會在「存取」或「寫入」時丟錯；
 * 這裡一律吞掉並退化為記憶體，讓網站照常運作，只是進度不保存（spec Edge Cases）。
 *
 * 資料來源優先序：瀏覽器儲存為準（使用者或其他分頁清除資料後，這裡也要看得到）；
 * 記憶體只保存「寫入瀏覽器儲存失敗」的值，當作本次工作階段的備援。
 */
export interface SafeStorage {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

const PREFIX = 'draven:';

export function createSafeStorage(getBackend: () => Storage): SafeStorage {
  const fallbackMemory = new Map<string, string>();

  const backend = (): Storage | null => {
    try {
      return getBackend();
    } catch {
      return null;
    }
  };

  return {
    get<T>(key: string, fallback: T): T {
      const full = PREFIX + key;
      let raw: string | null;
      try {
        raw = backend()?.getItem(full) ?? null;
      } catch {
        raw = null;
      }
      if (raw === null) raw = fallbackMemory.get(full) ?? null;
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown) {
      const full = PREFIX + key;
      const raw = JSON.stringify(value);
      try {
        const store = backend();
        if (!store) throw new Error('storage unavailable');
        store.setItem(full, raw);
        fallbackMemory.delete(full); // 寫入成功：以瀏覽器儲存為準
      } catch {
        fallbackMemory.set(full, raw); // 隱私模式或額度已滿：本次工作階段改存記憶體
      }
    },
    remove(key: string) {
      const full = PREFIX + key;
      fallbackMemory.delete(full);
      try {
        backend()?.removeItem(full);
      } catch {
        /* 略過 */
      }
    },
  };
}

/** 跨工作階段保存：追蹤對象、伏筆進度 */
export const persistentStorage = createSafeStorage(() => window.localStorage);
/** 只在本次分頁保存：04 劇透遮罩是否已打開（設計稿指定 sessionStorage） */
export const sessionOnlyStorage = createSafeStorage(() => window.sessionStorage);
