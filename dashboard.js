const SEGMENT_COUNT = 50;
const CODEX_ANALYTICS_URL = 'https://chatgpt.com/codex/cloud/settings/analytics';
const hasExtensionApi = typeof chrome !== 'undefined' &&
  chrome.storage?.local &&
  chrome.runtime?.sendMessage;
const useDemoData = new URLSearchParams(location.search).has('demo') || !hasExtensionApi;
const { remainingOf, formatClock, formatResetTime, formatWeeklyReset, formatUpdatedAt, createDemoUsage } = FormatUtils;

const els = {
  clock: document.getElementById('clock'),
  plan: document.getElementById('plan'),
  syncState: document.getElementById('sync-state'),
  syncLabel: document.getElementById('sync-label'),
  refreshBtn: document.getElementById('refresh-btn'),
  primaryValue: document.getElementById('primary-value'),
  primaryReset: document.getElementById('primary-reset'),
  primaryResetSuffix: document.getElementById('primary-reset-suffix'),
  primaryProgress: document.getElementById('primary-progress'),
  weeklyValue: document.getElementById('weekly-value'),
  weeklyReset: document.getElementById('weekly-reset'),
  weeklyProgress: document.getElementById('weekly-progress'),
  creditsValue: document.getElementById('credits-value'),
  lastUpdate: document.getElementById('last-update'),
  notice: document.getElementById('notice'),
  noticeTitle: document.getElementById('notice-title'),
  noticeCopy: document.getElementById('notice-copy'),
  openAnalyticsBtn: document.getElementById('open-analytics-btn'),
  fullscreenBtn: document.getElementById('fullscreen-btn')
};

let latestUsage = null;
let latestError = null;

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

function setSegmentedProgress(percent) {
  const filledCount = Math.round((percent / 100) * SEGMENT_COUNT);
  [...els.primaryProgress.children].forEach((segment, index) => {
    segment.classList.toggle('is-filled', index < filledCount);
    segment.classList.toggle('is-half', index === Math.floor(SEGMENT_COUNT / 2));
  });
  els.primaryProgress.setAttribute('aria-valuenow', String(percent));
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

function render(usage, error = null) {
  if (!usage) {
    setSyncState(error ? 'error' : 'stale', error ? '同步失败' : '等待数据');
    setNotice(error);
    return;
  }

  latestUsage = usage;
  latestError = error;
  const primary = CodexUsage.currentWindow(usage);
  const secondary = usage.secondaryWindow;
  const primaryRemaining = remainingOf(primary);
  const secondaryRemaining = secondary ? remainingOf(secondary) : null;
  const stale = CodexUsage.isUsageStale(usage);
  const blocked = usage.limitReached ||
    usage.overageLimitReached ||
    usage.spendLimitReached ||
    usage.allowed === false;

  const planName = usage.plan ? String(usage.plan).toUpperCase() : 'CHATGPT';
  els.plan.textContent = `CODEX · ${planName}`;
  els.primaryValue.textContent = String(primaryRemaining);
  const primaryResetTime = formatResetTime(primary?.resetAt);
  els.primaryReset.textContent = primaryResetTime;
  els.primaryResetSuffix.hidden = primaryResetTime === '--:--';
  setSegmentedProgress(primaryRemaining);

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

  els.lastUpdate.textContent = formatUpdatedAt(usage.ts, '等待首次同步');

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
    render(createDemoUsage());
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

function tick() {
  els.clock.textContent = formatClock();
  if (latestUsage) {
    const primaryResetTime = formatResetTime(CodexUsage.currentWindow(latestUsage)?.resetAt);
    els.primaryReset.textContent = primaryResetTime;
    els.primaryResetSuffix.hidden = primaryResetTime === '--:--';
    els.weeklyReset.textContent = latestUsage.secondaryWindow
      ? formatWeeklyReset(latestUsage.secondaryWindow.resetAt)
      : '未提供周额度';
    els.lastUpdate.textContent = formatUpdatedAt(latestUsage.ts, '等待首次同步');
  }
}

async function init() {
  buildSegments();
  tick();
  setInterval(tick, 1000);

  if (useDemoData) {
    render(createDemoUsage());
    return;
  }

  const data = await chrome.storage.local.get(['codexUsage', 'codexUsageError']);
  render(data.codexUsage ?? null, data.codexUsageError ?? null);
  refresh();

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
  if (!document.hidden && !useDemoData) refresh();
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
