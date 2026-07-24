/**
 * Unit tests for usage.js — the shared data model.
 *
 * Run with:  node --test tests/usage.test.js
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

// Simulate a browser-like globalThis so the IIFE can attach CodexUsage.
globalThis.globalThis = globalThis;
require('../usage.js');

const { normalizeUsage, currentWindow, weeklyWindow, isUsageStale } = CodexUsage;

/* ---- normalizeUsage ---- */

describe('normalizeUsage', () => {
  const validPayload = {
    plan_type: 'plus',
    rate_limit: {
      allowed: true,
      limit_reached: false,
      primary_window: {
        used_percent: 42,
        limit_window_seconds: 18000,
        reset_after_seconds: 3600
      },
      secondary_window: {
        used_percent: 15,
        limit_window_seconds: 604800
      }
    },
    credits: {
      balance: 500,
      has_credits: true,
      unlimited: false,
      overage_limit_reached: false
    }
  };

  it('returns null for empty payload', () => {
    assert.strictEqual(normalizeUsage(null), null);
    assert.strictEqual(normalizeUsage({}), null);
    assert.strictEqual(normalizeUsage({ rate_limit: {} }), null);
  });

  it('normalizes a valid payload', () => {
    const result = normalizeUsage(validPayload, { now: 1_700_000_000_000 });
    assert.ok(result);
    assert.strictEqual(result.usedPercent, 42);
    assert.strictEqual(result.remainingPercent, 58);
    assert.strictEqual(result.plan, 'plus');
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.limitReached, false);
    assert.strictEqual(result.creditsBalance, 500);
    assert.strictEqual(result.source, undefined);
  });

  it('preserves the source field', () => {
    const result = normalizeUsage(validPayload, { source: 'content' });
    assert.strictEqual(result.source, 'content');
  });

  it('clamps percent values to 0–100', () => {
    const payload = {
      rate_limit: { primary_window: { used_percent: 150, limit_window_seconds: 18000 } }
    };
    const result = normalizeUsage(payload, { now: Date.now() });
    assert.strictEqual(result.usedPercent, 100);
    assert.strictEqual(result.remainingPercent, 0);
  });

  it('handles missing credits gracefully', () => {
    const payload = {
      rate_limit: { primary_window: { used_percent: 10, limit_window_seconds: 18000 } }
    };
    const result = normalizeUsage(payload, { now: Date.now() });
    assert.strictEqual(result.creditsBalance, null);
    assert.strictEqual(result.hasCredits, false);
  });

  it('accepts credits-only payloads without a rate limit window', () => {
    const payload = {
      plan_type: 'plus',
      credits: {
        balance: 123.45,
        has_credits: true
      }
    };
    const result = normalizeUsage(payload, { now: Date.now() });
    assert.ok(result);
    assert.strictEqual(result.mode, 'credits');
    assert.strictEqual(result.primaryWindow, null);
    assert.strictEqual(result.creditsBalance, 123.45);
    assert.strictEqual(currentWindow(result), null);
  });

  it('accepts dynamic window arrays from newer quota shapes', () => {
    const payload = {
      plan: 'business',
      limits: [
        {
          used_percent: 20,
          remaining_percent: 80,
          window_seconds: 86400,
          reset_after_seconds: 3600
        }
      ]
    };
    const now = 1_700_000_000_000;
    const result = normalizeUsage(payload, { now });
    assert.ok(result);
    assert.strictEqual(result.mode, 'windowed');
    assert.strictEqual(result.windows.length, 1);
    assert.strictEqual(result.windows[0].remainingPercent, 80);
    assert.strictEqual(result.windows[0].limitWindowSeconds, 86400);
    assert.strictEqual(currentWindow(result), result.windows[0]);
  });

  it('keeps blocked status even when percentage windows are unavailable', () => {
    const payload = {
      rate_limit: {
        allowed: false,
        limit_reached: true
      },
      spend_control: { reached: true }
    };
    const result = normalizeUsage(payload, { now: Date.now() });
    assert.ok(result);
    assert.strictEqual(result.mode, 'unknown');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.limitReached, true);
    assert.strictEqual(result.spendLimitReached, true);
  });

  it('normalizes available reset credits', () => {
    const payload = {
      rateLimitResetCredits: {
        availableCount: 3,
        credits: [
          { id: 'later', status: 'available' },
          { id: 'earlier', status: 'available' }
        ]
      }
    };
    const result = normalizeUsage(payload, { now: Date.now() });
    assert.ok(result);
    assert.strictEqual(result.resetCredits.availableCount, 3);
    assert.strictEqual(result.resetCredits.rawAvailableCount, 3);
    assert.strictEqual(result.resetCredits.maxDisplayCount, 10);
  });

  it('normalizes app-server result reset credit shape', () => {
    const payload = {
      result: {
        rateLimitResetCredits: {
          availableCount: 1,
          credits: [
            { id: 'credit-1', status: 'available' }
          ]
        }
      }
    };
    const result = normalizeUsage(payload, { now: Date.now() });
    assert.ok(result);
    assert.strictEqual(result.resetCredits.availableCount, 1);
  });

  it('normalizes alternate banked reset count fields', () => {
    const result = normalizeUsage({ available_resets: 1 }, { now: Date.now() });
    assert.ok(result);
    assert.strictEqual(result.resetCredits.availableCount, 1);
    assert.strictEqual(result.resetCredits.rawAvailableCount, 1);
  });

  it('clamps reset credit display count while preserving the raw count', () => {
    const payload = {
      rate_limit_reset_credits: {
        available_count: 12
      }
    };
    const result = normalizeUsage(payload, { now: Date.now() });
    assert.ok(result);
    assert.strictEqual(result.resetCredits.availableCount, 10);
    assert.strictEqual(result.resetCredits.rawAvailableCount, 12);
  });

  it('detects limit_reached and overage flags', () => {
    const payload = {
      rate_limit: {
        primary_window: { used_percent: 99, limit_window_seconds: 18000 },
        allowed: false,
        limit_reached: true
      },
      credits: { overage_limit_reached: true },
      spend_control: { reached: true }
    };
    const result = normalizeUsage(payload, { now: Date.now() });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.limitReached, true);
    assert.strictEqual(result.overageLimitReached, true);
    assert.strictEqual(result.spendLimitReached, true);
  });

  it('computes resetAt from reset_after_seconds', () => {
    const payload = {
      rate_limit: {
        primary_window: {
          used_percent: 50,
          limit_window_seconds: 18000,
          reset_after_seconds: 7200
        }
      }
    };
    const now = 1_000_000_000_000;
    const result = normalizeUsage(payload, { now });
    assert.strictEqual(result.resetAt, now + 7200 * 1000);
    assert.strictEqual(result.primaryWindow.resetAtSource, 'reset_after_seconds');
  });

  it('accepts reset_at expressed in epoch seconds', () => {
    const now = 1_700_000_000_000;
    const resetAt = now + 3_600_000;
    const payload = {
      rate_limit: {
        primary_window: {
          used_percent: 50,
          limit_window_seconds: 18000,
          reset_at: resetAt / 1000
        }
      }
    };
    const result = normalizeUsage(payload, { now });
    assert.strictEqual(result.resetAt, resetAt);
    assert.strictEqual(result.primaryWindow.resetAtSource, 'reset_at');
  });

  it('accepts reset_at expressed in epoch milliseconds', () => {
    const now = 1_700_000_000_000;
    const resetAt = now + 3_600_000;
    const payload = {
      rate_limit: {
        primary_window: {
          used_percent: 50,
          limit_window_seconds: 18000,
          reset_at: resetAt
        }
      }
    };
    const result = normalizeUsage(payload, { now });
    assert.strictEqual(result.resetAt, resetAt);
  });

  it('prefers the relative reset duration when reset fields disagree', () => {
    const now = 1_700_000_000_000;
    const payload = {
      rate_limit: {
        primary_window: {
          used_percent: 50,
          limit_window_seconds: 18000,
          reset_after_seconds: 33 * 60,
          reset_at: now + (3 * 60 + 1) * 60_000
        }
      }
    };
    const result = normalizeUsage(payload, { now });
    assert.strictEqual(result.resetAt, now + 33 * 60_000);
    assert.strictEqual(result.primaryWindow.resetAtSource, 'reset_after_seconds');
    assert.strictEqual(
      result.primaryWindow.resetAtDiscrepancyMs,
      (3 * 60 + 1) * 60_000 - 33 * 60_000
    );
  });
});

