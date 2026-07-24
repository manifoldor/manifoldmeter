const SEGMENT_COUNT = 50;
const VISIBLE_REFRESH_MS = 60_000;
const CODEX_ANALYTICS_URL = 'https://chatgpt.com/codex/cloud/settings/analytics';
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

function createSurfaceDemoUsage() {
  const usage = createDemoUsage(demoNow);
  if (!searchParams.has('weekly-only') && !location.href.includes('weekly-only')) return usage;
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
  refreshBtn: document.getElementById('refresh-btn'),
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
  weeklyProgress: document.getElementById('weekly-progress'),
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

function buildSegments() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    const segment = document.createElement('span');
    segment.className = 'segment';
    segment.setAttribute('aria-hidden', 'true');
    fragment.appendChild(segment);
  }
  els.primaryProgress.appendChild(fragment);
}

function setResetCreditDots(count) {
  els.resetCreditsDots.replaceChildren();
  const visibleCount = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < visibleCount; index += 1) {
    const dot = document.createElement('span');
    dot.className = 'reset-credit-dot is-filled';
    dot.setAttribute('aria-hidden', 'true');
    fragment.appendChild(dot);
  }
  els.resetCreditsDots.appendChild(fragment);
}

function setSegmentedProgress(percent) {
  const normalizedPercent = Number.isFinite(Number(percent)) ? Number(percent) : 0;
  const filledCount = Math.round((normalizedPercent / 100) * SEGMENT_COUNT);
  [...els.primaryProgress.children].forEach((segment, index) => {
    segment.classList.toggle('is-filled', index < filledCount);
    segment.classList.toggle('is-half', index === Math.floor(SEGMENT_COUNT / 2));
  });
  els.primaryProgress.setAttribute('aria-valuenow', String(normalizedPercent));
}

function setSyncState(state, label) {
  els.syncState.dataset.state = state;
  els.syncLabel.textContent = label;
}

function setNotice(error, hasUsage = false) {
  const show = Boolean(error);
  els.notice.hidden = !show;
  if (!show) return;

  const status = String(error.status ?? 'unknown');
  if (status === '401' || status === '403') {
    els.noticeTitle.textContent = '登录状态已失效';
    els.noticeCopy.textContent = '打开 ChatGPT 用量页重新登录，再返回刷新。';
  } else if (status === 'invalid-response') {
    els.noticeTitle.textContent = '接口格式发生变化';
    els.noticeCopy.textContent = '扩展保留了最后一次成功数据，请稍后再试。';
  } else {
    els.noticeTitle.textContent = '暂时无法更新';
    els.noticeCopy.textContent = hasUsage
      ? '当前显示上次成功数据，请检查网络或登录状态。'
      : '请检查网络，并确认 Chrome 已登录 ChatGPT。';
  }
}

function describeWindow(windowData, fallback = '当前') {
  const seconds = Number(windowData?.limitWindowSeconds);
  if (seconds === 18000) return '5小时';
  if (seconds === 604800) return '本周';
  if (Number.isFinite(seconds) && seconds > 0) {
    if (seconds % 86400 === 0) return `${seconds / 86400}天`;
    if (seconds % 3600 === 0) return `${seconds / 3600}小时`;
  }
  return fallback;
}

