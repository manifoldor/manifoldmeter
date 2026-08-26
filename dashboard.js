const SEGMENT_COUNT = 50;
const VISIBLE_REFRESH_MS = 60_000;
const CODEX_ANALYTICS_URL = 'https://chatgpt.com/codex/cloud/settings/analytics';
const USER_DATA_CONSENT_KEY = 'codexUserDataConsent';
const USER_DATA_CONSENT_VERSION = '2026-08-01';
const hasExtensionApi = typeof chrome !== 'undefined' &&
  chrome.storage?.local &&
  chrome.runtime?.sendMessage;
const searchParams = new URLSearchParams(location.search);
const useDemoData = searchParams.has('demo') || !hasExtensionApi;
if (searchParams.has('snapshot')) {
  document.documentElement.dataset.snapshot = 'true';
}
const {
  remainingOf,
  formatClock,
  formatResetTime,
  formatWeeklyReset,
  formatUpdatedAt,
  parseDemoNow,
  createDemoUsage
} = FormatUtils;
const demoNow = parseDemoNow(searchParams.get('demo-now'));
const creditsFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2
});

function createSurfaceDemoUsage() {
  const usage = createDemoUsage(demoNow);
  if (!searchParams.has('weekly-only') && !location.href.includes('weekly-only')) return usage;
  usage.plan = 'pro';
  usage.primaryWindow = null;
  usage.usedPercent = undefined;
  usage.remainingPercent = undefined;
  usage.resetAt = undefined;
  usage.limitWindowSeconds = undefined;
  usage.windowLabel = undefined;
  usage.windows = [usage.secondaryWindow].filter(Boolean);
  return usage;
}

const els = {
  clock: document.getElementById('clock'),
  content: document.querySelector('.content'),
  plan: document.getElementById('plan'),
  syncState: document.getElementById('sync-state'),
  syncLabel: document.getElementById('sync-label'),
  primaryMetric: document.querySelector('.primary-metric'),
  primaryValue: document.getElementById('primary-value'),
  primaryPercentSymbol: document.querySelector('.percent-symbol'),
  primaryRemainingLabel: document.querySelector('.remaining-label'),
  primaryTitle: document.getElementById('primary-title'),
  primaryReset: document.getElementById('primary-reset'),
  primaryResetSuffix: document.getElementById('primary-reset-suffix'),
  primaryProgress: document.getElementById('primary-progress'),
  weeklyValue: document.getElementById('weekly-value'),
  weeklyReset: document.getElementById('weekly-reset'),
  weeklyTrack: document.getElementById('weekly-linear-progress'),
  weeklyProgress: document.getElementById('weekly-progress'),
  weeklySegmentedArea: document.getElementById('weekly-segmented-area'),
  weeklySegmentedProgress: document.getElementById('weekly-segmented-progress'),
  creditsValue: document.getElementById('credits-value'),
  resetCredits: document.querySelector('.reset-credits'),
  resetCreditsValue: document.getElementById('reset-credits-value'),
  resetCreditsDots: document.getElementById('reset-credits-dots'),
  lastUpdate: document.getElementById('last-update'),
  notice: document.getElementById('notice'),
  noticeTitle: document.getElementById('notice-title'),
  noticeCopy: document.getElementById('notice-copy'),
  openAnalyticsBtn: document.getElementById('open-analytics-btn'),
  fullscreenBtn: document.getElementById('fullscreen-btn')
};

let latestUsage = null;
let latestError = null;
let visibleRefreshTimer = null;
let userDataConsented = false;
const renderedFilledCounts = new WeakMap();
let renderedResetDotCount = null;

function updateText(element, value) {
  const nextValue = String(value);
  if (element.textContent === nextValue) return false;
  element.textContent = nextValue;
  return true;
}

function updateHidden(element, hidden) {
  const nextValue = Boolean(hidden);
  if (element.hidden === nextValue) return false;
  element.hidden = nextValue;
  return true;
}

