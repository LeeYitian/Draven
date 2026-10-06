import { useEffect, useState, type ReactNode } from 'react';

// 開發專用「元件圖鑑」：把共用樣式的每個狀態列出來，對照設計稿 §6 目視驗收（任務 T018）。
// 只在開發模式、網址 #/__kit 時載入，不進正式版。

type Mode = 'stage' | 'flow' | 'compact';

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-12">
      <div className="mb-4 flex items-baseline gap-3 border-t border-ink pt-3">
        <span className="font-heading text-[22px] text-accent-700">{id}</span>
        <h2 className="font-heading text-[28px]">{title}</h2>
        {note && <span className="text-aux text-neutral-600">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex min-h-[52px] items-center">{children}</div>
      <span className="text-aux text-neutral-600">{label}</span>
    </div>
  );
}

const Chev = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

function EventCell({
  n,
  title,
  state,
  tracked,
  marked,
}: {
  n: string;
  title: string;
  state: 'upcoming' | 'current' | 'past';
  tracked?: boolean;
  marked?: boolean;
}) {
  return (
    <button
      className="event-cell w-[190px]"
      data-state={state}
      data-tracked={tracked || undefined}
      data-marked={marked || undefined}
    >
      <span className="event-cell__num">{n}</span>
      <span className="event-cell__title">{title}</span>
      <Chev className="event-cell__chev" />
    </button>
  );
}

function Node({
  name,
  sub,
  state,
  group,
  dragging,
}: {
  name: string;
  sub: string;
  state?: 'focus' | 'dim';
  group?: boolean;
  dragging?: boolean;
}) {
  return (
    <div
      className="node"
      data-state={state}
      data-group={group || undefined}
      data-dragging={dragging || undefined}
    >
      <div className="node__name">{name}</div>
      <div className="node__sub">{sub}</div>
    </div>
  );
}

