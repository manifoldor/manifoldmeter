importScripts('usage.js');

/**
 * Service worker for Manifold Meter.
 *
 * All network refreshes are coordinated here. The content script may provide a
 * short-lived access token and a same-origin snapshot, but alarms and UI
 * refreshes share one in-flight request to avoid duplicate calls.
 */

const ALARM = 'codex-usage-poll';
const POLL_MINUTES = 10;
const FETCH_TIMEOUT_MS = 15_000;
const USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const RESET_CREDITS_URL = 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits';
const ACCESS_TOKEN_KEY = 'codexAccessToken';
const ACCESS_TOKEN_EXP_KEY = 'codexAccessTokenExpiresAt';
const ACCOUNT_ID_KEY = 'codexAccountId';
const USER_DATA_CONSENT_KEY = 'codexUserDataConsent';
const USER_DATA_CONSENT_VERSION = '2026-08-01';
const ACCESS_TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;
const CONTENT_AUTHORITY_MS = 2 * 60 * 1000;
const AUTH_SESSION_URLS = [
  'https://chatgpt.com/api/auth/session',
  'https://chatgpt.com/backend-api/auth/session'
];

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;
let cachedAccountId = null;
let fetchInFlight = null;
const { normalizeUsage, weeklyWindow } = CodexUsage;

async function hasUserDataConsent() {
  const data = await chrome.storage.local.get(USER_DATA_CONSENT_KEY);
  return data[USER_DATA_CONSENT_KEY] === USER_DATA_CONSENT_VERSION;
}

async function storeUsageError(status, source) {
  await chrome.storage.local.set({
    codexUsageError: {
      status,
      source,
      ts: Date.now()
    }
  });
}

function decodeAccessTokenExpiresAt(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const data = JSON.parse(atob(padded));
    return Number(data?.exp) ? Number(data.exp) * 1000 : 0;
  } catch {
    return 0;
  }
}

function isTokenUsable(token, expiresAt = 0) {
  if (!token) return false;
  return !expiresAt || expiresAt - Date.now() > ACCESS_TOKEN_REFRESH_SKEW_MS;
}

function isValidAccessToken(token) {
  return typeof token === 'string' && token.length >= 16 && token.length <= 16_384;
}

async function cacheAccessToken(token) {
  if (!isValidAccessToken(token)) return false;
  cachedAccessToken = token;
  cachedAccessTokenExpiresAt = decodeAccessTokenExpiresAt(token);
  await chrome.storage.session?.set?.({
    [ACCESS_TOKEN_KEY]: token,
    [ACCESS_TOKEN_EXP_KEY]: cachedAccessTokenExpiresAt
  });
  return true;
}

function isValidAccountId(accountId) {
  return typeof accountId === 'string' && accountId.length >= 3 && accountId.length <= 512;
}

async function cacheAccountId(accountId) {
  if (!isValidAccountId(accountId)) return false;
  cachedAccountId = accountId;
  await chrome.storage.session?.set?.({ [ACCOUNT_ID_KEY]: accountId });
  return true;
}

async function clearAccessToken() {
  cachedAccessToken = null;
  cachedAccessTokenExpiresAt = 0;
  cachedAccountId = null;
  await chrome.storage.session?.remove?.([ACCESS_TOKEN_KEY, ACCESS_TOKEN_EXP_KEY, ACCOUNT_ID_KEY]);
}

function extractAccessToken(data) {
  return data?.accessToken ||
    data?.access_token ||
    data?.session?.accessToken ||
    data?.session?.access_token ||
    data?.token ||
    null;
}