function updateAttribute(element, name, value) {
  const nextValue = String(value);
  if (element.getAttribute(name) === nextValue) return false;
  element.setAttribute(name, nextValue);
  return true;
}

function updateData(element, name, value) {
  const nextValue = String(value);
  if (element.dataset[name] === nextValue) return false;
  element.dataset[name] = nextValue;
  return true;
}

function updateClass(element, name, enabled) {
  const nextValue = Boolean(enabled);
  if (element.classList.contains(name) === nextValue) return false;
  element.classList.toggle(name, nextValue);
  return true;
}

function updateStyle(element, property, value) {
  const nextValue = String(value);
  if (element.style[property] === nextValue) return false;
  element.style[property] = nextValue;
  return true;
}

function buildSegments(progress) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    const segment = document.createElement('span');
    segment.className = 'segment';
    if (index === Math.floor(SEGMENT_COUNT / 2)) segment.classList.add('is-half');
    segment.setAttribute('aria-hidden', 'true');
    fragment.appendChild(segment);
  }
  progress.appendChild(fragment);
}

function setResetCreditDots(count) {
  const visibleCount = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  if (renderedResetDotCount === visibleCount) return;

  els.resetCreditsDots.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < visibleCount; index += 1) {
    const dot = document.createElement('span');
    dot.className = 'reset-credit-dot is-filled';
    dot.setAttribute('aria-hidden', 'true');
    fragment.appendChild(dot);
  }
  els.resetCreditsDots.appendChild(fragment);
  renderedResetDotCount = visibleCount;
}

function setSegmentedProgress(progress, percent) {
  const rawPercent = Number(percent);
  const normalizedPercent = Number.isFinite(rawPercent)
    ? Math.min(100, Math.max(0, rawPercent))
    : 0;
  const filledCount = Math.round((normalizedPercent / 100) * SEGMENT_COUNT);
  const renderedFilledCount = renderedFilledCounts.get(progress) ?? null;
  if (renderedFilledCount !== filledCount) {
    const segments = progress.children;
    const start = renderedFilledCount === null
      ? 0
      : Math.min(renderedFilledCount, filledCount);
    const end = renderedFilledCount === null
      ? SEGMENT_COUNT
      : Math.max(renderedFilledCount, filledCount);

    for (let index = start; index < end; index += 1) {
      segments[index].classList.toggle('is-filled', index < filledCount);
    }
    renderedFilledCounts.set(progress, filledCount);
  }
  updateAttribute(progress, 'aria-valuenow', normalizedPercent);
}

function setSyncState(state, label) {
  updateData(els.syncState, 'state', state);
  updateText(els.syncLabel, label);
}

function setNotice(error, hasUsage = false) {
  const show = Boolean(error);
  updateHidden(els.notice, !show);
  if (!show) return;

  const status = String(error.status ?? 'unknown');
  if (status === 'consent-required') {
    updateText(els.noticeTitle, '需要先确认数据使用');
    updateText(els.noticeCopy, '阅读数据说明并同意后，扩展才会连接和同步。');
    updateText(els.openAnalyticsBtn, '查看数据说明');
  } else if (status === '401' || status === '403') {
    updateText(els.noticeTitle, '登录状态已失效');
    updateText(els.noticeCopy, '打开 ChatGPT 用量页重新登录，扩展会自动重试。');
    updateText(els.openAnalyticsBtn, '打开用量页');
  } else if (status === 'invalid-response') {
    updateText(els.noticeTitle, '接口格式发生变化');
    updateText(els.noticeCopy, '扩展保留了最后一次成功数据，请稍后再试。');
    updateText(els.openAnalyticsBtn, '打开用量页');
  } else {
    updateText(els.noticeTitle, '暂时无法更新');
    updateText(
      els.noticeCopy,
      hasUsage
        ? '当前显示上次成功数据，请检查网络或登录状态。'
        : '请检查网络，并确认 Chrome 已登录 ChatGPT。'
    );
    updateText(els.openAnalyticsBtn, '打开用量页');
  }
}