/* ---- currentWindow ---- */

describe('currentWindow', () => {
  it('returns primaryWindow when available', () => {
    const usage = {
      primaryWindow: { usedPercent: 30, remainingPercent: 70 },
      usedPercent: 30
    };
    const w = currentWindow(usage);
    assert.strictEqual(w.usedPercent, 30);
  });

  it('does not use a weekly window as the current window', () => {
    const usage = {
      primaryWindow: {
        usedPercent: 27,
        remainingPercent: 73,
        limitWindowSeconds: 604800
      }
    };
    assert.strictEqual(currentWindow(usage), null);
  });

  it('falls back to the first non-weekly dynamic window', () => {
    const current = {
      usedPercent: 42,
      remainingPercent: 58,
      limitWindowSeconds: 86400
    };
    const usage = {
      windows: [
        { usedPercent: 27, remainingPercent: 73, limitWindowSeconds: 604800 },
        current
      ]
    };
    assert.strictEqual(currentWindow(usage), current);
  });

  it('falls back to top-level fields for legacy data', () => {
    const usage = { usedPercent: 55, remainingPercent: 45 };
    const w = currentWindow(usage);
    assert.strictEqual(w.usedPercent, 55);
  });

  it('returns null for empty input', () => {
    assert.strictEqual(currentWindow(null), null);
    assert.strictEqual(currentWindow({}), null);
  });
});

