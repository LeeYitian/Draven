import { NameLink, RichText } from '../../components/text/RichText';
import { Bookmark, Eyebrow } from '../../components/ui';
import type { Quote } from '../../content/schema';
import { useAppStore, type AxisKey } from '../../store/store';

/**
 * 03 的引言區（設計稿 J）：預設整頁常駐（showFromEvent 可調成「事件 N 起才顯示」）；
 * 說話者是被追蹤的人時，引言左上掛書籤；舞台版放在敘述下方，內容多時區塊內捲動。
 */
export function QuoteList({ axis, quotes }: { axis: AxisKey; quotes: readonly Quote[] }) {
  const eventNumber = useAppStore((s) => s.axis[axis].eventIndex) + 1;
  const tracked = useAppStore((s) => s.trackedPersonId);
  const shown = quotes.filter((q) => eventNumber >= q.showFromEvent);
  if (shown.length === 0) return null;

  return (
    <div
      data-quotes
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto stage:pr-1 flow:flex-none"
    >
      {shown.map((q) => (
        <figure
          key={q.id}
          data-quote={q.id}
          data-current={q.event === eventNumber || undefined}
          data-tracked={q.speaker === tracked || undefined}
          className="quote"
        >
          {q.speaker === tracked && <Bookmark className="quote__bookmark" />}
          <Eyebrow>{q.title}</Eyebrow>
          <blockquote className="quote__text">
            <RichText text={q.text} />
          </blockquote>
          <figcaption className="quote__who">
            — <NameLink personId={q.speaker} />
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
