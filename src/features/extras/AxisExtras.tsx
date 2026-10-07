import type { AxisPage } from '../../content/schema';
import { BoundarySpectrum } from './BoundarySpectrum';
import { QuoteList } from './QuoteList';

/** 各主軸專屬區塊（PageFrame 的 extras 位置：舞台版在敘述下方，流式版在關係圖之後） */
export function AxisExtras({ page }: { page: AxisPage }) {
  const { boundary } = page.extras;
  if (boundary) return <BoundarySpectrum boundary={boundary} />;
  if (page.quotes?.length) return <QuoteList axis={page.axis} quotes={page.quotes} />;
  return null;
}
