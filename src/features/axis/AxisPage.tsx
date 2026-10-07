import { useEffect, useState } from 'react';
import { PageFrame } from '../../components/layout/PageFrame';
import { PageHeader } from '../../components/layout/PageHeader';
import { useLayout } from '../../components/layout/LayoutProvider';
import { Kbd } from '../../components/ui';
import { getAxisPage, t } from '../../content';
import { persistentStorage } from '../../lib/storage';
import { type AxisKey } from '../../store/store';
import { RelationGraph } from '../graph/RelationGraph';
import { EventBar, EventsLabel } from './EventBar';
import { NarrativePanel } from './NarrativePanel';

/** 第一次進入主軸（舞台版）：下方一行方向鍵提示，3 秒後淡出，之後不再顯示（contracts §2） */
function KeysHint() {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>(() =>
    persistentStorage.get('keysHintSeen', false) ? 'gone' : 'in',
  );

  // 每個階段各自排下一個階段的計時（phase 一變，上一個階段的計時就被清掉）
  useEffect(() => {
    if (phase === 'gone') return;
    if (phase === 'in') persistentStorage.set('keysHintSeen', true);
    const timer = window.setTimeout(
      () => setPhase(phase === 'in' ? 'out' : 'gone'),
      phase === 'in' ? 2700 : 300,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div
      role="status"
      data-keys-hint
      className="pointer-events-none absolute right-10 bottom-1 flex items-center gap-1.5 text-aux text-neutral-600 transition-opacity duration-300"
      style={{ opacity: phase === 'in' ? 1 : 0 }}
    >
      <Kbd>←</Kbd>
      <Kbd>→</Kbd>
      {t('keys.firstTime')}
    </div>
  );
}

/**
 * 主軸頁（01–04）：頁首、事件列、敘述面板、關係圖，排進統一的 PageFrame。
 * 各頁專屬區塊（01 光譜、02 比較滑桿…）之後以 extras 加入。
 */
export function AxisPage({ axis }: { axis: AxisKey }) {
  const { mode } = useLayout();
  const page = getAxisPage(axis);
  if (!page) return null;

  return (
    <>
      <PageFrame
        header={
          <PageHeader
            number={page.number}
            category={page.category}
            title={page.title}
            oneLiner={page.oneLiner}
            coreTheme={page.coreTheme}
          />
        }
        eventsLabel={
          <EventsLabel axis={axis} heading={page.eventsHeading} total={page.events.length} />
        }
        events={<EventBar axis={axis} events={page.events} />}
        narrative={<NarrativePanel axis={axis} events={page.events} />}
        graph={<RelationGraph axis={axis} page={page} />}
      />
      {mode === 'stage' && <KeysHint />}
    </>
  );
}