/* ---- weeklyWindow ---- */

describe('weeklyWindow', () => {
  it('returns a seven-day secondary window', () => {
    const secondaryWindow = {
      limitWindowSeconds: 604800,
      usedPercent: 25,
      remainingPercent: 75
    };
    assert.strictEqual(weeklyWindow({ secondaryWindow }), secondaryWindow);
  });

  it('does not mislabel an unknown secondary window as weekly', () => {
    const usage = {
      secondaryWindow: {
        limitWindowSeconds: 86400,
        usedPercent: 25,
        remainingPercent: 75
      }
    };
    assert.strictEqual(weeklyWindow(usage), null);
  });
});

/* ---- isUsageStale ---- */

describe('isUsageStale', () => {
  it('returns false for fresh data', () => {
    const usage = {
      primaryWindow: { usedPercent: 50, remainingPercent: 50, resetAt: Date.now() + 3_600_000 },
      ts: Date.now()
    };
    assert.strictEqual(isUsageStale(usage), false);
  });

  it('returns true when timestamp is too old', () => {
    const usage = {
      primaryWindow: { usedPercent: 50, remainingPercent: 50 },
      ts: Date.now() - 31 * 60 * 1000
    };
    assert.strictEqual(isUsageStale(usage), true);
  });

  it('returns true when resetAt is in the past', () => {
    const usage = {
      primaryWindow: {
        usedPercent: 50,
        remainingPercent: 50,
        resetAt: Date.now() - 60_000
      },
      ts: Date.now()
    };
    assert.strictEqual(isUsageStale(usage), true);
  });

  it('returns true when timestamp is missing', () => {
    const usage = {
      primaryWindow: { usedPercent: 50, remainingPercent: 50 }
    };
    assert.strictEqual(isUsageStale(usage), true);
  });

  it('ignores an expired secondary window that is not weekly', () => {
    const now = Date.now();
    const usage = {
      primaryWindow: {
        usedPercent: 50,
        remainingPercent: 50,
        resetAt: now + 60_000
      },
      secondaryWindow: {
        usedPercent: 20,
        remainingPercent: 80,
        limitWindowSeconds: 86400,
        resetAt: now - 60_000
      },
      ts: now
    };
    assert.strictEqual(isUsageStale(usage, now), false);
  });
});
