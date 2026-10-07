/**
 * 人物誌的資料組裝：把內容檔（人物、各主軸連線、跨主軸補充關係）接上 center.ts／slots.ts 的純函式。
 * 與 React 無關；元件只負責把結果畫出來。
 */
import { getAxisPage, people, personRelations } from '../../content';
import type { AxisPage, Person, PersonRelation } from '../../content/schema';
import { GROUP_IDS, WORLD_IDS } from '../../content/constants';
import { isOnStage } from '../../store/selectors';
import {
  assignCenter,
  mergeRelations,
  type CenterLayout,
  type MergedRelation,
  type PairEdge,
} from './center';
import {
  arrangeByGroup,
  arrangeByOrder,
  arrangeByWorld,
  type Arrangement,
} from './slots';

export type SortMode = 'group' | 'order' | 'world';

// ── 關係 ─────────────────────────────────────────────────────────
/**
 * 「進度 n」時看得到的人與人關係（FR-052，粒度＝主軸）：
 * 01…n 各頁關係圖上的連線（只取兩端都是人物的，群體節點不是人物）＋跨主軸補充關係。
 * 補充關係只有在兩個人「都已登場」時才顯示，避免在讀者還沒認識他們之前就透露關係。
 */
export function collectPairEdges(
  progress: number,
  pages: readonly (AxisPage | undefined)[],
  supplements: readonly PersonRelation[],
  roster: readonly Pick<Person, 'id' | 'firstAppearance'>[],
): PairEdge[] {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const edges: PairEdge[] = [];
  for (const page of pages) {
    if (!page || page.axis > progress) continue;
    for (const e of page.graph.edges) {
      if (!byId.has(e.from) || !byId.has(e.to)) continue;
      edges.push({
        a: e.from,
        b: e.to,
        label: e.label,
        kind: e.kind,
        rank: page.axis * 100 + (e.event === 'bg' ? 0 : e.event),
      });
    }
  }
  for (const r of supplements) {
    const from = byId.get(r.from);
    const to = byId.get(r.to);
    if (!from || !to || !isOnStage(from, progress) || !isOnStage(to, progress)) continue;
    edges.push({ a: r.from, b: r.to, label: r.label, kind: r.kind, rank: 1000 });
  }
  return edges;
}

const ALL_PAGES = [1, 2, 3, 4].map((n) => getAxisPage(n));
const personOrder = Object.fromEntries(people.map((p) => [p.id, p.order]));
const allIds = [...people].sort((a, b) => a.order - b.order).map((p) => p.id);

/** 以某人為中心、進度 n 時的合併關係（已排好指派順序） */
export function relationsAt(centerId: string, progress: number): MergedRelation[] {
  return mergeRelations(
    centerId,
    collectPairEdges(progress, ALL_PAGES, personRelations, people),
    personOrder,
  );
}

export function centerLayoutAt(centerId: string, progress: number): CenterLayout {
  return assignCenter(centerId, relationsAt(centerId, progress), allIds);
}

// ── 排列 ─────────────────────────────────────────────────────────
export function arrangementFor(sort: SortMode): Arrangement {
  if (sort === 'group') return arrangeByGroup(people, GROUP_IDS);
  if (sort === 'order') return arrangeByOrder(people);
  return arrangeByWorld(people, WORLD_IDS);
}

// ── 篩選標籤（單選）────────────────────────────────────────────────
/** 標籤鍵：'group:royal'、'axis:2'、'tag:family' */
export type FilterKey = `group:${string}` | `axis:${number}` | `tag:${string}`;

/** 某人出現過的主軸（各主軸事件參與者的聯集）；尚未建立內容檔的主軸視為沒有人出現 */
export function axesOf(personId: string): number[] {
  return [1, 2, 3, 4].filter((n) =>
    getAxisPage(n)?.events.some((e) => e.participants.includes(personId)),
  );
}

export function matchesFilter(person: Person, key: string): boolean {
  const [kind, value = ''] = key.split(':');
  if (kind === 'group') return person.group === value;
  if (kind === 'tag') return (person.tags as string[]).includes(value);
  if (kind === 'axis') return axesOf(person.id).includes(Number(value));
  return false;
}

/** 被標籤選中的人物（含尚未登場者）；沒有標籤時為空集合 */
export function selectedIds(tag: string | null): Set<string> {
  if (!tag) return new Set();
  return new Set(people.filter((p) => matchesFilter(p, tag)).map((p) => p.id));
}
