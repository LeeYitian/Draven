import { useUiStore } from '../../store/ui';

/** 給螢幕閱讀器的播報區（答對、答錯等狀態變化；文字取自 ui.yaml，見 contracts §9） */
export function LiveRegion() {
  const announcement = useUiStore((s) => s.announcement);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-live-region>
      {announcement?.text}
    </div>
  );
}
