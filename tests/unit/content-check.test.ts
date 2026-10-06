import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { validateContent, type ContentBundle, type Issue } from '../../src/content/validate.ts';

// ── 測試用的最小合法資料 ───────────────────────────────────────────
const person = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  group: 'royal',
  role: '身分',
  intro: '簡介。',
  firstAppearance: { axis: 1, event: 1 },
  order: 1,
  world: 'human',
  tags: [],
  aliases: [],
  popover: ['基本身分。', '', '', ''],
  bio: [{ type: 'text', text: '介紹。' }],
  ...extra,
});

const hint = (id: string, n: number, extra: Record<string, unknown> = {}) => ({
  id,
  n,
  keyword: `關鍵字${n}`,
  acquire: 1,
  recycle: { axis: 1, event: 2 },
  explain: '說明。',
  ...extra,
});

const layout = (ids: string[]) => ({
  size: [100, 100],
  nodes: Object.fromEntries(ids.map((id, i) => [id, [10 + i * 20, 50]])),
});

function page(overrides: Record<string, unknown> = {}) {
  const ids = ['dravin', 'fane'];
  return {
    axis: 1,
    number: '01',
    category: '分類',
    title: '標題',
    oneLiner: '一句話',
    coreTheme: '核心主題',
    eventsHeading: '事件進程',
    events: [1, 2, 3, 4, 5].map((n) => ({
      n,
      title: `事件${n}`,
      tag: '標籤',
      text: n === 2 ? '{p:dravin}請{p:fane}{h:gift|帶來禮物}。' : `第${n}個事件。`,
      participants: ['dravin'],
    })),
    graph: {
      nodes: [
        { id: 'dravin', kind: 'person', sub: '國王' },
        { id: 'fane', kind: 'person', sub: '特使' },
      ],
      edges: [
        {
          id: 'e1',
          from: 'dravin',
          to: 'fane',
          label: '任命',
          kind: 'key',
          event: 2 as number | 'bg',
        },
      ],
      legend: [{ kind: 'key', label: '本篇關鍵' }],
      layout: { desktop: layout(ids), flow: layout(ids) },
    },
    ...overrides,
  };
}

function bundle(overrides: Partial<ContentBundle> = {}): ContentBundle {
  return {
    people: {
      people: [person('dravin', '德雷文'), person('fane', '法恩', { order: 2 })],
      relations: [],
    },
    glossary: { terms: [{ id: 'morning-star', term: '東方晨星', firstPage: 1, text: '稱號。' }] },
    hints: { hints: [hint('gift', 1)] },
    ui: { site: { title: 'x' } },
    pages: { '01': page() },
    ...overrides,
  };
}

const errors = (issues: Issue[]) => issues.filter((i) => i.severity === 'error');
const messages = (issues: Issue[]) =>
  errors(issues).map((i) => `${i.file} ${i.path}: ${i.message}`);

describe('validateContent：合法資料', () => {
  it('最小合法資料沒有任何錯誤', () => {
    expect(messages(validateContent(bundle()))).toEqual([]);
  });

  it('真實內容（目前已建立的 YAML）沒有錯誤', () => {
    const read = (f: string) => YAML.parse(readFileSync(`src/content/${f}`, 'utf8'));
    const issues = validateContent({
      people: read('people.yaml'),
      glossary: read('glossary.yaml'),
      hints: read('hints.yaml'),
      ui: read('ui.yaml'),
    });
    expect(messages(issues)).toEqual([]);
  });
});

describe('validateContent：結構（zod）', () => {
  it('欄位名稱寫錯（strictObject）會指出路徑', () => {
    const b = bundle();
    (b.hints as { hints: Record<string, unknown>[] }).hints[0]!['keywrod'] = '拼錯';
    expect(messages(validateContent(b)).join('\n')).toContain('hints.yaml hints[0]');
  });

  it('person id 不是小寫英文', () => {
    const b = bundle({ people: { people: [person('德雷文', '德雷文')], relations: [] } });
    expect(messages(validateContent(b)).join('\n')).toContain('people[0].id');
  });
});

