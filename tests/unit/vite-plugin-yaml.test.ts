import { describe, expect, it } from 'vitest';
import { yamlPlugin } from '../../scripts/vite-plugin-yaml.ts';

type TransformFn = (
  this: { error: (message: string) => never },
  code: string,
  id: string,
) => unknown;

function run(code: string, id: string) {
  const plugin = yamlPlugin();
  const transform = plugin.transform as TransformFn;
  const context = {
    error: (message: string): never => {
      throw new Error(message);
    },
  };
  return transform.call(context, code, id) as { code: string } | null;
}

describe('yamlPlugin', () => {
  it('把 YAML 轉成 JSON 模組', () => {
    const result = run('title: 德雷文\nitems:\n  - a\n  - b\n', '/src/content/ui.yaml');
    expect(result).not.toBeNull();
    const json = result!.code.replace(/^export default /, '').replace(/;$/, '');
    expect(JSON.parse(json)).toEqual({ title: '德雷文', items: ['a', 'b'] });
  });

  it('支援 >- 折行長文與中文引號', () => {
    const result = run('text: >-\n  第一行\n  第二行「引言」\n', '/x.yml');
    const json = result!.code.replace(/^export default /, '').replace(/;$/, '');
    expect(JSON.parse(json)).toEqual({ text: '第一行 第二行「引言」' });
  });

  it('忽略非 YAML 檔案與查詢字串', () => {
    expect(run('const a = 1;', '/src/main.ts')).toBeNull();
    expect(run('a: 1', '/src/x.yaml?import')).not.toBeNull();
  });

  it('YAML 語法錯誤時丟出包含檔名的錯誤', () => {
    expect(() => run('a: [1, 2', '/src/content/bad.yaml')).toThrow(/bad\.yaml/);
  });
});
