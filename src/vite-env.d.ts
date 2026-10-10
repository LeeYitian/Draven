/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 好讀版原文與目錄的來源：Cloudflare Worker 的根網址（不含 /full）。見 docs/設定worker和KV.md */
  readonly VITE_NOVEL_URL?: string;
}
