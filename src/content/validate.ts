/**
 * 內容驗證（任務 T029；規則見 contracts/content-markup.md §4）。純函式：輸入「已解析的 YAML 物件」，
 * 輸出問題清單。scripts/content-check.ts 負責讀檔與列印；單元測試用壞資料驗證各規則。
 * 本檔會被 Node 直接執行，import 一律寫副檔名。
 */
import {
  AxisPageSchema,
  GlossaryFileSchema,
  HintsFileSchema,
  PeopleFileSchema,
  UiSchema,
  WorldIntroSchema,
  type AxisPage,
} from './schema.ts';
import { MarkupError, collectRefs, parseMarkup, type MarkerRef } from './markup.ts';
import type { ZodType } from 'zod';

export type Severity = 'error' | 'warning';
export interface Issue {
  severity: Severity;
  /** 檔案，例如 pages/03.yaml */
  file: string;
  /** 欄位路徑，例如 events[5].text */
  path: string;
  message: string;
}

export interface ContentBundle {
  people?: unknown;
  glossary?: unknown;
  hints?: unknown;
  ui?: unknown;
  /** pages/00.yaml */
  world?: unknown;
  /** key 為 '01'…'04' */
  pages?: Record<string, unknown>;
}

const formatPath = (path: PropertyKey[]) =>
  path.reduce<string>(
    (acc, p) => (typeof p === 'number' ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)),
    '',
  );

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length]![b.length]!;
}

function suggest(id: string, known: Iterable<string>): string {
  let best: string | undefined;
  let bestDistance = 3;
  for (const k of known) {
    const d = levenshtein(id, k);
    if (d < bestDistance) {
      bestDistance = d;
      best = k;
    }
  }
  return best ? `；你是不是要 "${best}"？` : '';
}

