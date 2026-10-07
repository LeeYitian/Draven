import { create } from 'zustand';

/** 伏筆放置的結果回饋（框格震動／閃動用）；token 遞增，計時結束由框格清除 */
export interface HintFeedback {
  slotId: string;
  kind: 'solved' | 'wrong';
  token: number;
}

/** 純介面狀態（不需要持久化）：伏筆托盤、流式版頁面選單、伏筆拖曳與回饋、給螢幕閱讀器的播報 */
interface UiState {
  hintsTrayOpen: boolean;
  pagesMenuOpen: boolean;
  /** 正在拖曳關鍵字（框格顯示「放開以放入」而不是「點這裡放入」） */
  hintDragging: boolean;
  hintFeedback: HintFeedback | null;
  announcement: { text: string; token: number } | null;
  toggleHintsTray(): void;
  setHintsTray(open: boolean): void;
  setPagesMenu(open: boolean): void;
  setHintDragging(dragging: boolean): void;
  giveFeedback(slotId: string, kind: HintFeedback['kind']): void;
  clearFeedback(token: number): void;
  announce(text: string): void;
}

let feedbackToken = 0;
let announceToken = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  hintsTrayOpen: false,
  pagesMenuOpen: false,
  hintDragging: false,
  hintFeedback: null,
  announcement: null,
  toggleHintsTray: () => set((s) => ({ hintsTrayOpen: !s.hintsTrayOpen })),
  setHintsTray: (open) => set({ hintsTrayOpen: open }),
  setPagesMenu: (open) => set({ pagesMenuOpen: open }),
  setHintDragging: (hintDragging) => set({ hintDragging }),
  giveFeedback: (slotId, kind) => set({ hintFeedback: { slotId, kind, token: ++feedbackToken } }),
  clearFeedback: (token) => {
    if (get().hintFeedback?.token === token) set({ hintFeedback: null });
  },
  announce: (text) => set({ announcement: { text, token: ++announceToken } }),
}));
