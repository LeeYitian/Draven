import type { AxisExtrasBoundary, AxisPage } from '../../content/schema';
import { useAppStore } from '../../store/store';
import { BoundarySpectrum } from './BoundarySpectrum';
import { ChoiceBlock } from './ChoiceBlock';
import { MirrorCard } from './MirrorCard';
import { Postcard } from './Postcard';
import { QuoteList } from './QuoteList';

/** 01：邊界之辯光譜從 showFromEvent 事件起才出現（之前的事件不佔版面） */
function BoundaryExtra({
  axis,
  boundary,
}: {
  axis: AxisPage['axis'];
  boundary: AxisExtrasBoundary;
}) {
  const eventNumber = useAppStore((s) => s.axis[axis].eventIndex) + 1;
  if (eventNumber < boundary.showFromEvent) return null;
  return <BoundarySpectrum boundary={boundary} />;
}

/** 04：依目前事件決定專屬區塊（事件 03 鏡像卡、事件 05 明信片、事件 06 抉擇；其餘事件沒有） */
function EventExtras({ page }: { page: AxisPage }) {
  const eventNumber = useAppStore((s) => s.axis[page.axis].eventIndex) + 1;
  const { eventExtras, mirror, postcard, choice } = page.extras;
  if (!eventExtras) return null;
  const kind = eventExtras.byEvent[String(eventNumber)] ?? eventExtras.default;

  let block = null;
  if (kind === 'mirror' && mirror) block = <MirrorCard mirror={mirror} />;
  else if (kind === 'postcard' && postcard) block = <Postcard postcard={postcard} />;
  else if (kind === 'choice' && choice) block = <ChoiceBlock choice={choice} />;
  if (!block) return null;

  // key＝區塊種類：換到另一種區塊時重新掛載並淡入；同一種區塊跨事件保留（鏡像卡翻到哪一面不會被重設）
  return (
    <div
      key={kind}
      data-event-extra={kind}
      className="animate-fade-in flex justify-center stage:w-[470px]"
    >
      {block}
    </div>
  );
}

/** 各主軸專屬區塊（PageFrame 的 extras 位置：舞台版在敘述下方，流式版在關係圖之前） */
export function AxisExtras({ page }: { page: AxisPage }) {
  const { boundary, eventExtras } = page.extras;
  if (boundary) return <BoundaryExtra axis={page.axis} boundary={boundary} />;
  if (page.quotes?.length) return <QuoteList axis={page.axis} quotes={page.quotes} />;
  if (eventExtras) return <EventExtras page={page} />;
  return null;
}
