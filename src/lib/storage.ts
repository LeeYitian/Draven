/**
 * localStorage／sessionStorage 的安全包裝。
 * 隱私模式、封鎖網站資料、額度已滿時，瀏覽器會在「存取」或「寫入」時丟錯；
 * 這裡一律吞掉並退化為記憶體，讓網站照常運作，只是進度不保存（spec Edge Cases）。
 */
export interface SafeStorage {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

const PREFIX = 'draven:';

export function createSafeStorage(getBackend: () => Storage): SafeStorage {
  const memory = new Map<string, string>();

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
      let raw: string | null = memory.get(full) ?? null;
      if (raw === null) {
        try {
          raw = backend()?.getItem(full) ?? null;
        } catch {
          raw = null;
        }
      }
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
      memory.set(full, raw); // 一律先寫記憶體，寫入失敗時本次工作階段仍讀得到
      try {
        backend()?.setItem(full, raw);
      } catch {
        /* 額度已滿或被封鎖：略過 */
      }
    },
    remove(key: string) {
      const full = PREFIX + key;
      memory.delete(full);
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
