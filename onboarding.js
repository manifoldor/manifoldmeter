const CODEX_ANALYTICS_URL = 'https://chatgpt.com/codex/cloud/settings/analytics';
const USER_DATA_CONSENT_KEY = 'codexUserDataConsent';
const USER_DATA_CONSENT_VERSION = '2026-08-01';
const hasExtensionApi = typeof chrome !== 'undefined' &&
  chrome.storage?.local &&
  chrome.tabs?.create &&
  chrome.runtime?.getURL;
const searchParams = new URLSearchParams(location.search);

const elements = {
  eyebrow: document.getElementById('hero-eyebrow'),
  connectionState: document.getElementById('connection-state'),
  actions: document.querySelector('.hero-actions'),
  dashboardButton: document.getElementById('open-dashboard-btn'),
  analyticsButton: document.getElementById('open-analytics-btn')
};

function openUrl(url) {
  if (hasExtensionApi) {
    chrome.tabs.create({ url });
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function setButtonStyle(button, primary) {
  button.classList.toggle('primary-button', primary);
  button.classList.toggle('text-button', !primary);
}

function renderConnectionState(usage = null, error = null) {
  const connected = Boolean(usage);
  const failed = !connected && Boolean(error);

  document.body.dataset.connectionState = connected
    ? 'connected'
    : failed
      ? 'error'
      : 'pending';

  if (connected) {
    elements.eyebrow.textContent = '同步成功';
    elements.connectionState.textContent = 'Codex 数据已连接，可以打开副屏仪表盘。';
    elements.dashboardButton.textContent = '打开副屏仪表盘';
    elements.analyticsButton.textContent = '查看 Codex 数据';
    setButtonStyle(elements.dashboardButton, true);
    setButtonStyle(elements.analyticsButton, false);
    elements.actions.replaceChildren(elements.dashboardButton, elements.analyticsButton);
    return;
  }

  elements.eyebrow.textContent = failed ? '等待重新连接' : '安装完成';
  elements.connectionState.textContent = failed
    ? '暂未同步成功，请确认登录状态；扩展会自动重试。'
    : '先连接 Codex 数据，扩展会在本机完成首次同步。';
  elements.analyticsButton.textContent = '同意并连接 Codex 数据';
  elements.dashboardButton.textContent = '先预览副屏';
  setButtonStyle(elements.analyticsButton, true);
  setButtonStyle(elements.dashboardButton, false);
  elements.actions.replaceChildren(elements.analyticsButton, elements.dashboardButton);
}

elements.dashboardButton.addEventListener('click', () => {
  const dashboardUrl = hasExtensionApi
    ? chrome.runtime.getURL('dashboard.html')
    : 'dashboard.html?demo=1';
  openUrl(dashboardUrl);
});

elements.analyticsButton.addEventListener('click', async () => {
  if (hasExtensionApi) {
    await chrome.storage.local.set({
      [USER_DATA_CONSENT_KEY]: USER_DATA_CONSENT_VERSION
    });
    void chrome.runtime.sendMessage({ type: 'FETCH_NOW', force: true });
  }
  openUrl(CODEX_ANALYTICS_URL);
});

if (hasExtensionApi) {
  chrome.storage.local.get(USER_DATA_CONSENT_KEY, (data) => {
    const consented = data[USER_DATA_CONSENT_KEY] === USER_DATA_CONSENT_VERSION;
    if (!consented) {
      renderConnectionState();
      return;
    }
    chrome.storage.local.get(['codexUsage', 'codexUsageError'], (usageData) => {
      renderConnectionState(
        usageData.codexUsage ?? null,
        usageData.codexUsageError ?? null
      );
    });
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.codexUsage && !changes.codexUsageError) return;
    chrome.storage.local.get(USER_DATA_CONSENT_KEY, (consentData) => {
      if (consentData[USER_DATA_CONSENT_KEY] !== USER_DATA_CONSENT_VERSION) return;
      chrome.storage.local.get(['codexUsage', 'codexUsageError'], (data) => {
        renderConnectionState(data.codexUsage ?? null, data.codexUsageError ?? null);
      });
    });
  });
} else {
  renderConnectionState(searchParams.has('connected') ? { demo: true } : null);
}
