import { Lock } from 'lucide-react';
import { type ReactNode } from 'react';

export interface SpoilerProps {
  revealed: boolean;
  onToggle: () => void;
  /** 遮蔽時的標頭文字，例如「劇透 · 04 讀完第 04 主軸後解鎖（點擊仍可查看）」 */
  lockedLabel: string;
  /** 顯示時的標頭文字，例如「劇透 · 03 · 已顯示」 */
  shownLabel: string;
  hideLabel: string;
  /** 遮蔽時顯示幾條灰條（約每 30 字一條） */
  lines?: number;
  children: ReactNode;
}

const BAR_WIDTHS = ['100%', '92%', '64%', '80%', '70%'];

/**
 * 劇透區塊：預設遮蔽，只有讀者點擊才顯示、可再隱藏；不依進度自動打開。
 * 遮蔽時只畫灰條，**不渲染 children**——真實文字不會進 DOM，無法被選取、搜尋或讀出（憲章 V）。
 */
export function Spoiler({
  revealed,
  onToggle,
  lockedLabel,
  shownLabel,
  hideLabel,
  lines = 3,
  children,
}: SpoilerProps) {
  if (!revealed) {
    return (
      <button type="button" className="spoiler" onClick={onToggle} aria-expanded={false}>
        <span className="spoiler__head">
          <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
          {lockedLabel}
        </span>
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className="spoiler__bar"
            style={{ width: BAR_WIDTHS[i % BAR_WIDTHS.length] }}
            aria-hidden="true"
          />
        ))}
      </button>
    );
  }
  return (
    <div className="spoiler" data-revealed="">
      <div className="spoiler__head">
        <span>{shownLabel}</span>
        <button type="button" className="ml-auto text-accent-800" onClick={onToggle} aria-expanded>
          {hideLabel}
        </button>
      </div>
      {children}
    </div>
  );
}
