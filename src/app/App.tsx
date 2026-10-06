import { lazy, Suspense, useEffect } from 'react';
import { Dock } from '../components/layout/Dock';
import { FlowShell } from '../components/layout/FlowShell';
import { LayoutProvider, useLayout } from '../components/layout/LayoutProvider';
import { Stage } from '../components/layout/Stage';
import { DisplayNum } from '../components/ui';
import { t } from '../content';
import { useGlobalKeys } from '../features/axis/useGlobalKeys';
import { WorldIntro } from '../features/world/WorldIntro';
import { getReturnTo, pageOfRoute, parseHash, useHash } from '../lib/hash-router';
import { useAppStore } from '../store/store';

// 開發專用元件圖鑑：只在 dev 模式載入，正式建置會把整段移除
const Kit = import.meta.env.DEV ? lazy(() => import('../dev/Kit')) : null;
const FrameDemo = import.meta.env.DEV ? lazy(() => import('../dev/FrameDemo')) : null;

/** 路由 → 底層頁碼。人物誌是疊在「開啟前的頁面」上的抽屜，所以底層頁碼取 returnTo。 */
function useRoutedPage() {
  const route = parseHash(useHash());
  const peopleOpen = route.name === 'people';
  const page = pageOfRoute(peopleOpen ? parseHash(getReturnTo()) : route) ?? 0;
  const syncNav = useAppStore((s) => s.syncNav);
  useEffect(() => syncNav(page, peopleOpen), [page, peopleOpen, syncNav]);
  return { page, peopleOpen };
}

/** 主軸頁（01–04）的暫代：Phase 4 起由 AxisPage 取代 */
function AxisPlaceholder({ page }: { page: number }) {
  return (
    <main className="absolute inset-y-0 right-0 left-[72px] p-8 flow:static flow:p-0 flow:pt-9">
      <DisplayNum className="text-[64px]">{String(page).padStart(2, '0')}</DisplayNum>
      <h1 className="font-heading text-[34px]">{t('site.title')}</h1>
      <p>{t('site.subtitle')}</p>
    </main>
  );
}

function PageView({ page }: { page: number }) {
  return page === 0 ? <WorldIntro /> : <AxisPlaceholder page={page} />;
}

function Shell() {
  const { mode } = useLayout();
  const { page } = useRoutedPage();
  useGlobalKeys();

  if (mode === 'flow') {
    return (
      <FlowShell>
        <PageView page={page} />
        <Dock />
      </FlowShell>
    );
  }
  return (
    <Stage>
      <PageView page={page} />
      <Dock />
    </Stage>
  );
}

export function App() {
  const hash = useHash();
  if (Kit && FrameDemo && parseHash(hash).name === 'kit') {
    const Page = hash.includes('/frame') ? FrameDemo : Kit;
    return (
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    );
  }
  return (
    <LayoutProvider>
      <Shell />
    </LayoutProvider>
  );
}
