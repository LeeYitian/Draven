import { Dock } from '../components/layout/Dock';
import { FlowShell } from '../components/layout/FlowShell';
import { LayoutProvider, useLayout } from '../components/layout/LayoutProvider';
import { PageFrame } from '../components/layout/PageFrame';
import { PageHeader } from '../components/layout/PageHeader';
import { Stage } from '../components/layout/Stage';
import { Kbd } from '../components/ui';

// 開發專用：主軸頁框架網格示範（#/__kit/frame）。用虛線方塊標出設計稿 §1-A 的各區，
// 並以瀏覽器量測座標對照設計稿數值（任務 T041 的驗收）。

const box = 'border border-dashed border-accent bg-accent-100/40 text-aux text-accent-800';

function Events() {
  return (
    <div
      className="grid h-full"
      style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', columnGap: 8 }}
    >
      {['政策佈局', '異族入朝', '朝堂博弈', '酒吧衝突', '邊界之辯', '地底迴響'].map((title, i) => (
        <button
          key={title}
          className="event-cell"
          data-frame="event"
          data-state={i < 4 ? 'past' : i === 4 ? 'current' : 'upcoming'}
        >
          <span className="event-cell__num">{String(i + 1).padStart(2, '0')}</span>
          <span className="event-cell__title">{title}</span>
        </button>
      ))}
    </div>
  );
}

function Demo() {
  const { mode } = useLayout();
  const frame = (
    <PageFrame
      header={
        <PageHeader
          number="01"
          category="第一主軸 · 政治與文化主線"
          title="統一之杖：荊棘之王德雷文"
          oneLiner="以強硬權術推動多族平等，從朝堂延伸到基層與信仰。"
          coreTheme="共榮不是抹滅差異，而是理解差異、尊重彼此的底線。"
        />
      }
      eventsLabel={
        <>
          <span className="eyebrow">事件進程</span>
          <span className="flex items-center gap-1.5 text-aux text-neutral-600">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>切換事件
          </span>
        </>
      }
      events={<Events />}
      narrative={
        <div className={`${box} h-[260px] p-2`} data-frame="narrative">
          敘述面板：文字 470 ＋ 旁註欄 150（左欄 620）
        </div>
      }
      extras={
        <div className={`${box} min-h-0 flex-1 p-2`} data-frame="extras">
          本頁專屬區塊
        </div>
      }
      graph={
        <div className={`${box} h-full min-h-[300px] p-2`} data-frame="graph">
          關係圖 628×457
        </div>
      }
    />
  );

  return mode === 'stage' ? (
    <Stage>
      {frame}
      <Dock />
    </Stage>
  ) : (
    <FlowShell>
      {frame}
      <Dock />
    </FlowShell>
  );
}

export default function FrameDemo() {
  return (
    <LayoutProvider>
      <Demo />
    </LayoutProvider>
  );
}
