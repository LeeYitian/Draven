import { create } from 'zustand';

/**
 * 目前開啟的 Popover（單例）。連結元件（人名、名詞）只負責「觸發」，
 * Popover 的內容與定位由 PopoverLayer 負責（任務 T070，User Story 3）。
 */
export interface PopoverTarget {
  kind: 'person' | 'term';
  id: string;
  /** 錨點元素（定位用；舞台版以 rectToLocal 換成舞台座標） */
  anchor: HTMLElement;
  /** 區分「同一個人名在不同位置」的錨點 */
  anchorKey: string;
}

interface PopoverState {
  open: PopoverTarget | null;
  /** 再點同一個錨點＝關閉；點另一個＝切換 */
  togglePopover(target: PopoverTarget): void;
  closePopover(): void;
}

export const usePopoverStore = create<PopoverState>()((set, get) => ({
  open: null,
  togglePopover(target) {
    const current = get().open;
    set({ open: current && current.anchorKey === target.anchorKey ? null : target });
  },
  closePopover: () => set({ open: null }),
}));