function describeWindow(windowData, fallback = '当前额度') {
  const seconds = Number(windowData?.limitWindowSeconds);
  if (seconds === 18000) return '5小时额度';
  if (seconds === 604800) return '本周额度';
  if (Number.isFinite(seconds) && seconds > 0) {
    if (seconds % 86400 === 0) return `${seconds / 86400}天额度`;
    if (seconds % 3600 === 0) return `${seconds / 3600}小时额度`;
  }
  return fallback;
}

function setPrimaryMetric(primary, usage) {
  const primaryRemaining = primary ? remainingOf(primary) : null;
  const hasPrimaryPercent = primaryRemaining !== null && primaryRemaining !== undefined;
  updateText(els.primaryTitle, primary ? describeWindow(primary) : '当前额度');
  updateText(els.primaryValue, hasPrimaryPercent ? primaryRemaining : '—');
  updateHidden(els.primaryPercentSymbol, !hasPrimaryPercent);
  if (hasPrimaryPercent) {
    updateText(els.primaryRemainingLabel, '剩余');
  } else if (usage.mode === 'credits') {
    updateText(els.primaryRemainingLabel, '按剩余积分');
  } else {
    updateText(els.primaryRemainingLabel, '当前额度');
  }

  const primaryResetTime = formatResetTime(primary?.resetAt);
  updateText(els.primaryReset, primaryResetTime);
  updateHidden(els.primaryResetSuffix, !primary || primaryResetTime === '--:--');
  setSegmentedProgress(els.primaryProgress, hasPrimaryPercent ? primaryRemaining : 0);
  updateAttribute(
    els.primaryProgress,
    'aria-valuetext',
    hasPrimaryPercent ? `剩余 ${primaryRemaining}%` : '未提供百分比额度'
  );
}

function renderResetCredits(resetCredits) {
  const count = Number(resetCredits?.availableCount);
  const rawCount = Number(resetCredits?.rawAvailableCount);
  const hasCount = Number.isFinite(count);
  const displayCount = hasCount ? Math.min(10, Math.max(0, Math.round(count))) : 0;
  const overflow = Number.isFinite(rawCount) && rawCount > 10;
  updateHidden(els.resetCredits, !hasCount);
  if (!hasCount) {
    updateText(els.resetCreditsValue, '');
    setResetCreditDots(0);
    updateAttribute(els.resetCreditsDots, 'aria-valuenow', '0');
    updateAttribute(els.resetCreditsDots, 'aria-valuemax', '1');
    updateAttribute(els.resetCreditsDots, 'aria-valuetext', '');
    return;
  }

  updateData(
    els.resetCredits,
    'level',
    hasCount && displayCount > 0 && displayCount <= 3 ? 'low' : 'normal'
  );
  updateText(els.resetCreditsValue, overflow ? '10+次' : `${displayCount}次`);
  setResetCreditDots(displayCount);
  updateAttribute(els.resetCreditsDots, 'aria-valuenow', displayCount);
  updateAttribute(els.resetCreditsDots, 'aria-valuemax', Math.max(displayCount, 1));
  updateAttribute(
    els.resetCreditsDots,
    'aria-valuetext',
    `可用重置次数 ${displayCount} 次`
  );
}

function updateLastUpdated(now = useDemoData && demoNow ? demoNow : Date.now()) {
  if (!latestUsage) return;
  updateText(
    els.lastUpdate,
    formatUpdatedAt(latestUsage.ts, '等待首次同步', now)
  );
}

