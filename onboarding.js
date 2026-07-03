const CODEX_ANALYTICS_URL = 'https://chatgpt.com/codex/cloud/settings/analytics';

document.getElementById('open-dashboard-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

document.getElementById('open-analytics-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: CODEX_ANALYTICS_URL });
});
