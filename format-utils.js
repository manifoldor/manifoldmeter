/**
 * Shared formatting helpers for popup and dashboard.
 *
 * Both surfaces need the same time-ago, countdown, and data-massaging
 * functions.  Keep them here so they stay in sync.
 */
(function initFormatUtils(root) {
  'use strict';

  const LOCALE = 'zh-CN';

  /* ---- math helpers ---- */

  function clampPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(100, Math.max(0, Math.round(number)));
  }

  function remainingOf(windowData) {
    if (!windowData) return 0;
    if (windowData.remainingPercent !== undefined) {
      return clampPercent(windowData.remainingPercent);
    }
    return 100 - clampPercent(windowData.usedPercent);
  }

  /* ---- time formatting ---- */

  function formatClock(date = new Date()) {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  /**
   * Human-readable countdown to a future timestamp.
   * Returns only the time portion — callers append their own suffix.
   */
  function formatCountdown(timestamp) {
    if (timestamp === null || timestamp === undefined || timestamp === '') return '重置时间未知';
    const diff = Number(timestamp) - Date.now();
    if (!Number.isFinite(diff)) return '重置时间未知';
    if (diff <= 0) return '即将';
    const totalMinutes = Math.ceil(diff / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}天 ${hours}时`;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /**
   * Clock time of the reset point, e.g. "19:22".
   */
  function formatResetTime(timestamp) {
    if (timestamp === null || timestamp === undefined || timestamp === '') return '--:--';
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime())) return '--:--';
    return new Intl.DateTimeFormat(LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  function formatWeeklyReset(timestamp) {
    if (timestamp === null || timestamp === undefined || timestamp === '') return '重置时间未知';
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime())) return '重置时间未知';
    const calendarDate = `${date.getMonth() + 1}月${date.getDate()}日`;
    return `${calendarDate} 重置`;
  }

  /**
   * Relative time string.  `fallback` is shown when timestamp is missing.
   */
  function formatUpdatedAt(timestamp, fallback, now = Date.now()) {
    if (!timestamp) return fallback || '等待同步';
    const seconds = Math.max(0, Math.round((Number(now) - Number(timestamp)) / 1000));
    if (seconds < 20) return '刚刚更新';
    if (seconds < 60) return `${seconds} 秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    return `${Math.floor(minutes / 60)} 小时前`;
  }

  /* ---- demo data ---- */

  function parseDemoNow(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function createDemoUsage(fixedNow = null) {
    const now = parseDemoNow(fixedNow) ?? Date.now();
    const weeklyReset = new Date(now);
    weeklyReset.setDate(weeklyReset.getDate() + 7);
    weeklyReset.setHours(9, 0, 0, 0);
    return {
      primaryWindow: {
        usedPercent: 43,
        remainingPercent: 57,
        resetAt: now + (2 * 60 + 14) * 60_000,
        limitWindowSeconds: 18000
      },
      secondaryWindow: {
        usedPercent: 27,
        remainingPercent: 73,
        resetAt: weeklyReset.getTime(),
        limitWindowSeconds: 604800
      },
      usedPercent: 43,
      remainingPercent: 57,
      resetAt: now + (2 * 60 + 14) * 60_000,
      plan: 'plus',
      allowed: true,
      creditsBalance: 1240,
      resetCredits: {
        availableCount: 3,
        rawAvailableCount: 3,
        maxDisplayCount: 10,
        credits: [],
        source: 'demo'
      },
      ts: now
    };
  }

  root.FormatUtils = Object.freeze({
    clampPercent,
    remainingOf,
    formatClock,
    formatCountdown,
    formatResetTime,
    formatWeeklyReset,
    formatUpdatedAt,
    parseDemoNow,
    createDemoUsage
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
