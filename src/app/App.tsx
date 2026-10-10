import { lazy, Suspense, useEffect } from 'react';
import { Dock } from '../components/layout/Dock';
import { FlowShell } from '../components/layout/FlowShell';
import { LayoutProvider, useLayout } from '../components/layout/LayoutProvider';
import { Stage } from '../components/layout/Stage';
import { TrackToast } from '../components/layout/TrackToast';
import { PopoverLayer } from '../components/text/PopoverLayer';
import { DisplayNum } from '../components/ui';
import { getAxisPage, t } from '../content';
import { AxisPage } from '../features/axis/AxisPage';
import { HintToast } from '../features/hints/HintToast';
import { HintTray } from '../features/hints/HintTray';
import { LiveRegion } from '../features/hints/LiveRegion';
import { PeopleDrawer } from '../features/people/PeopleDrawer';
import { useGlobalKeys } from '../features/axis/useGlobalKeys';
import { WorldIntro } from '../features/world/WorldIntro';
import { getReturnTo, pageOfRoute, parseHash, useHash } from '../lib/hash-router';
import { MOTION } from '../lib/stage-metrics';
import { usePresence } from '../lib/usePresence';
import { useAppStore, type AxisKey } from '../store/store';

// 開發專用元件圖鑑：只在 dev 模式載入，正式建置會把整段移除
const Kit = import.meta.env.DEV ? lazy(() => import('../dev/Kit')) : null;
// 好讀版：獨立全頁，另外切成一個 chunk（第一次打開才下載）
const ReaderPage = lazy(() => import('../features/reader/ReaderPage'));
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
  if (page === 0) return <WorldIntro />;
  // 內容檔已建立的主軸用正式頁面；其餘暫用占位（Phase 5 起陸續補上 02–04）
  return getAxisPage(page) ? <AxisPage axis={page as AxisKey} /> : <AxisPlaceholder page={page} />;
}

function Shell() {
  const { mode } = useLayout();
  const { page } = useRoutedPage();
  useGlobalKeys();
  const peopleOpen = useAppStore((s) => s.peopleOpen);
  const drawer = usePresence(peopleOpen, MOTION.drawerPeople);

  // 人物誌開啟時，底下的頁面與側欄一律 inert：不可點、不可聚焦、不被螢幕閱讀器讀到
  const base = (
    <div className="contents" inert={peopleOpen}>
      <PageView page={page} />
      <Dock />
    </div>
  );
  const overlays = (
    <>
      <TrackToast />
      <HintToast />
      <HintTray />
      <PopoverLayer />
      <LiveRegion />
      {drawer.present && <PeopleDrawer closing={drawer.closing} />}
    </>
  );

  if (mode === 'flow') {
    return (
      <FlowShell>
        {base}
        {overlays}
      </FlowShell>
    );
  }
  return (
    <Stage>
      {base}
      {overlays}
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
  if (parseHash(hash).name === 'read') {
    return (
      <Suspense fallback={null}>
        <ReaderPage />
      </Suspense>
    );
  }
  return (
    <LayoutProvider>
      <Shell />
    </LayoutProvider>
  );
}