function render(usage, error = null) {
  if (!usage) {
    setSyncState(error ? 'error' : 'stale', error ? '同步失败' : '等待数据');
    setNotice(error);
    return;
  }

  latestUsage = usage;
  latestError = error;
  const primary = CodexUsage.currentWindow(usage);
  const secondary = CodexUsage.weeklyWindow(usage);
  const secondaryRemaining = secondary ? remainingOf(secondary) : null;
  const stale = CodexUsage.isUsageStale(
    usage,
    useDemoData && demoNow ? demoNow : Date.now()
  );
  const blocked = usage.limitReached ||
    usage.overageLimitReached ||
    usage.spendLimitReached ||
    usage.allowed === false;

  const planName = usage.plan ? String(usage.plan).toUpperCase() : 'CHATGPT';
  updateText(els.plan, `CODEX · ${planName}`);
  renderResetCredits(usage.resetCredits);
  const weeklyOnly = !primary && Boolean(secondary);
  updateClass(els.content, 'is-weekly-only', weeklyOnly);
  updateHidden(els.primaryMetric, !primary);
  updateHidden(els.weeklyTrack, weeklyOnly);
  updateHidden(els.weeklySegmentedArea, !weeklyOnly);
  if (primary) setPrimaryMetric(primary, usage);

  updateText(els.weeklyValue, secondaryRemaining === null ? '—' : secondaryRemaining);
  updateText(
    els.weeklyReset,
    secondary ? formatWeeklyReset(secondary.resetAt) : '未提供本周额度'
  );
  updateStyle(els.weeklyProgress, 'width', `${secondaryRemaining ?? 0}%`);
  setSegmentedProgress(els.weeklySegmentedProgress, secondaryRemaining ?? 0);
  updateAttribute(els.weeklyTrack, 'aria-valuenow', secondaryRemaining ?? 0);
  updateAttribute(
    els.weeklyTrack,
    'aria-valuetext',
    secondaryRemaining === null ? '未提供本周额度' : `本周额度剩余 ${secondaryRemaining}%`
  );
  updateAttribute(
    els.weeklySegmentedProgress,
    'aria-valuetext',
    secondaryRemaining === null ? '未提供本周额度' : `本周额度剩余 ${secondaryRemaining}%`
  );

  if (usage.creditsUnlimited) {
    updateText(els.creditsValue, '∞');
  } else if (usage.creditsBalance !== null && usage.creditsBalance !== undefined) {
    updateText(els.creditsValue, creditsFormatter.format(usage.creditsBalance));
  } else {
    updateText(els.creditsValue, '—');
  }

  updateLastUpdated();

  if (blocked) {
    setSyncState('error', '额度已用尽');
  } else if (error) {
    setSyncState('error', '更新失败 · 显示上次数据');
  } else if (stale) {
    setSyncState('stale', '数据已过期');
  } else {
    setSyncState('ok', '同步正常');
  }

  setNotice(error, true);
}

async function refresh() {
  if (useDemoData) {
    render(createSurfaceDemoUsage());
    return;
  }

  if (!userDataConsented) {
    latestError = { status: 'consent-required', source: 'dashboard' };
    setSyncState('stale', '等待用户确认');
    setNotice(latestError);
    return;
  }

  try {
    const result = await chrome.runtime.sendMessage({ type: 'FETCH_NOW', force: true });
    if (!result?.ok) {
      latestError = result || { status: 'unknown', source: 'dashboard' };
      setSyncState('error', '同步失败');
      setNotice(latestError);
      return;
    }
    const data = await chrome.storage.local.get(['codexUsage', 'codexUsageError']);
    render(data.codexUsage ?? latestUsage, data.codexUsageError ?? null);
  } catch {
    latestError = { status: 'exception', source: 'dashboard' };
    setSyncState('error', '同步失败');
    setNotice(latestError);
  }
}

function stopVisibleRefresh() {
  if (!visibleRefreshTimer) return;
  clearInterval(visibleRefreshTimer);
  visibleRefreshTimer = null;
}

