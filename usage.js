/**
 * Shared usage model helpers for every extension surface.
 *
 * Keep parsing and freshness rules in one place so the popup, content script,
 * and service worker agree on what a usage payload means.
 */
(function initCodexUsage(root) {
  const STALE_AFTER_MS = 30 * 60 * 1000;

  function asPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function normalizePlan(plan) {
    return typeof plan === 'string' && plan.trim() ? plan.trim() : undefined;
  }

  function windowLabel(seconds) {
    if (seconds === 604800) return 'weekly_label';
    if (seconds === 18000) return 'session_label';
    return 'usage_label';
  }

  function positiveNumberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function normalizeWindow(windowData, now = Date.now()) {
    if (!windowData) return null;

    const usedPercent = asPercent(windowData.used_percent);
    if (usedPercent === undefined) return null;

    const limitWindowSeconds = positiveNumberOrNull(windowData.limit_window_seconds);
    const resetAfterSeconds = positiveNumberOrNull(windowData.reset_after_seconds);
    const rawResetAt = positiveNumberOrNull(windowData.reset_at);

    let resetAt = null;
    if (rawResetAt) {
      // API may return seconds or milliseconds.  Values ≤ 10^10 (~year 2286 in
      // seconds) are treated as seconds; larger values are kept as milliseconds.
      const asMs = rawResetAt > 10_000_000_000 ? rawResetAt : rawResetAt * 1000;
      if (asMs > now) resetAt = asMs;
    }
    if (!resetAt && resetAfterSeconds) {
      resetAt = now + resetAfterSeconds * 1000;
    }

    return {
      usedPercent,
      remainingPercent: Math.max(0, 100 - usedPercent),
      limitWindowSeconds,
      resetAfterSeconds,
      resetAt,
      windowLabel: windowLabel(limitWindowSeconds)
    };
  }

  function normalizeUsage(data, options = {}) {
    const now = options.now ?? Date.now();
    const primaryWindow = normalizeWindow(data?.rate_limit?.primary_window, now);
    if (!primaryWindow) return null;

    const secondaryWindow = normalizeWindow(data?.rate_limit?.secondary_window, now);
    const creditsBalance = data?.credits?.balance;
    const normalizedCreditsBalance = creditsBalance === null || creditsBalance === undefined
      ? null
      : Number(creditsBalance);

    return {
      primaryWindow,
      secondaryWindow,
      usedPercent: primaryWindow.usedPercent,
      remainingPercent: primaryWindow.remainingPercent,
      limitWindowSeconds: primaryWindow.limitWindowSeconds,
      resetAfterSeconds: primaryWindow.resetAfterSeconds,
      resetAt: primaryWindow.resetAt,
      windowLabel: primaryWindow.windowLabel,
      plan: normalizePlan(data?.plan_type),
      allowed: data?.rate_limit?.allowed !== false,
      limitReached: Boolean(data?.rate_limit?.limit_reached),
      hasCredits: Boolean(data?.credits?.has_credits),
      creditsUnlimited: Boolean(data?.credits?.unlimited),
      overageLimitReached: Boolean(data?.credits?.overage_limit_reached),
      creditsBalance: Number.isFinite(normalizedCreditsBalance) ? normalizedCreditsBalance : null,
      spendLimitReached: Boolean(data?.spend_control?.reached),
      source: options.source,
      ts: now
    };
  }

  function currentWindow(usage) {
    if (usage?.primaryWindow) return usage.primaryWindow;
    if (usage?.usedPercent === undefined) return null;
    return {
      usedPercent: usage.usedPercent,
      remainingPercent: usage.remainingPercent,
      limitWindowSeconds: usage.limitWindowSeconds,
      resetAt: usage.resetAt,
      windowLabel: usage.windowLabel || windowLabel(usage.limitWindowSeconds)
    };
  }

  function isWindowOutdated(windowData, now = Date.now()) {
    return Boolean(windowData?.resetAt && Number(windowData.resetAt) <= now);
  }

  function isUsageStale(usage, now = Date.now()) {
    const primary = currentWindow(usage);
    if (!primary) return false;

    const timestamp = Number(usage?.ts);
    if (!Number.isFinite(timestamp)) return true;
    if (now - timestamp > STALE_AFTER_MS) return true;

    return [primary, usage?.secondaryWindow]
      .filter(Boolean)
      .some((windowData) => isWindowOutdated(windowData, now));
  }

  root.CodexUsage = Object.freeze({
    STALE_AFTER_MS,
    normalizeUsage,
    currentWindow,
    isUsageStale
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
