import { describe, expect, it } from 'vitest';
import { runSpring, springProgress, SPRING_DURATION_MS } from '../../src/lib/spring';

describe('springProgress（解析解，欠阻尼彈簧）', () => {
  it('起點 0、終點穩定在 1', () => {
    expect(springProgress(0)).toBe(0);
    expect(springProgress(2)).toBeCloseTo(1, 4);
  });

  it('過衝約 6%（設計稿 §6-K：彈簧過衝約 6%）', () => {
    let peak = 0;
    for (let t = 0; t <= 1; t += 0.001) peak = Math.max(peak, springProgress(t));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.07);
  });

  it('約 400ms 內穩定（誤差 < 3%）', () => {
    expect(SPRING_DURATION_MS).toBe(400);
    expect(Math.abs(springProgress(0.4) - 1)).toBeLessThan(0.03);
  });

  it('確實有過衝：先越過 1 再回來', () => {
    const samples = Array.from({ length: 41 }, (_, i) => springProgress(i / 100));
    const overshoot = samples.some((p) => p > 1);
    const crossedBack = samples
      .slice(samples.findIndex((p) => p > 1))
      .some((p, i, a) => i > 0 && p < a[i - 1]!);
    expect(overshoot).toBe(true);
    expect(crossedBack).toBe(true);
  });
});

/** 手動推進的假時鐘與假 requestAnimationFrame */
function fakeClock() {
  let time = 0;
  let nextId = 1;
  const pending = new Map<number, (t: number) => void>();
  return {
    now: () => time,
    requestFrame: (cb: (t: number) => void) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancelFrame: (id: number) => void pending.delete(id),
    step(ms: number) {
      time += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((cb) => cb(time));
    },
    get pendingCount() {
      return pending.size;
    },
  };
}

describe('runSpring', () => {
  it('依時間回報 0→（過衝）→1，結束時精準為 1 並呼叫 onDone', () => {
    const clock = fakeClock();
    const values: number[] = [];
    let done = false;
    runSpring((p) => values.push(p), { ...clock, onDone: () => (done = true) });
    for (let i = 0; i < 40; i++) clock.step(16.67);
    expect(values.length).toBeGreaterThan(10);
    expect(Math.max(...values)).toBeGreaterThan(1.04);
    expect(values.at(-1)).toBe(1);
    expect(done).toBe(true);
    expect(clock.pendingCount).toBe(0);
  });

  it('cancel 後不再回報也不呼叫 onDone', () => {
    const clock = fakeClock();
    let calls = 0;
    let done = false;
    const cancel = runSpring(() => calls++, { ...clock, onDone: () => (done = true) });
    clock.step(16);
    const before = calls;
    cancel();
    clock.step(16);
    clock.step(500);
    expect(calls).toBe(before);
    expect(done).toBe(false);
  });

  it('reduceMotion：直接回報 1 並結束，不排程動畫', () => {
    const clock = fakeClock();
    const values: number[] = [];
    let done = false;
    runSpring((p) => values.push(p), { ...clock, reduceMotion: true, onDone: () => (done = true) });
    expect(values).toEqual([1]);
    expect(done).toBe(true);
    expect(clock.pendingCount).toBe(0);
  });
});
