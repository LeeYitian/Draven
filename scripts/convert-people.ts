// 一次性轉換腳本（任務 T034）：把 specs/內容準備與設計稿修改.md 的人物相關表格與「完整介紹」，
// 轉成 src/content/people.yaml。之後以 YAML 為準，作者直接改 YAML。
//
// 用法：node scripts/convert-people.ts [來源.md] [輸出.yaml]
//   預設來源 specs/內容準備與設計稿修改.md（此檔在 .gitignore，只存在本機）
//   預設輸出 src/content/people.yaml
import { readFileSync, writeFileSync } from 'node:fs';
import YAML from 'yaml';

const source = process.argv[2] ?? 'specs/內容準備與設計稿修改.md';
const output = process.argv[3] ?? 'src/content/people.yaml';
const md = readFileSync(source, 'utf8').replace(/\r\n/g, '\n');

// ── 對照表（名稱 → id、群體、世界、標籤）────────────────────────────
const ID: Record<string, string> = {
  德雷文: 'dravin',
  艾利安: 'elian',
  維洛: 'velo',
  利歐蘭: 'lioran',
  艾莉絲: 'elis',
  露米: 'rumi',
  諾爾: 'nor',
  瑟薇亞: 'sevia',
  主教: 'bishop',
  布倫: 'bren',
  黑影男人: 'shadow-man',
  法恩: 'fane',
  人馬預言家: 'centaur-seer',
  盤蛇神: 'snake-god',
  地龍: 'earth-dragon',
};
const GROUP: Record<string, string> = {
  王廷: 'royal',
  魔女集會: 'coven',
  盤蛇教會: 'cult',
  人馬族: 'centaur',
  神靈: 'deity',
};
const WORLD: Record<string, string> = {
  人間: 'human',
  地底交界: 'underground',
  異界: 'otherworld',
};
const TAG: Record<string, string> = {
  人類: 'human',
  外族: 'other',
  朝堂: 'hall',
  教會: 'church',
  臣子: 'vassal',
  家人: 'family',
  朋友: 'friend',
  互相監督: 'supervise',
  互相協助: 'assist',
};

// 別名：只列「值得自動辨識或需要特別標示」的稱呼（內容準備文件 §二-2「別名」表）。
// autoLink:false＝歧義或太常見，只在作者明確標 {p:id|文字} 時連結；typo＝全文出現過的錯字。
type Alias = { text: string; autoLink?: false; typo?: true };
const ALIASES: Record<string, Alias[]> = {
  德雷文: [
    { text: '陛下' },
    { text: '吾王' },
    { text: '夜獵者' },
    { text: '荊棘之王' },
    { text: '魔女之子' },
    { text: '巫者之王' },
    { text: '統一之杖', autoLink: false },
    { text: '聖王', autoLink: false },
  ],
  艾利安: [{ text: '小主人' }, { text: '安', autoLink: false }],
  艾莉絲: [
    { text: '魔女艾莉絲' },
    { text: '魔女閣下' },
    { text: '艾利絲', typo: true },
    { text: '艾莉', typo: true, autoLink: false },
  ],
  利歐蘭: [
    { text: '老精靈' },
    { text: '利歐蘭先生' },
    { text: '利歐蘭大人' },
    { text: '利歐欄', typo: true },
  ],
  維洛: [{ text: '維洛老師' }],
  法恩: [
    { text: '少族長', autoLink: false },
    { text: '特使', autoLink: false },
  ],
  盤蛇神: [
    { text: '盤蛇大人' },
    { text: '蛇神大人' },
    { text: '盤蛇', autoLink: false },
    { text: '盤神', typo: true, autoLink: false },
  ],
  地龍: [{ text: '地龍大人' }, { text: '上古地龍' }],
  人馬預言家: [{ text: '預言家' }],
  黑影男人: [{ text: '男人', autoLink: false }],
};

// ── 小工具 ───────────────────────────────────────────────────────
const clean = (s: string) => s.replace(/✎\s*/g, '').trim();
const stripRefs = (s: string) => s.replace(/（[\d、–\-,，\s]+）/g, '');

function sectionAfter(heading: string): string {
  const start = md.indexOf(heading);
  if (start < 0) throw new Error(`找不到章節：${heading}`);
  const rest = md.slice(start + heading.length);
  const next = rest.search(/\n#{2,4} /);
  return next < 0 ? rest : rest.slice(0, next);
}

function table(block: string): string[][] {
  return block
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) =>
      l
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim()),
    )
    .filter((cells) => !cells.every((c) => /^-+$/.test(c)));
}

// ── 1) 卡片 ──────────────────────────────────────────────────────
const cardRows = table(sectionAfter('#### 卡片')).slice(1);
// ── 2) 登場、出場順序與所在世界 ───────────────────────────────────
const orderRows = table(sectionAfter('#### 登場、出場順序與所在世界')).slice(1);
// ── 3) 事件標籤 ──────────────────────────────────────────────────
const tagRows = table(sectionAfter('#### 事件標籤')).slice(1);
// ── 4) 完整介紹 ──────────────────────────────────────────────────
const bioSection = sectionAfter('#### 完整介紹');
// ── 5) 跨主軸關係 ────────────────────────────────────────────────
const relRows = table(sectionAfter('#### 人物中心視角：跨主軸關係')).slice(1);
// ── 6) Popover ───────────────────────────────────────────────────
const popRows = table(sectionAfter('### 3. Popover 文字（人名）'))
  .filter((r) => r.length >= 5 && r[0] !== '階段' && r[0] !== '人物')
  .slice(0);