function setPrimaryMetric(primary, usage) {
  const primaryRemaining = primary ? remainingOf(primary) : null;
  const hasPrimaryPercent = primaryRemaining !== null && primaryRemaining !== undefined;
  els.primaryTitle.textContent = primary ? describeWindow(primary) : '当前用量';
  els.primaryValue.textContent = hasPrimaryPercent ? String(primaryRemaining) : '—';
  els.primaryPercentSymbol.hidden = !hasPrimaryPercent;
  if (hasPrimaryPercent) {
    els.primaryRemainingLabel.textContent = '剩余';
  } else if (usage.mode === 'credits') {
    els.primaryRemainingLabel.textContent = '按 Credits';
  } else {
    els.primaryRemainingLabel.textContent = '动态限额';
  }

  const primaryResetTime = formatResetTime(primary?.resetAt);
  els.primaryReset.textContent = primaryResetTime;
  els.primaryResetSuffix.hidden = !primary || primaryResetTime === '--:--';
  setSegmentedProgress(hasPrimaryPercent ? primaryRemaining : 0);
  els.primaryProgress.setAttribute(
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
  els.resetCredits.hidden = !hasCount;
  if (!hasCount) {
    els.resetCreditsValue.textContent = '';
    setResetCreditDots(0);
    els.resetCreditsDots.setAttribute('aria-valuenow', '0');
    els.resetCreditsDots.setAttribute('aria-valuemax', '1');
    els.resetCreditsDots.setAttribute('aria-valuetext', '');
    return;
  }

  els.resetCredits.dataset.level = hasCount && displayCount > 0 && displayCount <= 3
    ? 'low'
    : 'normal';
  els.resetCreditsValue.textContent = overflow ? '10+次' : `${displayCount}次`;
  setResetCreditDots(displayCount);
  els.resetCreditsDots.setAttribute('aria-valuenow', String(displayCount));
  els.resetCreditsDots.setAttribute('aria-valuemax', String(Math.max(displayCount, 1)));
  els.resetCreditsDots.setAttribute(
    'aria-valuetext',
    `可用重置次数 ${displayCount} 次`
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
  els.plan.textContent = `CODEX · ${planName}`;
  renderResetCredits(usage.resetCredits);
  els.content.classList.toggle('is-weekly-only', !primary && Boolean(secondary));
  els.primaryMetric.hidden = !primary;
  if (primary) setPrimaryMetric(primary, usage);

  els.weeklyValue.textContent = secondaryRemaining === null ? '—' : String(secondaryRemaining);
  els.weeklyReset.textContent = secondary
    ? formatWeeklyReset(secondary.resetAt)
    : '未提供周额度';
  els.weeklyProgress.style.width = `${secondaryRemaining ?? 0}%`;
  els.weeklyProgress.parentElement.setAttribute('aria-valuenow', String(secondaryRemaining ?? 0));
  els.weeklyProgress.parentElement.setAttribute(
    'aria-valuetext',
    secondaryRemaining === null ? '未提供周额度' : `剩余 ${secondaryRemaining}%`
  );

  if (usage.creditsUnlimited) {
    els.creditsValue.textContent = '∞';
  } else if (usage.creditsBalance !== null && usage.creditsBalance !== undefined) {
    els.creditsValue.textContent = new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: 2
    }).format(usage.creditsBalance);
  } else {
    els.creditsValue.textContent = '—';
  }

  els.lastUpdate.textContent = formatUpdatedAt(
    usage.ts,
    '等待首次同步',
    useDemoData && demoNow ? demoNow : undefined
  );

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

  els.refreshBtn.disabled = true;
  setSyncState('stale', '正在同步');
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
  } finally {
    els.refreshBtn.disabled = false;
  }
}

function stopVisibleRefresh() {
  if (!visibleRefreshTimer) return;
  clearInterval(visibleRefreshTimer);
  visibleRefreshTimer = null;
}

function startVisibleRefresh() {
  if (useDemoData || document.hidden || visibleRefreshTimer) return;
  visibleRefreshTimer = setInterval(() => {
    if (!document.hidden) void refresh();
  }, VISIBLE_REFRESH_MS);
}

function tick() {
  els.clock.textContent = formatClock(
    useDemoData && demoNow ? new Date(demoNow) : undefined
  );
  if (latestUsage) {
    const current = CodexUsage.currentWindow(latestUsage);
    const weekly = CodexUsage.weeklyWindow(latestUsage);
    els.content.classList.toggle('is-weekly-only', !current && Boolean(weekly));
    els.primaryMetric.hidden = !current;
    if (current) setPrimaryMetric(current, latestUsage);
    els.weeklyReset.textContent = weekly
      ? formatWeeklyReset(weekly.resetAt)
      : '未提供周额度';
    els.lastUpdate.textContent = formatUpdatedAt(
      latestUsage.ts,
      '等待首次同步',
      useDemoData && demoNow ? demoNow : undefined
    );
  }
}

async function init() {
  buildSegments();
  tick();
  setInterval(tick, 1000);

  if (useDemoData) {
    render(createDemoUsage(demoNow));
    return;
  }

  const data = await chrome.storage.local.get(['codexUsage', 'codexUsageError']);
  render(data.codexUsage ?? null, data.codexUsageError ?? null);
  void refresh();
  startVisibleRefresh();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.codexUsage) latestUsage = changes.codexUsage.newValue ?? null;
    if (changes.codexUsageError) latestError = changes.codexUsageError.newValue ?? null;
    render(latestUsage, latestError);
  });
}

els.refreshBtn.addEventListener('click', refresh);
els.openAnalyticsBtn.addEventListener('click', () => {
  if (hasExtensionApi) {
    chrome.tabs.create({ url: CODEX_ANALYTICS_URL });
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
  els.fullscreenBtn.title = isFullscreen ? '退出全屏' : '全屏显示';
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    updateFullscreenIcon(Boolean(document.fullscreenElement));
  }
}

els.fullscreenBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  updateFullscreenIcon(Boolean(document.fullscreenElement));
});

init();
