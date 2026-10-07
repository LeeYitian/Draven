import { describe, expect, it } from 'vitest';
import {
  ageOf,
  clampCompare,
  compareRange,
  emphasisOf,
  firstSentence,
  quantizeAge,
  stepCompare,
} from '../../src/features/extras/compare';

describe('compareRange：把手可拖範圍', () => {
  it('舞台版寬 1288：20–80%（窄側 ≥ 96px 的限制不生效）', () => {
    expect(compareRange(1288)).toEqual([20, 80]);
  });
  it('流式版：窄側保證 ≥ 96px，所以範圍比 20–80 窄', () => {
    for (const w of [320, 342, 640]) {
      const [min, max] = compareRange(w);
      expect((min / 100) * w).toBeGreaterThanOrEqual(96 - 1e-9);
      expect(((100 - max) / 100) * w).toBeGreaterThanOrEqual(96 - 1e-9);
      expect(min).toBeGreaterThanOrEqual(20);
      expect(max).toBeLessThanOrEqual(80);
    }
    expect(compareRange(320)).toEqual([30, 70]);
    expect(compareRange(640)[0]).toBeCloseTo(20, 9); // 96/640 = 15% < 20% → 仍是 20
  });
  it('容器太窄放不下兩個 96px 時，把手固定在中間', () => {
    expect(compareRange(150)).toEqual([50, 50]);
  });
});

describe('ageOf：陳舊度', () => {
  for (const width of [320, 342, 640, 1288]) {
    it(`寬 ${width}：最右（可拖上限）得 1；50% 與左側得 0`, () => {
      const [min, max] = compareRange(width);
      expect(ageOf(max, width)).toBe(1);
      expect(ageOf(50, width)).toBe(0);
      expect(ageOf(min, width)).toBe(0);
      expect(ageOf(0, width)).toBe(0);
    });
  }
  it('舞台版：65% → 0.5、80% → 1（age = clamp((位置−50)/30)）', () => {
    expect(ageOf(65, 1288)).toBeCloseTo(0.5, 9);
    expect(ageOf(80, 1288)).toBe(1);
    expect(ageOf(100, 1288)).toBe(1);
  });
  it('中間值線性、單調', () => {
    let previous = -1;
    for (let p = 50; p <= 70; p += 2) {
      const a = ageOf(p, 342);
      expect(a).toBeGreaterThanOrEqual(previous);
      previous = a;
    }
  });
  it('範圍退化（max ≤ 50）時不除以零', () => {
    expect(ageOf(50, 150)).toBe(0);
  });
});

describe('clampCompare／stepCompare', () => {
  it('夾在可拖範圍內', () => {
    expect(clampCompare(5, 1288)).toBe(20);
    expect(clampCompare(95, 1288)).toBe(80);
    expect(clampCompare(95, 320)).toBe(70);
  });
  it('← → 每次 10%，到邊界停住', () => {
    expect(stepCompare(50, 1, 1288)).toBe(60);
    expect(stepCompare(50, -1, 1288)).toBe(40);
    expect(stepCompare(80, 1, 1288)).toBe(80);
    expect(stepCompare(20, -1, 1288)).toBe(20);
    expect(stepCompare(65, 1, 320)).toBe(70);
  });
});

describe('emphasisOf：寬側／窄側', () => {
  it('預設 50 與接近中線：兩側一樣', () => {
    expect(emphasisOf(50)).toBeNull();
    expect(emphasisOf(54)).toBeNull();
    expect(emphasisOf(46)).toBeNull();
  });
  it('把手偏右＝左側變寬；偏左＝右側變寬', () => {
    expect(emphasisOf(72)).toBe('left');
    expect(emphasisOf(30)).toBe('right');
    expect(emphasisOf(55)).toBe('left');
    expect(emphasisOf(45)).toBe('right');
  });
});

describe('firstSentence：窄側只留首句', () => {
  it('國王欄：第一個「…。」', () => {
    expect(
      firstSentence('「我不是選擇死亡。」「而是死亡是人生必經的一環。」「我只是不逃避。」'),
    ).toEqual({
      text: '「我不是選擇死亡。」',
      more: true,
    });
  });
  it('孩子欄：單一句就是整段', () => {
    const q = '「艾利安，你不是因為是個孩子才什麼都做不到，是因為你處的環境讓你什麼都做不了。」';
    expect(firstSentence(q)).toEqual({ text: q, more: false });
  });
  it('沒有句尾標點就整段', () => {
    expect(firstSentence('沒有標點的文字')).toEqual({ text: '沒有標點的文字', more: false });
  });
});

describe('quantizeAge', () => {
  it('量化到 1/50 的階梯', () => {
    expect(quantizeAge(0)).toBe(0);
    expect(quantizeAge(1)).toBe(1);
    expect(quantizeAge(0.5)).toBe(0.5);
    expect(quantizeAge(0.5049)).toBe(0.5);
    expect(quantizeAge(0.5101)).toBe(0.52);
  });
});