describe('validateContent：行內標記', () => {
  it('未知人物 id：指出檔案、欄位，並建議最接近的 id', () => {
    const p = page();
    p.events[0]!.text = '由{p:fan}擔保';
    const out = messages(validateContent(bundle({ pages: { '01': p } })));
    expect(out.join('\n')).toContain('pages/01.yaml events[0].text');
    expect(out.join('\n')).toContain('你是不是要 "fane"');
  });

  it('未閉合的 {h:…}：回報位置', () => {
    const p = page();
    p.events[0]!.text = '前面{h:gift|沒有結尾';
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toMatch(
      /未閉合.*第 3 字/,
    );
  });

  it('未知名詞與未知交叉連結目標', () => {
    const p = page();
    p.events[0]!.text = '{t:nope}與{x:somewhere|到這裡}';
    const out = messages(validateContent(bundle({ pages: { '01': p } }))).join('\n');
    expect(out).toContain('未知名詞 id "nope"');
    expect(out).toContain('未知的交叉連結目標 "somewhere"');
  });
});

describe('validateContent：伏筆回收處', () => {
  it('回收頁存在但找不到 {h:} → 錯誤，指出該出現在哪', () => {
    const p = page();
    p.events[1]!.text = '沒有標記。';
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '應出現在 01 事件 2，但找不到 {h:gift|…}',
    );
  });

  it('標在錯的事件', () => {
    const p = page();
    p.events[2]!.text = '{h:gift|禮物}';
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '應出現在 01 事件 2，但標在 01 事件 3',
    );
  });

  it('同一伏筆出現兩次', () => {
    const p = page();
    p.events[1]!.text = '{h:gift|甲}和{h:gift|乙}';
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '出現了 2 次',
    );
  });

  it('同一事件的伏筆片語重疊（巢狀）', () => {
    const b = bundle({ hints: { hints: [hint('gift', 1), hint('other', 2)] } });
    const p = page();
    p.events[1]!.text = '{h:gift|外層{h:other|內層}文字}';
    const out = messages(validateContent({ ...b, pages: { '01': p } })).join('\n');
    expect(out).toContain('伏筆片語重疊');
  });

  it('獲得主軸不可晚於回收主軸', () => {
    const b = bundle({ hints: { hints: [hint('gift', 1, { acquire: 3 })] } });
    expect(messages(validateContent(b)).join('\n')).toContain('不可晚於回收主軸');
  });

  it('回收頁還沒建立時不報錯（Phase 逐步補內容）', () => {
    expect(messages(validateContent(bundle({ pages: {} })))).toEqual([]);
  });
});

describe('validateContent：關係圖', () => {
  it('連線端點不是本頁節點', () => {
    const p = page();
    p.graph.edges[0]!.to = 'ghost';
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '連線端點 "ghost"',
    );
  });

  it('連線事件序超過本頁事件數', () => {
    const p = page();
    p.graph.edges[0]!.event = 9;
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '超過本頁事件數 5',
    );
  });

  it('背景關係 event: bg 合法', () => {
    const p = page();
    p.graph.edges[0]!.event = 'bg';
    expect(messages(validateContent(bundle({ pages: { '01': p } })))).toEqual([]);
  });

  it('座標缺少某個節點', () => {
    const p = page();
    delete (p.graph.layout.flow.nodes as Record<string, unknown>)['fane'];
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      'graph.layout.flow.nodes: 缺少節點 "fane" 的座標',
    );
  });

  it('參與者既不是人物也不是節點', () => {
    const p = page();
    p.events[0]!.participants = ['nobody'];
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '參與者 "nobody"',
    );
  });

  it('事件編號必須連續', () => {
    const p = page();
    p.events[2]!.n = 7;
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '必須從 1 連續遞增',
    );
  });

  it('圖例缺少線種', () => {
    const p = page();
    p.graph.edges[0]!.kind = 'conflict';
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '沒有對應的圖例',
    );
  });

  it('分層：每個節點必須恰好屬於一層', () => {
    const p = page();
    (p.graph as Record<string, unknown>)['layers'] = [{ id: 'a', label: 'A', nodes: ['dravin'] }];
    expect(messages(validateContent(bundle({ pages: { '01': p } }))).join('\n')).toContain(
      '節點 "fane" 必須恰好屬於一個分層',
    );
  });
});

