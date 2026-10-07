import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { NameLink, RichText } from '../../components/text/RichText';
import { Eyebrow, Kbd } from '../../components/ui';
import { getPerson, t, worldIntro } from '../../content';
import { navigate, routeForPage } from '../../lib/hash-router';
import { ResetProgress } from './ResetProgress';
import { CONTENT, STAGE } from '../../lib/stage-metrics';

/**
 * 00 世界觀導讀（設計稿 §2、§7）：導言、核心關係條、三個世界、四條主軸清單。
 * 舞台版為三欄（440／1fr／1fr、欄距 56）；流式版為單欄。所有文字來自 pages/00.yaml。
 */
const pad = (n: number) => String(n).padStart(2, '0');

function SectionLabel({ children }: { children: ReactNode }) {
  return <Eyebrow className="border-b border-divider pb-2.5">{children}</Eyebrow>;
}

function CoreRelation() {
  const { heading, chain, links, caption } = worldIntro.coreRelation;
  return (
    <section className="flex flex-col gap-3 flow:gap-2.5">
      <SectionLabel>{heading}</SectionLabel>
      <div className="flex items-center gap-2 pt-1 flow:gap-1">
        {chain.map((node, i) => (
          <div key={node.personId} className="contents">
            <div className="rounded-md border border-accent px-3 py-2 text-center flow:px-2 flow:py-1.5">
              <div className="text-[17px] font-semibold flow:text-[15px]">
                <NameLink personId={node.personId}>{getPerson(node.personId)?.name}</NameLink>
              </div>
              <div className="text-aux text-accent-700">{node.role}</div>
            </div>
            {links[i] !== undefined && (
              <div className="flex flex-1 flex-col items-center text-aux text-neutral-700">
                <span>{links[i]}</span>
                <span className="w-full border-t border-accent" />
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="m-0 text-[15px] leading-[1.8] text-neutral-700 flow:text-[14px] flow:leading-[1.75]">
        <RichText text={caption} />
      </p>
    </section>
  );
}

function Worlds() {
  const { heading, items } = worldIntro.worlds;
  return (
    <section className="flex min-w-0 flex-col pt-[30px] flow:gap-2.5 flow:pt-0">
      <SectionLabel>{heading}</SectionLabel>
      <div className="flow:grid flow:grid-cols-[72px_1fr] flow:gap-x-3 flow:gap-y-2.5 flow:text-[14px] flow:leading-[1.75]">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 border-b border-divider py-[18px] last:border-b-0 flow:contents"
          >
            <div className="font-heading text-[26px] font-medium text-accent-800 flow:text-[18px]">
              <RichText text={item.name} />
            </div>
            <div className="text-justify text-[16px] leading-[1.85] flow:text-[14px] flow:leading-[1.75]">
              <RichText text={item.text} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AxisList() {
  const { heading, items } = worldIntro.axes;
  return (
    <section className="flex min-w-0 flex-col pt-[30px] flow:pt-0">
      <SectionLabel>{heading}</SectionLabel>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.axis}>
            <button
              type="button"
              onClick={() => navigate(routeForPage(item.axis))}
              className="grid w-full grid-cols-[44px_minmax(0,1fr)_20px] items-start gap-3 border-b border-divider py-[18px] pr-2 text-left hover:bg-accent-100 active:bg-accent-200 flow:min-h-16 flow:grid-cols-[34px_minmax(0,1fr)_16px] flow:items-center flow:gap-2.5 flow:py-2.5 flow:pr-0"
            >
              <span className="display-num text-[30px] text-accent-700 flow:text-[24px]">
                {pad(item.axis)}
              </span>
              <span>
                <span className="block text-[17px] leading-[1.5] font-medium flow:text-[15px]">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[14px] text-neutral-600 flow:text-[12.5px]">
                  {item.subtitle}
                </span>
              </span>
              <ArrowRight
                size={16}
                strokeWidth={1.5}
                className="mt-1 text-neutral-500 flow:mt-0"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Heading() {
  return (
    <header>
      <Eyebrow accent>{worldIntro.eyebrow}</Eyebrow>
      <h1 className="mt-2.5 text-[44px] leading-[1.2] flow:text-[34px] flow:leading-[1.25]">
        {worldIntro.title}
      </h1>
    </header>
  );
}

export function WorldIntro() {
  const { mode } = useLayout();

  if (mode === 'flow') {
    return (
      <main className="flex flex-col gap-[30px] pt-9">
        <Heading />
        <p className="m-0 text-justify text-[15px] leading-[1.9]">
          <RichText text={worldIntro.intro} />
        </p>
        <CoreRelation />
        <Worlds />
        <AxisList />
        <div className="border-t border-divider pt-2">
          <ResetProgress />
        </div>
      </main>
    );
  }

  return (
    <main
      className="absolute grid"
      style={{
        left: CONTENT.x,
        top: 56,
        width: CONTENT.width,
        height: STAGE.height - 56 - 56,
        gridTemplateColumns: '440px minmax(0, 1fr) minmax(0, 1fr)',
        columnGap: 56,
      }}
    >
      <div className="flex min-w-0 flex-col gap-7">
        <Heading />
        <p className="m-0 text-justify text-[17px] leading-[1.9]">
          <RichText text={worldIntro.intro} />
        </p>
        <CoreRelation />
      </div>
      <Worlds />
      <div className="flex min-w-0 flex-col">
        <AxisList />
        {/* pb-1：鍵帽往下按 2px、箭頭浮動 3px 時，不要超出欄底 */}
        <div className="mt-auto flex flex-col gap-2.5 pb-1">
          <ResetProgress />
          <div className="key-hint-text flex items-center gap-3">
            <Kbd size="lg" nudge="first">
              ↓
            </Kbd>
            {t('keys.enterFirst')}
            <span className="arrow-hint" aria-hidden="true">
              ⌄
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