function extractAccountId(data) {
  return data?.account_id ||
    data?.accountId ||
    data?.session?.account_id ||
    data?.session?.accountId ||
    data?.session?.account?.id ||
    data?.account?.id ||
    data?.user?.account_id ||
    data?.user?.accountId ||
    null;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshAccessTokenFromSession() {
  for (const url of AUTH_SESSION_URLS) {
    try {
      const res = await fetchWithTimeout(url, {
        credentials: 'include',
        headers: { accept: 'application/json' }
      });
      if (!res.ok) continue;

      const data = await res.json();
      const token = extractAccessToken(data);
      await cacheAccountId(extractAccountId(data));
      if (await cacheAccessToken(token)) return token;
    } catch {
      // Try the next known session endpoint.
    }
  }

  return null;
}

async function getAccessToken() {
  if (isTokenUsable(cachedAccessToken, cachedAccessTokenExpiresAt)) return cachedAccessToken;

  try {
    const data = await chrome.storage.session?.get?.([
      ACCESS_TOKEN_KEY,
      ACCESS_TOKEN_EXP_KEY,
      ACCOUNT_ID_KEY
    ]);
    cachedAccessToken = data?.[ACCESS_TOKEN_KEY] || null;
    cachedAccountId = data?.[ACCOUNT_ID_KEY] || null;
    cachedAccessTokenExpiresAt = Number(data?.[ACCESS_TOKEN_EXP_KEY]) ||
      decodeAccessTokenExpiresAt(cachedAccessToken || '');
    if (isTokenUsable(cachedAccessToken, cachedAccessTokenExpiresAt)) return cachedAccessToken;
  } catch {
    // Fall through to web session refresh.
  }

  await clearAccessToken();
  return refreshAccessTokenFromSession();
}

function buildUsageHeaders(accessToken, accountId = cachedAccountId) {
  const headers = {
    accept: 'application/json',
    'oai-language': chrome.i18n.getUILanguage?.() || 'en-US'
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (accountId) headers['ChatGPT-Account-ID'] = accountId;
  return headers;
}

function buildResetCreditsHeaders(accessToken, accountId = cachedAccountId) {
  return {
    ...buildUsageHeaders(accessToken, accountId),
    'OpenAI-Beta': 'codex-1',
    originator: 'Codex Desktop'
  };
}

async function requestUsage(accessToken) {
  return fetchWithTimeout(USAGE_URL, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildUsageHeaders(accessToken)
  });
}

async function requestResetCredits(accessToken) {
  return fetchWithTimeout(RESET_CREDITS_URL, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildResetCreditsHeaders(accessToken)
  });
}