function startVisibleRefresh() {
  if (useDemoData || !userDataConsented || document.hidden || visibleRefreshTimer) return;
  visibleRefreshTimer = setInterval(() => {
    if (!document.hidden) void refresh();
  }, VISIBLE_REFRESH_MS);
}

function tick() {
  const now = useDemoData && demoNow ? demoNow : Date.now();
  updateText(els.clock, formatClock(new Date(now)));
  updateLastUpdated(now);
}

async function init() {
  buildSegments(els.primaryProgress);
  buildSegments(els.weeklySegmentedProgress);
  tick();
  setInterval(tick, 1000);

  if (useDemoData) {
    render(createSurfaceDemoUsage());
    return;
  }

  const consentData = await chrome.storage.local.get(USER_DATA_CONSENT_KEY);
  userDataConsented = consentData[USER_DATA_CONSENT_KEY] === USER_DATA_CONSENT_VERSION;
  if (!userDataConsented) {
    render(null, null);
    setSyncState('stale', '等待用户确认');
    setNotice({ status: 'consent-required', source: 'dashboard' });
  } else {
    const data = await chrome.storage.local.get(['codexUsage', 'codexUsageError']);
    render(data.codexUsage ?? null, data.codexUsageError ?? null);
    void refresh();
    startVisibleRefresh();
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[USER_DATA_CONSENT_KEY]) {
      userDataConsented = changes[USER_DATA_CONSENT_KEY].newValue ===
        USER_DATA_CONSENT_VERSION;
      if (!userDataConsented) {
        stopVisibleRefresh();
        render(null, null);
        setSyncState('stale', '等待用户确认');
        setNotice({ status: 'consent-required', source: 'dashboard' });
        return;
      }
      void refresh();
      startVisibleRefresh();
    }
    if (!userDataConsented) return;
    if (changes.codexUsage) latestUsage = changes.codexUsage.newValue ?? null;
    if (changes.codexUsageError) latestError = changes.codexUsageError.newValue ?? null;
    render(latestUsage, latestError);
  });
}

els.openAnalyticsBtn.addEventListener('click', () => {
  if (hasExtensionApi) {
    chrome.tabs.create({
      url: userDataConsented
        ? CODEX_ANALYTICS_URL
        : chrome.runtime.getURL('onboarding.html')
    });
  } else {
    window.open(CODEX_ANALYTICS_URL, '_blank', 'noopener');
  }
});

document.addEventListener('visibilitychange', () => {
  if (useDemoData) return;
  if (document.hidden) {
    stopVisibleRefresh();
    return;
  }
  void refresh();
  startVisibleRefresh();
});

/* ---------- fullscreen toggle ---------- */

const expandIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="15 3 21 3 21 9"></polyline>
  <polyline points="9 21 3 21 3 15"></polyline>
  <line x1="21" y1="3" x2="14" y2="10"></line>
  <line x1="3" y1="21" x2="10" y2="14"></line>
</svg>`;

const collapseIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="4 8 4 3 9 3"></polyline>
  <polyline points="20 16 20 21 15 21"></polyline>
  <line x1="4" y1="3" x2="11" y2="10"></line>
  <line x1="20" y1="21" x2="13" y2="14"></line>
</svg>`;

function updateFullscreenIcon(isFullscreen) {
  els.fullscreenBtn.innerHTML = isFullscreen ? collapseIcon : expandIcon;
  const label = isFullscreen ? '退出全屏' : '全屏显示';
  els.fullscreenBtn.title = label;
  els.fullscreenBtn.setAttribute('aria-label', label);
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    // Keep the control state aligned when fullscreen is unavailable.
  } finally {
    [0, 250, 750, 1500].forEach((delay) => {
      setTimeout(() => updateFullscreenIcon(Boolean(document.fullscreenElement)), delay);
    });
  }
}

els.fullscreenBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  updateFullscreenIcon(Boolean(document.fullscreenElement));
});

init();