function Card({
  name,
  role,
  intro,
  on,
  selected,
  center,
  compact,
  tracked,
}: {
  name: string;
  role: string;
  intro: string;
  on?: boolean;
  selected?: boolean;
  center?: boolean;
  compact?: boolean;
  tracked?: boolean;
}) {
  return (
    <div
      className="person-card"
      data-on={on || undefined}
      data-selected={selected || undefined}
      data-center={center || undefined}
      data-compact={compact || undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="person-card__name">{name}</span>
        {!compact && (
          <span className="track-btn" role="button" aria-pressed={tracked}>
            {tracked ? <span className="bookmark" style={{ width: 8, height: 12 }} /> : null}
            {tracked ? '追蹤中' : '追蹤'}
          </span>
        )}
      </div>
      <div className="person-card__role">{role}</div>
      <div className="person-card__intro">{intro}</div>
    </div>
  );
}

export default function Kit() {
  const [mode, setMode] = useState<Mode>('stage');
  const [legend, setLegend] = useState({ key: true, conflict: false });
  const [filter, setFilter] = useState('朝堂');
  const [seg, setSeg] = useState('group');
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.layout = mode === 'flow' ? 'flow' : 'stage';
    if (mode === 'compact') root.setAttribute('data-compact', '');
    else root.removeAttribute('data-compact');
    return () => {
      delete root.dataset.layout;
      root.removeAttribute('data-compact');
    };
  }, [mode]);

  return (
    <div className="mx-auto max-w-[1100px] bg-bg px-8 py-10">
      <header className="mb-10 flex flex-wrap items-end gap-6">
        <div>
          <div className="eyebrow-accent">開發專用 · 元件圖鑑</div>
          <h1 className="font-heading text-[40px]">共用樣式與狀態</h1>
        </div>
        <div className="segmented" role="radiogroup" aria-label="版型">
          {(['stage', 'compact', 'flow'] as Mode[]).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
              {m === 'stage' ? '舞台' : m === 'compact' ? '舞台 compact' : '流式'}
            </button>
          ))}
        </div>
        <span className="text-aux text-neutral-600">
          目前字級：輔助 var(--fs-aux)、內文 var(--fs-body)
        </span>
      </header>

      <Section id="A" title="強調效果（每種各佔一個視覺通道）" note="可同時出現">
        <div className="flex flex-wrap gap-x-10 gap-y-6">
          <Cell label="焦點：亮暗（金框 vs 0.3）">
            <div className="flex gap-3">
              <Node name="德雷文" sub="國王" state="focus" />
              <Node name="艾莉絲" sub="長生魔女" state="dim" />
            </div>
          </Cell>
          <Cell label="追蹤：書籤（事件格右上）">
            <EventCell n="02" title="異族入朝" state="past" tracked />
          </Cell>
          <Cell label="登場：彩色／灰階">
            <div className="flex gap-3">
              <div className="person-card" data-compact data-on>
                <span className="person-card__name">德雷文</span>
                <span className="person-card__role">國王</span>
              </div>
              <div className="person-card" data-compact>
                <span className="person-card__name">地龍</span>
                <span className="person-card__role">上古地龍</span>
              </div>
            </div>
          </Cell>
          <Cell label="標籤選中：浮起（可與登場疊加）">
            <div className="flex gap-3">
              <div className="person-card" data-compact data-on data-selected>
                <span className="person-card__name">艾莉絲</span>
                <span className="person-card__role">長生魔女</span>
              </div>
              <div className="person-card" data-compact data-selected>
                <span className="person-card__name">利歐蘭</span>
                <span className="person-card__role">精靈</span>
              </div>
            </div>
          </Cell>
          <Cell label="伏筆：雙線框（全站唯一）">
            <span className="hint-slot">伏筆</span>
          </Cell>
        </div>
      </Section>

      <Section
        id="B"
        title="可點擊文字"
        note="人名＝灰點線；名詞＝金字金點線；hover／開啟中＝accent-100"
      >
        <p className="max-w-[560px] text-body leading-[1.85]">
          國王<button className="link-name">德雷文</button>以
          <button className="link-term">東方晨星</button>之名分化小貴族（
          <button className="link-cross">見下方 ↓</button>）。開啟中：
          <button className="link-name" data-open>
            德雷文
          </button>
          、
          <button className="link-term" data-open>
            東方晨星
          </button>
          。群體「守舊貴族」不可點，無樣式。
        </p>
      </Section>

      <Section id="C" title="按鈕、標籤、圖例開關、分段控制">
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn btn-primary">主要（金框）</button>
          <button className="btn btn-secondary">次要</button>
          <button className="btn btn-ghost">幽靈</button>
          <button className="btn btn-primary" disabled>
            停用
          </button>
          <button className="btn btn-icon" aria-label="關閉">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {['朝堂', '教會', '臣子', '家人'].map((t) => (
            <button
              key={t}
              className="chip"
              data-variant="filter"
              aria-pressed={filter === t}
              onClick={() => setFilter(filter === t ? '' : t)}
            >
              {t}
            </button>
          ))}
          <span className="text-aux text-neutral-600">（篩選：單選、再點取消）</span>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className="chip"
            data-variant="legend"
            aria-pressed={legend.key}
            onClick={() => setLegend({ ...legend, key: !legend.key })}
          >
            <span className="chip-line" data-kind="key" />
            本篇關鍵
          </button>
          <button className="chip" data-variant="legend" aria-pressed>
            <span className="chip-line" />
            關係
          </button>
          <button
            className="chip"
            data-variant="legend"
            aria-pressed={legend.conflict}
            onClick={() => setLegend({ ...legend, conflict: !legend.conflict })}
          >
            <span className="chip-line" data-kind="conflict" />
            衝突
          </button>
          <button className="chip" data-variant="legend" aria-pressed>
            <span className="chip-line" data-kind="group" />
            群體
          </button>
          <button className="chip" data-variant="toggle" aria-pressed>
            線段標籤
          </button>
          <button className="chip" data-variant="toggle" aria-pressed={false}>
            圖例
          </button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="segmented" role="radiogroup" aria-label="排列">
            {[
              ['group', '依群體'],
              ['order', '依出場順序'],
              ['world', '依所在世界'],
            ].map(([k, label]) => (
              <button key={k} role="radio" aria-checked={seg === k} onClick={() => setSeg(k!)}>
                {label}
              </button>
            ))}
          </div>
          <div className="segmented" aria-disabled="true">
            <button aria-checked="false">停用（人物中心視角）</button>
          </div>
          <span className="flex items-center gap-1">
            <span className="kbd">←</span>
            <span className="kbd">→</span>
            <span className="text-aux text-neutral-600">切換事件</span>
          </span>
        </div>
      </Section>

      <Section id="D" title="事件列" note="未到／目前／已過／hover／追蹤／節點焦點標記">
        <div className="flex flex-wrap gap-x-6 gap-y-5">
          <Cell label="未到">
            <EventCell n="06" title="地底迴響" state="upcoming" />
          </Cell>
          <Cell label="目前（金線＋粗體＋箭頭朝上）">
            <EventCell n="05" title="邊界之辯" state="current" />
          </Cell>
          <Cell label="已過">
            <EventCell n="04" title="酒吧衝突" state="past" />
          </Cell>
          <Cell label="已過＋追蹤">
            <EventCell n="03" title="朝堂博弈" state="past" tracked />
          </Cell>
          <Cell label="目前＋追蹤">
            <EventCell n="05" title="邊界之辯" state="current" tracked />
          </Cell>
          <Cell label="未到＋追蹤">
            <EventCell n="06" title="地底迴響" state="upcoming" tracked />
          </Cell>
          <Cell label="節點焦點：該節點出場的事件（金色編號＋底線）">
            <EventCell n="02" title="異族入朝" state="past" marked />
          </Cell>
          <Cell label="標題過長會截斷">
            <EventCell n="07" title="很長很長很長的事件標題" state="past" />
          </Cell>
        </div>
      </Section>

      <Section id="E" title="關係圖節點與連線">
        <div className="flex flex-wrap items-end gap-6">
          <Cell label="一般">
            <Node name="艾莉絲" sub="長生魔女" />
          </Cell>
          <Cell label="焦點">
            <Node name="艾莉絲" sub="長生魔女" state="focus" />
          </Cell>
          <Cell label="變暗 0.3">
            <Node name="艾莉絲" sub="長生魔女" state="dim" />
          </Cell>
          <Cell label="群體（虛框，不可追蹤）">
            <Node name="守舊貴族" sub="反對外派子弟" group />
          </Cell>
          <Cell label="拖曳中">
            <Node name="艾莉絲" sub="長生魔女" dragging />
          </Cell>
        </div>
        <svg viewBox="0 0 760 190" width="760" height="190" className="mt-6">
          {(
            [
              { kind: 'key', state: 'dim', x1: 360, x2: 480, y: 36, label: true },
              { kind: 'key', state: undefined, x1: 510, x2: 630, y: 36, label: true },
              { kind: 'key', state: 'lit', x1: 650, x2: 750, y: 36, label: true },
              { kind: 'relation', state: undefined, x1: 510, x2: 630, y: 96, label: false },
              { kind: 'relation', state: 'lit', x1: 650, x2: 750, y: 96, label: false },
              { kind: 'conflict', state: undefined, x1: 510, x2: 630, y: 156, label: false },
              { kind: 'conflict', state: 'lit', x1: 650, x2: 750, y: 156, label: false },
            ] as const
          ).map((e, i) => (
            <g key={i} className="edge" data-kind={e.kind} data-state={e.state}>
              <path className="edge__line" d={`M${e.x1} ${e.y} H${e.x2}`} />
              <path className="edge__arrow" d={`M${e.x2} ${e.y} l-9 -4 v8 z`} />
              {e.label && (
                <text className="edge__label" x={(e.x1 + e.x2) / 2} y={e.y - 6}>
                  借出時間
                </text>
              )}
            </g>
          ))}
          <text x="0" y="40" className="text-aux" fill="currentColor">
            本篇關鍵（變暗／一般／亮起）
          </text>
          <text x="0" y="100" className="text-aux" fill="currentColor">
            關係
          </text>
          <text x="0" y="160" className="text-aux" fill="currentColor">
            衝突（虛線）
          </text>
        </svg>
      </Section>

      <Section id="F" title="Popover／提示／手機底部面板" note="callout 寬 300，箭頭指向錨點">
        <div className="flex flex-wrap items-start gap-8">
          <div className="callout" data-placement="below">
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold">德雷文</span>
              <span className="text-aux text-accent-700">國王 · 艾莉絲的養子</span>
            </div>
            <div className="mt-1.5 text-[15px] leading-[1.7]">人類王國的國王，推動多族共榮。</div>
            <div className="mt-2 flex justify-between border-t border-divider pt-2 text-aux">
              <span className="text-neutral-600">依目前進度 01</span>
              <span className="text-accent-800">在人物誌查看 →</span>
            </div>
          </div>
          <div className="callout" data-placement="right" data-tone="accent">
            <div className="text-[17px] font-semibold">正在追蹤：艾利安</div>
            <div className="text-[14px] leading-[1.7] text-neutral-700">
              01–04 中他出場的事件與引言會掛上書籤標記。
            </div>
          </div>
          <div className="sheet w-[360px]">
            <div className="text-[18px] font-semibold">手機底部面板</div>
            <div className="text-[15px]">Popover 在流式版改為底部小卡。</div>
          </div>
        </div>
      </Section>

      <Section id="G" title="伏筆：關鍵字與回收框格">
        <div className="flex flex-wrap items-end gap-8">
          <Cell label="關鍵字：未使用">
            <span className="hint-keyword">冰涼的手</span>
          </Cell>
          <Cell label="選中／拖曳中">
            <span className="hint-keyword" data-state="selected">
              冰涼的手
            </span>
          </Cell>
          <Cell label="已解開（不可拖）">
            <span className="hint-keyword" data-state="solved">
              ✓ 第一次感冒
            </span>
          </Cell>
          <Cell label="拖曳原位空位">
            <span className="hint-keyword-hole w-[122px]" />
          </Cell>
          <Cell label="框格：空">
            <span className="hint-slot">伏筆</span>
          </Cell>
          <Cell label="可以放置">
            <span className="hint-slot w-[148px]" data-state="ready">
              放開以放入
            </span>
          </Cell>
          <Cell label="答對鎖定（點按鈕重播閃動）">
            <span
              className="hint-slot"
              data-state="solved"
              data-flash={flash || undefined}
              key={flash}
            >
              ✓ 第一次感冒
            </span>
          </Cell>
          <Cell label="答錯（震動）">
            <span className="hint-slot" data-state="wrong" data-shake key={`s${flash}`}>
              不是這個
            </span>
          </Cell>
          <button className="btn btn-secondary" onClick={() => setFlash((n) => n + 1)}>
            重播動畫
          </button>
        </div>
        <p className="mt-6 max-w-[560px] text-body leading-9">
          回收處文字：<span className="hint-anchor">法恩用馬蹄鐵敲出火</span>、燒鬃毛蓋過
          <span className="hint-anchor" data-solved>
            盤蛇的氣味
          </span>
          。
        </p>
      </Section>

      <Section id="H" title="人物誌：人物卡（標準 248×116、精簡 168×60）與劇透區塊">
        <div className="flex flex-wrap items-start gap-6">
          <Card
            name="艾莉絲"
            role="長生魔女 · 德雷文的養母"
            intro="借時間給艾利安、擔保法恩入朝。"
            on
          />
          <Card
            name="艾莉絲"
            role="長生魔女 · 德雷文的養母"
            intro="借時間給艾利安、擔保法恩入朝。"
            on
            selected
            tracked
          />
          <Card
            name="利歐蘭"
            role="精靈 · 德雷文視如父親"
            intro="與艾莉絲一同趕到森林、聽見預言；德雷文畫中牽手的四人之一。"
          />
          <Card
            name="艾利安"
            role="十歲 · 德雷文的養子"
            intro="被德雷文撿回王宮的孤兒，急於長大幫上國王。"
            on
            center
          />
          <Card name="諾爾" role="集會領袖" intro="" on compact />
          <Card name="人馬預言家" role="預言家" intro="" compact />
        </div>
        <div className="mt-6 grid max-w-[760px] grid-cols-2 gap-4">
          <button className="spoiler">
            <span className="spoiler__head">🔒 劇透 · 02 讀完第 02 主軸後解鎖（點擊仍可查看）</span>
            <span className="spoiler__bar" />
            <span className="spoiler__bar w-[92%]" />
            <span className="spoiler__bar w-[64%]" />
          </button>
          <div className="spoiler" data-revealed>
            <span className="spoiler__head">
              劇透 · 03 · 已顯示<span className="ml-auto text-accent-800">隱藏</span>
            </span>
            <p className="text-body leading-[1.85]">
              他模仿德雷文的威壓話術動搖布倫、闖入教會休息室。
            </p>
          </div>
        </div>
      </Section>

      <Section id="I" title="其他" note="書籤、plate、鏡像卡（版型）、遮罩">
        <div className="flex flex-wrap items-end gap-8">
          <Cell label="書籤 10×15">
            <span className="bookmark" />
          </Cell>
          <Cell label=".plate 襯底圖">
            <div className="plate h-[100px] w-[160px] bg-neutral-300" />
          </Cell>
          <Cell label="display-num 大數字">
            <span className="display-num text-[64px]">01</span>
          </Cell>
          <Cell label="骨架（ghost）">
            <span className="display-num text-[64px]" data-tone="ghost">
              01
            </span>
          </Cell>
          <Cell label="eyebrow">
            <span className="eyebrow">事件進程</span>
          </Cell>
          <div className="mirror-stage">
            <div className="mirror-card">
              <div className="mirror-face">
                <span className="font-heading text-[26px]">艾莉絲</span>
                <span>身分背景</span>
                <span>選擇</span>
                <span>動機</span>
              </div>
            </div>
          </div>
        </div>
        <div className="relative mt-8 h-[120px] w-[420px] overflow-hidden bg-bg">
          <div className="px-3 py-2 text-aux">
            scrim：paper（人物誌展開）／ink（手機 Popover）／cover（04 遮罩）
          </div>
          <div className="scrim" data-tone="paper" style={{ top: 30, height: 30 }} />
          <div className="scrim" data-tone="ink" style={{ top: 60, height: 30 }} />
          <div className="scrim" data-tone="cover" style={{ top: 90, height: 30 }} />
        </div>
      </Section>
    </div>
  );
}