async function readResetCredits(accessToken) {
  try {
    const res = await requestResetCredits(accessToken);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function mergeResetCredits(data, accessToken) {
  if (data?.rateLimitResetCredits || data?.rate_limit_reset_credits) return data;
  const resetCredits = await readResetCredits(accessToken);
  return resetCredits ? { ...data, rate_limit_reset_credits: resetCredits } : data;
}

async function shouldUseRecentContentSnapshot(force) {
  if (force) return false;
  const existing = await chrome.storage.local.get(['codexUsage', 'codexUsageError']);
  const contentRecent = existing.codexUsage?.source === 'content' &&
    Date.now() - existing.codexUsage.ts < CONTENT_AUTHORITY_MS;
  const contentErrored = existing.codexUsageError?.source?.startsWith?.('content') &&
    Date.now() - existing.codexUsageError.ts < CONTENT_AUTHORITY_MS;
  return contentRecent && !contentErrored;
}

async function runFetchUsage({ force = false } = {}) {
  try {
    if (!await hasUserDataConsent()) {
      return { ok: false, status: 'consent-required', source: 'background' };
    }

    if (await shouldUseRecentContentSnapshot(force)) {
      return { ok: true, source: 'content-recent' };
    }

    let currentAccessToken = await getAccessToken();
    let res = await requestUsage(currentAccessToken);

    if ((res.status === 401 || res.status === 403) && currentAccessToken) {
      await clearAccessToken();
      currentAccessToken = await getAccessToken();
      if (currentAccessToken) {
        res = await requestUsage(currentAccessToken);
        if (!res.ok) {
          await storeUsageError(res.status, 'background-retry');
          return { ok: false, status: res.status, source: 'background-retry' };
        }
      }
    }

    if (!res.ok) {
      const source = currentAccessToken ? 'background-token' : 'background-cookie';
      await storeUsageError(res.status, source);
      return { ok: false, status: res.status, source };
    }

    const data = await mergeResetCredits(await res.json(), currentAccessToken);
    const codexUsage = normalizeUsage(data, { source: 'background' });
    if (!codexUsage) {
      await storeUsageError('invalid-response', 'background');
      return { ok: false, status: 'invalid-response', source: 'background' };
    }

    await chrome.storage.local.set({ codexUsage, codexUsageError: null });
    return { ok: true, source: 'background' };
  } catch (error) {
    const status = error?.name === 'AbortError' ? 'timeout' : 'exception';
    await storeUsageError(status, 'background');
    return { ok: false, status, source: 'background' };
  }
}

function fetchUsage(options = {}) {
  if (fetchInFlight) return fetchInFlight;
  fetchInFlight = runFetchUsage(options).finally(() => {
    fetchInFlight = null;
  });
  return fetchInFlight;
}

chrome.alarms.create(ALARM, { periodInMinutes: POLL_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void fetchUsage();
});

async function restoreAndRefresh() {
  if (!await hasUserDataConsent()) {
    updateBadge(null);
    return;
  }
  const { codexUsage } = await chrome.storage.local.get('codexUsage');
  updateBadge(codexUsage);
  await fetchUsage();
}

chrome.runtime.onStartup.addListener(() => {
  void restoreAndRefresh();
});
chrome.runtime.onInstalled.addListener((details) => {
  void restoreAndRefresh();
  void hasUserDataConsent().then((consented) => {
    if (details.reason === 'install' || !consented) {
      void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
    }
  });
});

function remainingPercent(windowData) {
  if (!windowData) return null;
  const explicitRemaining = Number(windowData.remainingPercent);
  if (Number.isFinite(explicitRemaining)) {
    return Math.min(100, Math.max(0, Math.round(explicitRemaining)));
  }
  const used = Number(windowData.usedPercent);
  if (!Number.isFinite(used)) return null;
  return Math.min(100, Math.max(0, 100 - Math.round(used)));
}

function buildTitle(usage) {
  const primaryWindow = usage?.primaryWindow || usage;
  const primaryRemaining = remainingPercent(primaryWindow);
  if (primaryRemaining === null) {
    if (usage?.creditsUnlimited) return '剩余积分: 不限量';
    if (usage?.creditsBalance !== null && usage?.creditsBalance !== undefined) {
      return `剩余积分: ${usage.creditsBalance}`;
    }
    return 'Manifold Meter';
  }
  const windowSeconds = Number(primaryWindow?.limitWindowSeconds);
  const primaryLabel = windowSeconds === 18000 ? '5小时额度' : '当前额度';
  const sessionSummary = `${primaryLabel}剩余: ${primaryRemaining}%`;
  const weeklyRemaining = remainingPercent(weeklyWindow(usage));

  if (weeklyRemaining === null) return sessionSummary;
  return `${sessionSummary} • 本周额度剩余: ${weeklyRemaining}%`;
}

function updateBadge(usage) {
  const remaining = remainingPercent(usage?.primaryWindow || usage);
  if (remaining === null) {
    void chrome.action.setBadgeText({ text: '' });
    void chrome.action.setTitle({ title: 'Manifold Meter' });
    return;
  }

  void chrome.action.setBadgeText({ text: `${remaining}%` });
  void chrome.action.setBadgeBackgroundColor({
    color: remaining <= 10 ? '#ef4444' : remaining <= 30 ? '#f59e0b' : '#22c55e'
  });
  void chrome.action.setTitle({ title: buildTitle(usage) });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.codexUsage) updateBadge(changes.codexUsage.newValue);
});

function isTrustedContentSender(sender) {
  return sender.id === chrome.runtime.id &&
    typeof sender.url === 'string' &&
    sender.url.startsWith('https://chatgpt.com/codex/');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'CACHE_ACCESS_TOKEN') {
    if (!isTrustedContentSender(sender)) {
      sendResponse({ ok: false, status: 'forbidden' });
      return false;
    }
    hasUserDataConsent().then((consented) => {
      if (!consented) {
        sendResponse({ ok: false, status: 'consent-required' });
        return;
      }
      Promise.all([
        cacheAccessToken(msg.accessToken),
        cacheAccountId(msg.accountId)
      ]).then(([tokenOk]) => sendResponse({ ok: tokenOk }));
    });
    return true;
  }

  if (msg?.type !== 'FETCH_NOW' || sender.id !== chrome.runtime.id) return false;

  fetchUsage({ force: msg.force === true }).then(sendResponse);
  return true;
});
