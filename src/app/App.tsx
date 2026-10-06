import ui from '../content/ui.yaml';

// 空殼首頁（Phase 1 的部署驗證用）。內容載入與 t() 會在任務 T028 正式建立，屆時取代這裡的暫時型別。
const { site } = ui as { site: { title: string; subtitle: string } };

export function App() {
  return (
    <main>
      <h1>{site.title}</h1>
      <p>{site.subtitle}</p>
    </main>
  );
}