const idOf = (name: string) => {
  const id = ID[name];
  if (!id) throw new Error(`未知人物：${name}`);
  return id;
};

// 卡片簡介：去掉劇透段落，並把結尾的「；」改成「。」
function splitCardIntro(raw: string): { intro: string; spoilerAxis?: number } {
  const first = /\[劇透:(\d+)\]/.exec(raw);
  let intro = clean(raw.replace(/\[劇透:\d+\][\s\S]*?\[\/劇透\]/g, '')).trim();
  intro = intro.replace(/[；;]$/, '。');
  return first ? { intro, spoilerAxis: Number(first[1]) } : { intro };
}

// 完整介紹 → bio 區塊
function parseBio(text: string) {
  const blocks: Array<
    { type: 'text'; text: string } | { type: 'spoiler'; axis: number; text: string }
  > = [];
  const re = /\[劇透:(\d+)\]([\s\S]*?)\[\/劇透\]/g;
  let last = 0;
  const pushText = (t: string) => {
    const v = stripRefs(clean(t)).trim();
    if (v) blocks.push({ type: 'text', text: v });
  };
  for (let m = re.exec(text); m; m = re.exec(text)) {
    pushText(text.slice(last, m.index));
    const body = stripRefs(clean(m[2]!)).trim();
    if (body) blocks.push({ type: 'spoiler', axis: Number(m[1]), text: body });
    last = m.index + m[0].length;
  }
  pushText(text.slice(last));
  return blocks;
}

const bios = new Map<string, ReturnType<typeof parseBio>>();
for (const m of bioSection.matchAll(/\*\*([^*\n]+)\*\*\n([^\n]+)/g))
  bios.set(m[1]!.trim(), parseBio(m[2]!));

const orderBy = new Map<
  string,
  { order: number; axis: number; event: number; world: string; worldEnd?: string }
>();
for (const [n, name, first, world] of orderRows) {
  const f = /(\d+)\s*事件\s*(\d+)/.exec(first!);
  if (!f) throw new Error(`無法解析第一次出場：${name} ${first}`);
  const parts = world!.split('→').map((s) => s.trim());
  const w = WORLD[parts[0]!];
  if (!w) throw new Error(`未知世界：${world}`);
  const end = parts[1] ? WORLD[parts[1]] : undefined;
  orderBy.set(name!, {
    order: Number(n),
    axis: Number(f[1]),
    event: Number(f[2]),
    world: w,
    ...(end ? { worldEnd: end } : {}),
  });
}

const tagsOf = new Map<string, string[]>();
for (const [label, members] of tagRows) {
  const tag = TAG[label!];
  if (!tag) throw new Error(`未知標籤：${label}`);
  // 括號內是關係對象（可能含「、」），要先去掉再切分
  for (const raw of members!.replace(/（.*?）/g, '').split('、')) {
    const name = raw.trim();
    if (!ID[name]) throw new Error(`標籤「${label}」含未知人物：${raw}`);
    tagsOf.set(name, [...(tagsOf.get(name) ?? []), tag]);
  }
}

const popover = new Map<string, string[]>();
for (const row of popRows) {
  if (!ID[row[0]!]) continue;
  popover.set(
    row[0]!,
    [row[1] ?? '', row[2] ?? '', row[3] ?? '', row[4] ?? ''].map((s) => clean(s)),
  );
}

// ── 組合 ─────────────────────────────────────────────────────────
const people = cardRows
  .map(([group, name, role, introRaw]) => {
    const n = name!;
    const info = orderBy.get(n);
    const bio = bios.get(n);
    const pop = popover.get(n);
    if (!info) throw new Error(`缺少出場順序：${n}`);
    if (!bio) throw new Error(`缺少完整介紹：${n}`);
    if (!pop) throw new Error(`缺少 Popover：${n}`);
    const { intro, spoilerAxis } = splitCardIntro(introRaw!);
    return {
      id: idOf(n),
      name: n,
      group: GROUP[group!]!,
      role: clean(role!),
      intro,
      firstAppearance: { axis: info.axis, event: info.event },
      order: info.order,
      world: info.world,
      ...(info.worldEnd ? { worldEnd: info.worldEnd } : {}),
      tags: tagsOf.get(n) ?? [],
      aliases: ALIASES[n] ?? [],
      popover: pop,
      bio,
      ...(spoilerAxis ? { spoilerAxis } : {}),
    };
  })
  .sort((a, b) => a.order - b.order);

const relations = relRows.map(([from, to, label]) => ({
  from: idOf(from!),
  to: idOf(to!),
  label: label!,
  kind: 'relation',
}));

const header = `# 人物資料（15 人）：卡片、別名、Popover 4 階段、完整介紹（含劇透）、跨主軸關係。
# 由 scripts/convert-people.ts 自 specs/內容準備與設計稿修改.md 一次性轉換產生；之後直接改這個檔。
#
# popover：[基本身分, 讀完 01, 讀完 02, 讀完 03]；空字串＝沿用前一段；04 的內容永遠不進 Popover。
# bio：type: text（一般）／type: spoiler（axis＝讀完該主軸才算「已解鎖」，但仍預設遮蔽、點擊才顯示）。
# aliases：autoLink: false＝歧義，只在文字中寫 {p:id|文字} 時連結；typo: true＝全文出現過的錯字。
`;

writeFileSync(output, header + YAML.stringify({ people, relations }, { lineWidth: 0 }), 'utf8');
console.log(`已輸出 ${people.length} 位人物、${relations.length} 條跨主軸關係 → ${output}`);
