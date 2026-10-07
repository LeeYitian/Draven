import { Button } from '../../components/ui';
import { t } from '../../content';
import type { AxisExtrasCover } from '../../content/schema';
import { useAppStore } from '../../store/store';

/**
 * 04 劇透遮罩（G-14）：頁首以下蓋上紙色遮罩（不模糊，避免讀出底下的內容），側欄與 ↑↓ 仍可用。
 * 位置由 PageFrame 決定（舞台版蓋在頁首以下的整個區域，流式版直接取代頁首以下的內容）；
 * 遮罩存在時底下的內容 inert；←→ 在 04 無效（resolveKey）；打開後記入 sessionStorage，進度才算到 4、才獲得 04 的伏筆。
 */
export function SpoilerCover({ cover }: { cover: AxisExtrasCover }) {
  const unlock = useAppStore((s) => s.unlockPage04);
  return (
    <div className="spoiler-cover" data-spoiler-cover role="region" aria-label={t('cover.label')}>
      <div className="spoiler-cover__box">
        <h2 className="spoiler-cover__title">{cover.title}</h2>
        <p className="spoiler-cover__body">{cover.body}</p>
        <Button variant="primary" className="h-11 px-6" onClick={unlock}>
          {cover.button}
        </Button>
      </div>
    </div>
  );
}