describe('validateContent：人物與名詞', () => {
  it('別名同時屬於兩位人物 → 錯誤', () => {
    const b = bundle({
      people: {
        people: [
          person('dravin', '德雷文', { aliases: [{ text: '陛下' }] }),
          person('fane', '法恩', { order: 2, aliases: [{ text: '陛下' }] }),
        ],
        relations: [],
      },
    });
    expect(messages(validateContent(b)).join('\n')).toContain('別名「陛下」同時屬於');
  });

  it('別名與名詞相同 → 警告（名詞優先）', () => {
    const b = bundle({
      people: {
        people: [person('dravin', '德雷文', { aliases: [{ text: '東方晨星' }] })],
        relations: [],
      },
    });
    const w = validateContent(b).filter((i) => i.severity === 'warning');
    expect(w.map((i) => i.message).join('\n')).toContain('名詞優先');
  });

  it('Popover 超過 30 字 → 警告', () => {
    const b = bundle({
      people: {
        people: [person('dravin', '德雷文', { popover: ['很'.repeat(31), '', '', ''] })],
        relations: [],
      },
    });
    expect(
      validateContent(b).some((i) => i.severity === 'warning' && i.message.includes('30 字')),
    ).toBe(true);
  });

  it('跨主軸關係指向不存在的人物', () => {
    const b = bundle({
      people: {
        people: [person('dravin', '德雷文')],
        relations: [{ from: 'dravin', to: 'ghost', label: '關係' }],
      },
    });
    expect(messages(validateContent(b)).join('\n')).toContain('relations[0].to');
  });

  it('文字含錯別字別名 → 警告', () => {
    const b = bundle({
      people: {
        people: [
          person('dravin', '德雷文', { aliases: [{ text: '德雷紋', typo: true }] }),
          person('fane', '法恩', { order: 2 }),
        ],
        relations: [],
      },
    });
    const p = page();
    p.events[0]!.text = '德雷紋來了';
    const w = validateContent({ ...b, pages: { '01': p } }).filter((i) => i.severity === 'warning');
    expect(w.map((i) => i.message).join('\n')).toContain('錯別字「德雷紋」');
  });
});

describe('validateContent：00 世界觀導讀', () => {
  const world = () => ({
    eyebrow: '導讀',
    title: '標題',
    intro: '國王{p:dravin}推動共榮。',
    coreRelation: {
      heading: '核心關係',
      chain: [
        { personId: 'dravin', role: '國王' },
        { personId: 'fane', role: '特使' },
      ],
      links: ['任命'],
      caption: '說明。',
    },
    worlds: { heading: '三個世界', items: [{ name: '{t:morning-star|人間}', text: '王國。' }] },
    axes: {
      heading: '四條主軸',
      items: [1, 2, 3, 4].map((axis) => ({ axis, title: `主軸${axis}`, subtitle: '副標' })),
    },
  });

  it('合法的 00 沒有錯誤', () => {
    expect(messages(validateContent(bundle({ world: world() })))).toEqual([]);
  });

  it('核心關係的人物不存在', () => {
    const w = world();
    w.coreRelation.chain[1]!.personId = 'ghost';
    expect(messages(validateContent(bundle({ world: w }))).join('\n')).toContain(
      'coreRelation.chain[1].personId',
    );
  });

  it('連線文字數量必須是人物數量減 1', () => {
    const w = world();
    w.coreRelation.links = ['一', '二'];
    expect(messages(validateContent(bundle({ world: w }))).join('\n')).toContain(
      '必須是人物數量減 1',
    );
  });

  it('標記錯誤會指出 pages/00.yaml 與欄位', () => {
    const w = world();
    w.worlds.items[0]!.text = '{t:nope|名詞}';
    const out = messages(validateContent(bundle({ world: w }))).join('\n');
    expect(out).toContain('pages/00.yaml worlds.items[0].text');
    expect(out).toContain('未知名詞 id "nope"');
  });

  it('主軸清單的標題和該頁標題不一致 → 警告', () => {
    const w = world();
    w.axes.items[0]!.title = '舊標題';
    const issues = validateContent(bundle({ world: w }));
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('標題不一致'))).toBe(
      true,
    );
  });

  it('真實的 00.yaml 通過驗證', () => {
    const read = (f: string) => YAML.parse(readFileSync(`src/content/${f}`, 'utf8'));
    const issues = validateContent({
      people: read('people.yaml'),
      glossary: read('glossary.yaml'),
      hints: read('hints.yaml'),
      world: read('pages/00.yaml'),
    });
    expect(messages(issues)).toEqual([]);
  });
});
