import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// vitest 未開啟 globals，RTL 不會自動清理；每個測試後手動卸載已渲染的元件
afterEach(() => cleanup());