export function validateContent(bundle: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Severity, file: string, path: string, message: string) =>
    issues.push({ severity, file, path, message });

  function parseWith<T>(schema: ZodType<T>, raw: unknown, file: string): T | undefined {
    const result = schema.safeParse(raw);
    if (result.success) return result.data;
    for (const issue of result.error.issues)
      add('error', file, formatPath(issue.path), issue.message);
    return undefined;
  }

  const peopleFile =
    bundle.people === undefined
      ? undefined
      : parseWith(PeopleFileSchema, bundle.people, 'people.yaml');
  const glossary =
    bundle.glossary === undefined
      ? undefined
      : parseWith(GlossaryFileSchema, bundle.glossary, 'glossary.yaml');
  const hintsFile =
    bundle.hints === undefined ? undefined : parseWith(HintsFileSchema, bundle.hints, 'hints.yaml');
  if (bundle.ui !== undefined) parseWith(UiSchema, bundle.ui, 'ui.yaml');
  const world =
    bundle.world === undefined
      ? undefined
      : parseWith(WorldIntroSchema, bundle.world, 'pages/00.yaml');

  const pages = new Map<string, AxisPage>();
  for (const [key, raw] of Object.entries(bundle.pages ?? {})) {
    const page = parseWith(AxisPageSchema, raw, `pages/${key}.yaml`);
    if (page) pages.set(key, page);
  }

  const people = peopleFile?.people ?? [];
  const terms = glossary?.terms ?? [];
  const hints = hintsFile?.hints ?? [];
  const personIds = new Set(people.map((p) => p.id));
  const termIds = new Set(terms.map((t) => t.id));
  const hintIds = new Set(hints.map((h) => h.id));

  // ── 唯一性 ────────────────────────────────────────────────
  const unique = (values: string[], file: string, path: string, what: string) => {
    const seen = new Set<string>();
    values.forEach((v, i) => {
      if (seen.has(v)) add('error', file, `${path}[${i}]`, `${what}重複：${v}`);
      seen.add(v);
    });
  };
  unique(
    people.map((p) => p.id),
    'people.yaml',
    'people',
    '人物 id',
  );
  unique(
    people.map((p) => p.name),
    'people.yaml',
    'people',
    '人物姓名',
  );
  unique(
    terms.map((t) => t.id),
    'glossary.yaml',
    'terms',
    '名詞 id',
  );
  unique(
    hints.map((h) => h.id),
    'hints.yaml',
    'hints',
    '伏筆 id',
  );
  unique(
    hints.map((h) => String(h.n)),
    'hints.yaml',
    'hints',
    '伏筆編號 n',
  );

  // ── 人物 ──────────────────────────────────────────────────
  const aliasOwner = new Map<string, string>();
  people.forEach((p, i) => {
    for (const text of [p.name, ...p.aliases.map((a) => a.text)]) {
      const owner = aliasOwner.get(text);
      if (owner && owner !== p.id)
        add(
          'error',
          'people.yaml',
          `people[${i}].aliases`,
          `別名「${text}」同時屬於 ${owner} 與 ${p.id}`,
        );
      aliasOwner.set(text, p.id);
    }
    p.aliases.forEach((a, j) => {
      const hit = terms.find((t) => t.autoLink && [t.term, ...t.aliases].includes(a.text));
      if (hit && a.autoLink !== false)
        add(
          'warning',
          'people.yaml',
          `people[${i}].aliases[${j}]`,
          `別名「${a.text}」同時是名詞 ${hit.id}；自動辨識時名詞優先`,
        );
    });
    p.popover.forEach((text, stage) => {
      if (text.length > 30)
        add(
          'warning',
          'people.yaml',
          `people[${i}].popover[${stage}]`,
          `Popover 每段建議 30 字以內（目前 ${text.length} 字）`,
        );
    });
  });
  peopleFile?.relations.forEach((r, i) => {
    for (const end of ['from', 'to'] as const)
      if (!personIds.has(r[end]))
        add(
          'error',
          'people.yaml',
          `relations[${i}].${end}`,
          `未知人物 id "${r[end]}"${suggest(r[end], personIds)}`,
        );
  });

  // ── 伏筆（單檔部分）─────────────────────────────────────────
  hints.forEach((h, i) => {
    if (h.acquire > h.recycle.axis)
      add(
        'error',
        'hints.yaml',
        `hints[${i}]`,
        `「${h.keyword}」獲得主軸（${h.acquire}）不可晚於回收主軸（${h.recycle.axis}）`,
      );
  });

  // ── 標記驗證：回傳該文字的標記清單（有語法錯誤時回傳 undefined）──────
  function refsOf(text: string, file: string, path: string): MarkerRef[] | undefined {
    try {
      const refs = collectRefs(parseMarkup(text));
      for (const r of refs) {
        if (r.type === 'p' && peopleFile && !personIds.has(r.arg))
          add(
            'error',
            file,
            path,
            `未知人物 id "${r.arg}"（{p:${r.arg}}）${suggest(r.arg, personIds)}`,
          );
        if (r.type === 't' && glossary && !termIds.has(r.arg))
          add(
            'error',
            file,
            path,
            `未知名詞 id "${r.arg}"（{t:${r.arg}}）${suggest(r.arg, termIds)}`,
          );
        if (r.type === 'h' && hintsFile && !hintIds.has(r.arg))
          add(
            'error',
            file,
            path,
            `未知伏筆 id "${r.arg}"（{h:${r.arg}}）${suggest(r.arg, hintIds)}`,
          );
      }
      return refs;
    } catch (error) {
      if (error instanceof MarkupError) add('error', file, path, error.message);
      else throw error;
      return undefined;
    }
  }

  // 一般文字欄位：只檢查標記語法與參照
  people.forEach((p, i) => {
    refsOf(p.intro, 'people.yaml', `people[${i}].intro`);
    p.popover.forEach((t, s) => t && refsOf(t, 'people.yaml', `people[${i}].popover[${s}]`));
    p.bio.forEach((b, j) => refsOf(b.text, 'people.yaml', `people[${i}].bio[${j}].text`));
  });
  terms.forEach((t, i) => refsOf(t.text, 'glossary.yaml', `terms[${i}].text`));
  hints.forEach((h, i) => refsOf(h.explain, 'hints.yaml', `hints[${i}].explain`));

  // ── 00 世界觀導讀 ───────────────────────────────────────────
  if (world) {
    const f = 'pages/00.yaml';
    refsOf(world.intro, f, 'intro');
    refsOf(world.coreRelation.caption, f, 'coreRelation.caption');
    world.coreRelation.chain.forEach((c, i) => {
      if (peopleFile && !personIds.has(c.personId))
        add(
          'error',
          f,
          `coreRelation.chain[${i}].personId`,
          `未知人物 id "${c.personId}"${suggest(c.personId, personIds)}`,
        );
    });
    if (world.coreRelation.links.length !== world.coreRelation.chain.length - 1)
      add(
        'error',
        f,
        'coreRelation.links',
        `連線文字數量（${world.coreRelation.links.length}）必須是人物數量減 1（${world.coreRelation.chain.length - 1}）`,
      );
    world.worlds.items.forEach((w, i) => {
      refsOf(w.name, f, `worlds.items[${i}].name`);
      refsOf(w.text, f, `worlds.items[${i}].text`);
    });
    world.axes.items.forEach((a, i) => {
      if (a.axis !== i + 1)
        add(
          'error',
          f,
          `axes.items[${i}].axis`,
          `主軸清單必須依 1、2、3、4 排列（這裡是 ${a.axis}）`,
        );
      const page = bundle.pages?.[`0${a.axis}`];
      const title = (page as { title?: unknown } | undefined)?.title;
      if (typeof title === 'string' && title !== a.title)
        add(
          'warning',
          f,
          `axes.items[${i}].title`,
          `和 pages/0${a.axis}.yaml 的標題不一致：「${a.title}」≠「${title}」`,
        );
    });
  }

  // ── 各主軸頁 ───────────────────────────────────────────────
  const anchorsByHint = new Map<string, { file: string; axis: number; event: number }[]>();

  for (const [key, page] of pages) {
    const file = `pages/${key}.yaml`;
    if (String(page.axis).padStart(2, '0') !== key)
      add('error', file, 'axis', `axis（${page.axis}）與檔名（${key}）不一致`);
    if (page.number !== key)
      add('error', file, 'number', `number "${page.number}" 與檔名（${key}）不一致`);

    const eventNs = page.events.map((e) => e.n);
    eventNs.forEach((n, i) => {
      if (n !== i + 1)
        add(
          'error',
          file,
          `events[${i}].n`,
          `事件編號必須從 1 連續遞增（這裡是 ${n}，應為 ${i + 1}）`,
        );
    });
    const eventCount = page.events.length;

    // 圖
    const nodeIds = new Set(page.graph.nodes.map((n) => n.id));
    unique(
      page.graph.nodes.map((n) => n.id),
      file,
      'graph.nodes',
      '節點 id',
    );
    unique(
      page.graph.edges.map((e) => e.id),
      file,
      'graph.edges',
      '連線 id',
    );
    page.graph.nodes.forEach((n, i) => {
      if (n.kind === 'person' && peopleFile && !personIds.has(n.id))
        add(
          'error',
          file,
          `graph.nodes[${i}].id`,
          `人物節點 "${n.id}" 不在 people.yaml${suggest(n.id, personIds)}`,
        );
      if (n.kind === 'group' && !n.label)
        add('error', file, `graph.nodes[${i}].label`, '群體節點必須有 label');
    });
    page.graph.edges.forEach((e, i) => {
      for (const end of ['from', 'to'] as const)
        if (!nodeIds.has(e[end]))
          add(
            'error',
            file,
            `graph.edges[${i}].${end}`,
            `連線端點 "${e[end]}" 不是本頁定義的節點${suggest(e[end], nodeIds)}`,
          );
      if (e.event !== 'bg' && e.event > eventCount)
        add(
          'error',
          file,
          `graph.edges[${i}].event`,
          `事件序 ${e.event} 超過本頁事件數 ${eventCount}`,
        );
      if (!page.graph.legend.some((l) => l.kind === e.kind))
        add('error', file, `graph.edges[${i}].kind`, `線種 "${e.kind}" 沒有對應的圖例`);
    });
    for (const layoutKey of ['desktop', 'flow'] as const) {
      const layout = page.graph.layout[layoutKey];
      for (const id of nodeIds)
        if (!(id in layout.nodes))
          add('error', file, `graph.layout.${layoutKey}.nodes`, `缺少節點 "${id}" 的座標`);
      for (const id of Object.keys(layout.nodes))
        if (!nodeIds.has(id))
          add(
            'error',
            file,
            `graph.layout.${layoutKey}.nodes.${id}`,
            `座標對應的節點 "${id}" 不存在`,
          );
    }
    if (page.graph.layers) {
      const placed = new Map<string, number>();
      page.graph.layers.forEach((layer, i) =>
        layer.nodes.forEach((id) => {
          placed.set(id, (placed.get(id) ?? 0) + 1);
          if (!nodeIds.has(id))
            add('error', file, `graph.layers[${i}].nodes`, `分層中的節點 "${id}" 不存在`);
        }),
      );
      for (const id of nodeIds)
        if (placed.get(id) !== 1)
          add(
            'error',
            file,
            'graph.layers',
            `節點 "${id}" 必須恰好屬於一個分層（目前 ${placed.get(id) ?? 0}）`,
          );
    }

    // 事件
    const participantOk = (id: string) => personIds.has(id) || nodeIds.has(id);
    page.events.forEach((event, i) => {
      event.participants.forEach((id, j) => {
        if (!participantOk(id))
          add(
            'error',
            file,
            `events[${i}].participants[${j}]`,
            `參與者 "${id}" 不是人物也不是本頁節點${suggest(id, personIds)}`,
          );
      });
      const refs = refsOf(event.text, file, `events[${i}].text`);
      if (!refs) return;
      const hRefs = refs.filter((r) => r.type === 'h');
      // 伏筆片語不可重疊（巢狀的 {h:} 也算）
      hRefs.forEach((a, x) =>
        hRefs.forEach((b, y) => {
          if (x < y && a.start < b.end && b.start < a.end)
            add('error', file, `events[${i}].text`, `伏筆片語重疊：{h:${a.arg}} 與 {h:${b.arg}}`);
        }),
      );
      for (const r of hRefs) {
        const hint = hints.find((h) => h.id === r.arg);
        if (hint && (hint.recycle.axis !== page.axis || hint.recycle.event !== event.n))
          add(
            'error',
            file,
            `events[${i}].text`,
            `伏筆 "${r.arg}" 應出現在 0${hint.recycle.axis} 事件 ${hint.recycle.event}，但標在 0${page.axis} 事件 ${event.n}`,
          );
        const list = anchorsByHint.get(r.arg) ?? [];
        list.push({ file, axis: page.axis, event: event.n });
        anchorsByHint.set(r.arg, list);
      }
    });

    page.quotes?.forEach((q, i) => {
      if (peopleFile && !personIds.has(q.speaker))
        add(
          'error',
          file,
          `quotes[${i}].speaker`,
          `說話者 "${q.speaker}" 不在 people.yaml${suggest(q.speaker, personIds)}`,
        );
      if (q.event > eventCount)
        add('error', file, `quotes[${i}].event`, `事件序 ${q.event} 超過本頁事件數 ${eventCount}`);
      refsOf(q.text, file, `quotes[${i}].text`);
    });

    // 各頁專屬資料
    const ex = page.extras;
    ex.boundary?.stances.forEach((s, i) => {
      if (peopleFile && !personIds.has(s.personId))
        add(
          'error',
          file,
          `extras.boundary.stances[${i}].personId`,
          `未知人物 id "${s.personId}"${suggest(s.personId, personIds)}`,
        );
    });
    if (ex.boundary && ex.boundary.showFromEvent > page.events.length)
      add(
        'error',
        file,
        'extras.boundary.showFromEvent',
        `事件 ${ex.boundary.showFromEvent} 不存在`,
      );
    if (ex.mirror) {
      const rowKeys = new Set(ex.mirror.rows.map((r) => r.key));
      for (const side of ['sideA', 'sideB'] as const) {
        for (const k of rowKeys)
          if (!(k in ex.mirror[side].cells))
            add(
              'error',
              file,
              `extras.mirror.${side}.cells`,
              `缺少欄位 "${k}"（兩面欄位必須對齊）`,
            );
        for (const k of Object.keys(ex.mirror[side].cells))
          if (!rowKeys.has(k))
            add('error', file, `extras.mirror.${side}.cells.${k}`, `欄位 "${k}" 不在 rows 中`);
        if (peopleFile && !personIds.has(ex.mirror[side].personId))
          add(
            'error',
            file,
            `extras.mirror.${side}.personId`,
            `未知人物 id "${ex.mirror[side].personId}"`,
          );
      }
    }
  }

  // ── 伏筆回收處：每條恰有一個（回收頁存在時才檢查）──────────────────
  for (const h of hints) {
    const key = `0${h.recycle.axis}`;
    const page = pages.get(key);
    if (!page) continue;
    const event = page.events.find((e) => e.n === h.recycle.event);
    if (!event) {
      add(
        'error',
        'hints.yaml',
        `hints[${h.n - 1}].recycle`,
        `回收處 0${h.recycle.axis} 事件 ${h.recycle.event} 不存在`,
      );
      continue;
    }
    const found = anchorsByHint.get(h.id) ?? [];
    if (found.length === 0)
      add(
        'error',
        `pages/${key}.yaml`,
        `events[${event.n - 1}].text`,
        `伏筆 "${h.id}" 應出現在 0${h.recycle.axis} 事件 ${h.recycle.event}，但找不到 {h:${h.id}|…}`,
      );
    if (found.length > 1)
      add(
        'error',
        `pages/${key}.yaml`,
        `events[${event.n - 1}].text`,
        `伏筆 "${h.id}" 出現了 ${found.length} 次，必須恰有一個`,
      );
  }

  // ── 錯別字別名出現在文字中：建議修正原文 ────────────────────────
  const typos = people.flatMap((p) =>
    p.aliases.filter((a) => a.typo).map((a) => ({ text: a.text, id: p.id })),
  );
  // 先把正確的全名與別名遮掉（例如「艾莉絲」裡的「艾莉」不是錯字），再找錯字
  const valid = people
    .flatMap((p) => [p.name, ...p.aliases.filter((a) => !a.typo).map((a) => a.text)])
    .sort((a, b) => b.length - a.length);
  const mask = (text: string) => valid.reduce((acc, v) => acc.split(v).join(' '), text);
  for (const [key, page] of pages)
    page.events.forEach((e, i) => {
      const masked = mask(e.text);
      for (const t of typos)
        if (masked.includes(t.text))
          add(
            'warning',
            `pages/${key}.yaml`,
            `events[${i}].text`,
            `文字含錯別字「${t.text}」（${t.id}），建議直接修正原文`,
          );
    });

  return issues;
}
