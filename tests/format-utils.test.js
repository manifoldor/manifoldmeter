const assert = require('node:assert');
const { describe, it } = require('node:test');

globalThis.globalThis = globalThis;
require('../format-utils.js');

const {
  clampPercent,
  remainingOf,
  formatResetTime,
  formatWeeklyReset,
  formatUpdatedAt
} = FormatUtils;

describe('percentage formatting', () => {
  it('clamps and rounds percentages', () => {
    assert.strictEqual(clampPercent(-1), 0);
    assert.strictEqual(clampPercent(42.6), 43);
    assert.strictEqual(clampPercent(101), 100);
  });

  it('uses an explicit remaining value when available', () => {
    assert.strictEqual(remainingOf({ usedPercent: 90, remainingPercent: 37 }), 37);
    assert.strictEqual(remainingOf({ usedPercent: 37 }), 63);
  });
});

describe('time formatting', () => {
  it('formats a reset timestamp as local HH:mm', () => {
    const date = new Date(2026, 6, 4, 9, 5, 0, 0);
    assert.strictEqual(formatResetTime(date.getTime()), '09:05');
  });

  it('formats weekly resets as a concrete month and date', () => {
    const date = new Date(2026, 6, 9, 9, 0, 0, 0);
    assert.strictEqual(formatWeeklyReset(date.getTime()), '7月9日 重置');
  });

  it('handles missing or invalid reset timestamps', () => {
    assert.strictEqual(formatResetTime(null), '--:--');
    assert.strictEqual(formatResetTime('invalid'), '--:--');
    assert.strictEqual(formatWeeklyReset(undefined), '重置时间未知');
  });

  it('formats recent update timestamps', () => {
    const originalNow = Date.now;
    Date.now = () => 1_700_000_000_000;
    try {
      assert.strictEqual(formatUpdatedAt(Date.now() - 10_000), '刚刚更新');
      assert.strictEqual(formatUpdatedAt(Date.now() - 90_000), '1 分钟前');
    } finally {
      Date.now = originalNow;
    }
  });
});
