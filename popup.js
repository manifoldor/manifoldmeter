const CODEX_ANALYTICS_URL = 'https://chatgpt.com/codex/cloud/settings/analytics';
const hasExtensionApi = typeof chrome !== 'undefined' &&
  chrome.storage?.local &&
  chrome.runtime?.sendMessage;

const {
  remainingOf,
  formatResetTime,
  formatWeeklyReset,
  formatUpdatedAt,
  parseDemoNow,
  createDemoUsage
} = FormatUtils;
const demoNow = parseDemoNow(new URLSearchParams(location.search).get('demo-now'));

const elements = {
  dataSection: document.getElementById('data-section'),
  emptySection: document.getElementById('empty-section'),
  emptyTitle: document.getElementById('empty-title'),
  emptyCopy: document.getElementById('empty-copy'),
  plan: document.getElementById('plan'),
  primaryValue: document.getElementById('primary-value'),
  primaryReset: document.getElementById('primary-reset'),
  primaryTrack: document.getElementById('primary-track'),
  primaryProgress: document.getElementById('primary-progress'),
  weeklyValue: document.getElementById('weekly-value'),
  weeklyReset: document.getElementById('weekly-reset'),
  weeklyTrack: document.getElementById('weekly-track'),
  weeklyProgress: document.getElementById('weekly-progress'),
  creditsValue: document.getElementById('credits-value'),
  statusRow: document.querySelector('.status-row'),
  syncLabel: document.getElementById('sync-label'),
  lastUpdate: document.getElementById('last-update'),
  dashboardButton: document.getElementById('dashboard-btn'),
  refreshButton: document.getElementById('refresh-btn'),
  analyticsButton: document.getElementById('analytics-btn')
};

let latestUsage = null;
let latestError = null;

function setProgress(track, bar, percent) {
  bar.style.width = `${percent}%`;
  track.setAttribute('aria-valuenow', String(percent));
}

function renderEmpty(error = null) {
  elements.dataSection.hidden = true;
  elements.emptySection.hidden = false;

  const status = String(error?.status ?? '');
  if (status === '401' || status === '403') {
    elements.emptyTitle.textContent = '登录状态已失效';
    elements.emptyCopy.textContent = '请打开 ChatGPT 重新登录，然后返回刷新。';
  } else if (error) {
    elements.emptyTitle.textContent = '暂时无法读取额度';
    elements.emptyCopy.textContent = '请检查网络，并确认 Chrome 已登录 ChatGPT。';
  } else {
    elements.emptyTitle.textContent = '等待用量数据';
    elements.emptyCopy.textContent = '请确认 Chrome 已登录 ChatGPT，然后刷新一次。';
  }
}

function render(usage, error = null) {
  if (!usage) {
    renderEmpty();
    return;
  }

  latestUsage = usage;
  latestError = error;
  elements.dataSection.hidden = false;
  elements.emptySection.hidden = true;

  const primary = CodexUsage.currentWindow(usage);
  const weekly = CodexUsage.weeklyWindow(usage);
  const primaryRemaining = remainingOf(primary);
  const weeklyRemaining = weekly ? remainingOf(weekly) : null;
  const planName = usage.plan ? String(usage.plan).toUpperCase() : 'CHATGPT';

  elements.plan.textContent = `CODEX · ${planName}`;
  elements.primaryValue.textContent = String(primaryRemaining);
  const primaryResetTime = formatResetTime(primary?.resetAt);
  elements.primaryReset.textContent = primaryResetTime === '--:--'
    ? '重置时间未知'
    : `${primaryResetTime} 重置`;
  setProgress(elements.primaryTrack, elements.primaryProgress, primaryRemaining);

  elements.weeklyValue.textContent = weeklyRemaining === null ? '—' : String(weeklyRemaining);
  elements.weeklyReset.textContent = weekly
    ? formatWeeklyReset(weekly.resetAt)
    : '未提供周额度';
  setProgress(elements.weeklyTrack, elements.weeklyProgress, weeklyRemaining ?? 0);
  elements.weeklyTrack.setAttribute(
    'aria-valuetext',
    weeklyRemaining === null ? '未提供周额度' : `剩余 ${weeklyRemaining}%`
  );
  if (usage.creditsUnlimited) {
    elements.creditsValue.textContent = '∞';
  } else if (usage.creditsBalance !== null && usage.creditsBalance !== undefined) {
    elements.creditsValue.textContent = new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: 2
    }).format(usage.creditsBalance);
  } else {
    elements.creditsValue.textContent = '—';
  }

  elements.lastUpdate.textContent = formatUpdatedAt(
    usage.ts,
    '等待同步',
    !hasExtensionApi && demoNow ? demoNow : undefined
  );

  const blocked = usage.limitReached ||
    usage.overageLimitReached ||
    usage.spendLimitReached ||
    usage.allowed === false;
  const stale = CodexUsage.isUsageStale(
    usage,
    !hasExtensionApi && demoNow ? demoNow : Date.now()
  );

  if (blocked) {
    elements.statusRow.dataset.state = 'error';
    elements.syncLabel.textContent = '额度已用尽';
  } else if (error) {
    elements.statusRow.dataset.state = 'error';
    elements.syncLabel.textContent = '更新失败 · 显示上次数据';
  } else if (stale) {
    elements.statusRow.dataset.state = 'stale';
    elements.syncLabel.textContent = '数据已过期';
  } else {
    elements.statusRow.dataset.state = 'ok';
    elements.syncLabel.textContent = '同步正常';
  }
}

async function refresh() {
  if (!hasExtensionApi) {
    render(createDemoUsage(demoNow));
    return;
  }

  elements.refreshButton.disabled = true;
  elements.syncLabel.textContent = '正在同步';

  try {
    const result = await chrome.runtime.sendMessage({ type: 'FETCH_NOW', force: true });
    if (!result?.ok) {
      if (!latestUsage) renderEmpty(result);
      else {
        elements.statusRow.dataset.state = 'error';
        elements.syncLabel.textContent = '同步失败';
      }
      return;
    }

    const data = await chrome.storage.local.get(['codexUsage', 'codexUsageError']);
    if (data.codexUsage) render(data.codexUsage, data.codexUsageError ?? null);
    else renderEmpty(data.codexUsageError ?? null);
  } catch {
    latestError = { status: 'exception', source: 'popup' };
    if (!latestUsage) {
      renderEmpty(latestError);
    } else {
      render(latestUsage, latestError);
    }
  } finally {
    elements.refreshButton.disabled = false;
  }
}

elements.dashboardButton.addEventListener('click', () => {
  if (hasExtensionApi) {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
});

elements.analyticsButton.addEventListener('click', () => {
  if (hasExtensionApi) {
    chrome.tabs.create({ url: CODEX_ANALYTICS_URL });
  } else {
    window.open(CODEX_ANALYTICS_URL, '_blank', 'noopener');
  }
});

elements.refreshButton.addEventListener('click', refresh);

if (hasExtensionApi) {
  chrome.storage.local.get(['codexUsage', 'codexUsageError'], (data) => {
    if (data.codexUsage) render(data.codexUsage, data.codexUsageError ?? null);
    else renderEmpty(data.codexUsageError ?? null);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.codexUsage) latestUsage = changes.codexUsage.newValue ?? null;
    if (changes.codexUsageError) latestError = changes.codexUsageError.newValue ?? null;
    if (latestUsage) render(latestUsage, latestError);
    else renderEmpty(latestError);
  });
} else {
  render(createDemoUsage(demoNow));
}

setInterval(() => {
  if (!latestUsage) return;
  render(latestUsage, latestError);
}, 1000);
