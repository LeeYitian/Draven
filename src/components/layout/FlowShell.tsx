import type { ReactNode } from 'react';
import { LAYOUT_RULES } from '../../lib/stage-metrics';

/**
 * 流式版容器：正常捲動頁，最大寬 640 置中（平板直立不會把手機排版拉爆）。
 * 底部保留底部導覽列的高度（64＋安全區），內容不會被它蓋住。
 */
export function FlowShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-flow
      className="mx-auto min-h-dvh bg-bg px-6 pb-[calc(76px+env(safe-area-inset-bottom))]"
      style={{ maxWidth: LAYOUT_RULES.flowMaxWidth }}
    >
      {children}
    </div>
  );
}
