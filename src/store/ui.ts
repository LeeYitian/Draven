import { create } from 'zustand';

/** 純介面開關（不需要持久化）：伏筆托盤、流式版的頁面選單 */
interface UiState {
  hintsTrayOpen: boolean;
  pagesMenuOpen: boolean;
  toggleHintsTray(): void;
  setHintsTray(open: boolean): void;
  setPagesMenu(open: boolean): void;
}

export const useUiStore = create<UiState>()((set) => ({
  hintsTrayOpen: false,
  pagesMenuOpen: false,
  toggleHintsTray: () => set((s) => ({ hintsTrayOpen: !s.hintsTrayOpen })),
  setHintsTray: (open) => set({ hintsTrayOpen: open }),
  setPagesMenu: (open) => set({ pagesMenuOpen: open }),
}));
