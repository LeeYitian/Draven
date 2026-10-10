import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { isBookmark, type Bookmark } from '../features/reader/bookmark.ts';
import { persistentStorage } from '../lib/storage.ts';

/**
 * 好讀版的個人設定與書籤（存在讀者的瀏覽器）。
 * 與導覽的「重置進度」無關：重置不會清除這裡的資料。
 */
export type ReaderTheme = 'light' | 'dark';
export const FONT_SIZES = [0, 1, 2, 3] as const;
export type FontSize = (typeof FONT_SIZES)[number];

interface ReaderState {
  /** null＝尚未手動選擇，跟隨系統 */
  theme: ReaderTheme | null;
  fontSize: FontSize;
  bookmark: Bookmark | null;
  setTheme(theme: ReaderTheme): void;
  setFontSize(size: FontSize): void;
  setBookmark(bookmark: Bookmark | null): void;
}

const savedTheme = persistentStorage.get<unknown>('reader.theme', null);
const savedSize = persistentStorage.get<unknown>('reader.fontSize', 1);
const savedBookmark = persistentStorage.get<unknown>('reader.bookmark', null);

export const useReaderStore = create<ReaderState>()((set) => ({
  theme: savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : null,
  fontSize: FONT_SIZES.includes(savedSize as FontSize) ? (savedSize as FontSize) : 1,
  bookmark: isBookmark(savedBookmark) ? savedBookmark : null,
  setTheme: (theme) => {
    persistentStorage.set('reader.theme', theme);
    set({ theme });
  },
  setFontSize: (fontSize) => {
    persistentStorage.set('reader.fontSize', fontSize);
    set({ fontSize });
  },
  setBookmark: (bookmark) => {
    if (bookmark) persistentStorage.set('reader.bookmark', bookmark);
    else persistentStorage.remove('reader.bookmark');
    set({ bookmark });
  },
}));

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** 目前實際使用的深淺色：手動選擇優先，否則跟隨系統（系統改變時即時更新） */
export function useEffectiveTheme(): ReaderTheme {
  const stored = useReaderStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(DARK_QUERY);
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return stored ?? (systemDark ? 'dark' : 'light');
}
