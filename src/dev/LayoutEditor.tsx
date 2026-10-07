import { useState } from 'react';

/**
 * 關係圖座標校正器（僅開發模式，網址加 ?editor=1；不會進入正式建置）。
 * 在圖上拖曳節點（放開不回彈）→ 按「複製座標」→ 貼到該頁 YAML 的 graph.layout.desktop 或 flow。
 * 桌機與流式版各自一組：切換視窗寬度（< 1024 為流式）後再各調各的。
 */
export interface LayoutEditorProps {
  mode: 'stage' | 'flow';
  /** 設計時的畫布尺寸（YAML 的 size） */
  size: readonly [number, number];
  /** 目前每個節點的位置（設計座標 px，已含拖曳位移） */
  nodes: Readonly<Record<string, readonly [number, number]>>;
  onReset: () => void;
}

export function toYaml(
  mode: 'stage' | 'flow',
  size: readonly [number, number],
  nodes: Readonly<Record<string, readonly [number, number]>>,
): string {
  const lines = [
    `    ${mode === 'stage' ? 'desktop' : 'flow'}:`,
    `      size: [${size[0]}, ${size[1]}]`,
    '      nodes:',
    ...Object.entries(nodes).map(([id, [x, y]]) => `        ${id}: [${Math.round(x)}, ${Math.round(y)}]`),
  ];
  return lines.join('\n');
}

export default function LayoutEditor({ mode, size, nodes, onReset }: LayoutEditorProps) {
  const [copied, setCopied] = useState(false);
  const yaml = toYaml(mode, size, nodes);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      console.log(yaml); // 剪貼簿不可用時印在主控台
    }
  };

  return (
    <div
      data-layout-editor
      className="fixed top-2 right-2 z-[100] flex w-64 flex-col gap-2 rounded-md border border-accent bg-bg p-3 text-[12px] shadow-md"
    >
      <div className="font-semibold">座標校正器（{mode === 'stage' ? '桌機' : '流式'}）</div>
      <pre className="m-0 max-h-48 overflow-auto leading-tight">{yaml}</pre>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={copy}>
          {copied ? '已複製' : '複製座標'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          還原
        </button>
      </div>
    </div>
  );
}
