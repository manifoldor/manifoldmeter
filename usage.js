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

  function hasOwnValue(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
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

  function normalizeCredits(data) {
    const source = data?.credits || data?.credit_balance || data?.balance || {};
    const balance = source?.balance ?? source?.available_balance ?? source?.amount ?? null;
    const normalizedBalance = balance === null || balance === undefined ? null : Number(balance);
    return {
      hasCredits: Boolean(source?.has_credits),
      unlimited: Boolean(source?.unlimited),
      overageLimitReached: Boolean(source?.overage_limit_reached),
      balance: Number.isFinite(normalizedBalance) ? normalizedBalance : null
    };
  }

  function normalizeResetCredits(data) {
    const source = findResetCreditSource(data);
    if (!source) return null;

    const rawCount = source.availableCount ??
      source.available_count ??
      source.availableResetCount ??
      source.available_reset_count ??
      source.availableResets ??
      source.available_resets ??
      source.bankedResets ??
      source.banked_resets ??
      source.resetCount ??
      source.reset_count ??
      source.count ??
      source.available;
    const availableCount = rawCount === null || rawCount === undefined ? NaN : Number(rawCount);
    const normalizedCount = Number.isFinite(availableCount)
      ? Math.min(10, Math.max(0, Math.round(availableCount)))
      : null;
    const credits = Array.isArray(source.credits)
      ? source.credits
        .map((credit) => ({
          id: typeof credit?.id === 'string' ? credit.id : undefined,
          status: typeof credit?.status === 'string' ? credit.status : undefined,
          resetType: typeof credit?.resetType === 'string'
            ? credit.resetType
            : typeof credit?.reset_type === 'string'
              ? credit.reset_type
              : undefined
        }))
      : null;

    return {
      availableCount: normalizedCount,
      rawAvailableCount: Number.isFinite(availableCount) ? availableCount : null,
      maxDisplayCount: 10,
      credits,
      source: 'rate_limits'
    };
  }

  function findResetCreditSource(data) {
    const direct = data?.rateLimitResetCredits ||
      data?.rate_limit_reset_credits ||
      data?.rate_limit?.reset_credits ||
      data?.rate_limit?.rate_limit_reset_credits ||
      data?.reset_credits ||
      data?.resetCredits ||
      data?.earned_resets ||
      data?.earnedResets ||
      data?.banked_resets ||
      data?.bankedResets ||
      data?.result?.rateLimitResetCredits ||
      data?.result?.rate_limit_reset_credits ||
      null;
    if (direct) return direct;

    const count = data?.rate_limit_reset_credits_available_count ??
      data?.available_reset_count ??
      data?.available_resets ??
      data?.banked_reset_count ??
      data?.banked_resets ??
      data?.reset_count;
    if (count !== null && count !== undefined) {
      return { availableCount: count };
    }

    return null;
  }

  function normalizeWindow(windowData, now = Date.now()) {
    if (!windowData) return null;

    const usedPercent = asPercent(
      windowData.used_percent ??
      windowData.usedPercent ??
      windowData.percent_used
    );
    const remainingPercent = asPercent(
      windowData.remaining_percent ??
      windowData.remainingPercent ??
      windowData.percent_remaining
    );
    if (usedPercent === undefined && remainingPercent === undefined) return null;

    const limitWindowSeconds = positiveNumberOrNull(
      windowData.limit_window_seconds ??
      windowData.limitWindowSeconds ??
      windowData.window_seconds ??
      windowData.period_seconds
    );
    const resetAfterSeconds = positiveNumberOrNull(
      windowData.reset_after_seconds ??
      windowData.resetAfterSeconds
    );
    const rawResetAt = positiveNumberOrNull(
      windowData.reset_at ??
      windowData.resetAt
    );

    let resetAt = null;
    let resetAtSource = null;
    let absoluteResetAt = null;
    if (rawResetAt) {
      // API may return seconds or milliseconds.  Values ≤ 10^10 (~year 2286 in
      // seconds) are treated as seconds; larger values are kept as milliseconds.
      const asMs = rawResetAt > 10_000_000_000 ? rawResetAt : rawResetAt * 1000;
      if (asMs > now) absoluteResetAt = asMs;
    }

    // The relative duration describes the remaining time in the response that
    // was just received. Prefer it when both fields are present: reset_at has
    // been observed to remain stale while reset_after_seconds matches the
    // current ChatGPT usage UI.
    if (resetAfterSeconds) {
      resetAt = now + resetAfterSeconds * 1000;
      resetAtSource = 'reset_after_seconds';
    } else if (absoluteResetAt) {
      resetAt = absoluteResetAt;
      resetAtSource = 'reset_at';
    }

    return {
      usedPercent: usedPercent ?? Math.max(0, 100 - remainingPercent),
      remainingPercent: remainingPercent ?? Math.max(0, 100 - usedPercent),
      limitWindowSeconds,
      resetAfterSeconds,
      resetAt,
      resetAtSource,
      resetAtDiscrepancyMs: resetAt && absoluteResetAt
        ? Math.abs(resetAt - absoluteResetAt)
        : null,
      windowLabel: windowLabel(limitWindowSeconds)
    };
  }

  function compactWindows(...windows) {
    return windows.filter(Boolean);
  }

  function normalizeWindowArray(data, now) {
    const candidates = [
      ...(Array.isArray(data?.rate_limit?.windows) ? data.rate_limit.windows : []),
      ...(Array.isArray(data?.limits) ? data.limits : []),
      ...(Array.isArray(data?.windows) ? data.windows : []),
      ...(Array.isArray(data?.usage?.windows) ? data.usage.windows : [])
    ];
    return candidates
      .map((windowData) => normalizeWindow(windowData, now))
      .filter(Boolean);
  }

  function usageMode({ primaryWindow, secondaryWindow, extraWindows, credits }) {
    const hasWindow = Boolean(primaryWindow || secondaryWindow || extraWindows.length);
    const hasCreditSignal = credits.unlimited ||
      credits.balance !== null ||
      credits.hasCredits ||
      credits.overageLimitReached;
    if (hasWindow && hasCreditSignal) return 'hybrid';
    if (hasWindow) return 'windowed';
    if (hasCreditSignal) return 'credits';
    return 'unknown';
  }

  function normalizeUsage(data, options = {}) {
    const now = options.now ?? Date.now();
    const primaryWindow = normalizeWindow(data?.rate_limit?.primary_window, now);
    const secondaryWindow = normalizeWindow(data?.rate_limit?.secondary_window, now);
    const extraWindows = normalizeWindowArray(data, now);
    const windows = compactWindows(primaryWindow, secondaryWindow, ...extraWindows);
    const credits = normalizeCredits(data);
    const resetCredits = normalizeResetCredits(data);
    const plan = normalizePlan(data?.plan_type ?? data?.plan ?? data?.account_plan);
    const spendLimitReached = Boolean(
      data?.spend_control?.reached ??
      data?.spendControl?.reached
    );
    const mode = usageMode({ primaryWindow, secondaryWindow, extraWindows, credits });

    const hasRateLimitStatus = hasOwnValue(data?.rate_limit, 'allowed') ||
      hasOwnValue(data?.rate_limit, 'limit_reached');
    if (
      !windows.length &&
      mode === 'unknown' &&
      !plan &&
      !resetCredits &&
      !hasRateLimitStatus &&
      !spendLimitReached
    ) {
      return null;
    }

    return {
      mode,
      windows,
      credits,
      resetCredits,
      primaryWindow,
      secondaryWindow,
      usedPercent: primaryWindow?.usedPercent,
      remainingPercent: primaryWindow?.remainingPercent,
      limitWindowSeconds: primaryWindow?.limitWindowSeconds,
      resetAfterSeconds: primaryWindow?.resetAfterSeconds,
      resetAt: primaryWindow?.resetAt,
      windowLabel: primaryWindow?.windowLabel,
      plan,
      allowed: data?.rate_limit?.allowed !== false,
      limitReached: Boolean(data?.rate_limit?.limit_reached),
      hasCredits: credits.hasCredits,
      creditsUnlimited: credits.unlimited,
      overageLimitReached: credits.overageLimitReached,
      creditsBalance: credits.balance,
      spendLimitReached,
      source: options.source,
      ts: now
    };
  }

  function currentWindow(usage) {
    if (usage?.primaryWindow && !isWeeklyWindow(usage.primaryWindow)) return usage.primaryWindow;
    if (Array.isArray(usage?.windows)) {
      const current = usage.windows.find((windowData) => !isWeeklyWindow(windowData));
      if (current) return current;
    }
    if (usage?.usedPercent === undefined || isWeeklyWindow(usage)) return null;
    return {
      usedPercent: usage.usedPercent,
      remainingPercent: usage.remainingPercent,
      limitWindowSeconds: usage.limitWindowSeconds,
      resetAt: usage.resetAt,
      windowLabel: usage.windowLabel || windowLabel(usage.limitWindowSeconds)
    };
  }

  function weeklyWindow(usage) {
    let secondary = usage?.secondaryWindow;
    if (!secondary && Array.isArray(usage?.windows)) {
      secondary = usage.windows.find((windowData) => isWeeklyWindow(windowData));
    }
    if (!secondary) return null;
    return isWeeklyWindow(secondary) ? secondary : null;
  }

  function isWeeklyWindow(windowData) {
    return Number(windowData?.limitWindowSeconds) === 604800 ||
      windowData?.windowLabel === 'weekly_label';
  }

  function isWindowOutdated(windowData, now = Date.now()) {
    return Boolean(windowData?.resetAt && Number(windowData.resetAt) <= now);
  }

  function isUsageStale(usage, now = Date.now()) {
    const windows = [currentWindow(usage), weeklyWindow(usage)].filter(Boolean);
    if (!windows.length) return false;

    const timestamp = Number(usage?.ts);
    if (!Number.isFinite(timestamp)) return true;
    if (now - timestamp > STALE_AFTER_MS) return true;

    return windows.some((windowData) => isWindowOutdated(windowData, now));
  }

  root.CodexUsage = Object.freeze({
    STALE_AFTER_MS,
    normalizeUsage,
    currentWindow,
    weeklyWindow,
    isUsageStale
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
