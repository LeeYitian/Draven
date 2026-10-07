/**
 * 內容分類的常數（不依賴 zod）。畫面元件需要這些清單時從這裡取，
 * 才不會把整個 zod 與全部結構定義（schema.ts）帶進正式網站的 JS。
 * 本檔會被 Node 直接執行（scripts/content-check.ts 經 schema.ts 引入），import 一律寫副檔名。
 */

/** 群體（人物誌排列「依群體」）：王廷、魔女集會、盤蛇教會、人馬族、神靈 */
export const GROUP_IDS = ['royal', 'coven', 'cult', 'centaur', 'deity'] as const;
/** 關係標籤（人物誌篩選）：人類／外族／朝堂／教會／臣子／家人／朋友／互相監督／互相協助 */
export const TAG_IDS = [
  'human',
  'other',
  'hall',
  'church',
  'vassal',
  'family',
  'friend',
  'supervise',
  'assist',
] as const;
export const WORLD_IDS = ['human', 'underground', 'otherworld'] as const;
export const EDGE_KINDS = ['key', 'relation', 'conflict'] as const;
