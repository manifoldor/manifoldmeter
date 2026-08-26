/**
 * Same-origin bootstrap for Codex pages.
 *
 * It captures one snapshot when the page opens and when a hidden page becomes
 * visible after a cooldown. Periodic refreshes are owned by the service worker.
 */

const USAGE_PATH = '/backend-api/wham/usage';
const RESET_CREDITS_PATH = '/backend-api/wham/rate-limit-reset-credits';
const INITIAL_REFRESH_DELAY_MS = 1500;
const VISIBILITY_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const USER_DATA_CONSENT_KEY = 'codexUserDataConsent';
const USER_DATA_CONSENT_VERSION = '2026-08-01';

let inFlight = null;
let lastRefreshAt = 0;
const { normalizeUsage } = CodexUsage;

async function hasUserDataConsent() {
  const data = await chrome.storage.local.get(USER_DATA_CONSENT_KEY);
  return data[USER_DATA_CONSENT_KEY] === USER_DATA_CONSENT_VERSION;
}

function getAccessToken() {
  try {
    return getBootstrap()?.session?.accessToken || null;
  } catch {
    return null;
  }
}

function getBootstrap() {
  const el = document.getElementById('client-bootstrap');
  if (!el?.textContent) return null;
  return JSON.parse(el.textContent);
}

function getAccountId() {
  try {
    const bootstrap = getBootstrap();
    return bootstrap?.session?.accountId ||
      bootstrap?.session?.account_id ||
      bootstrap?.session?.account?.id ||
      bootstrap?.accountId ||
      bootstrap?.account_id ||
      bootstrap?.account?.id ||
      null;
  } catch {
    return null;
  }
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

async function requestBackgroundFallback() {
  try {
    await chrome.runtime.sendMessage({ type: 'FETCH_NOW' });
  } catch {
    // The service worker may be restarting; the next alarm will retry.
  }
}

async function runFetchAndStoreUsage() {
  lastRefreshAt = Date.now();
  try {
    if (!await hasUserDataConsent()) {
      return { ok: false, status: 'consent-required', source: 'content' };
    }

    const accessToken = getAccessToken();
    const accountId = getAccountId();
    if (accessToken) {
      await chrome.runtime.sendMessage({ type: 'CACHE_ACCESS_TOKEN', accessToken, accountId });
    }

    const headers = {
      accept: 'application/json',
      'oai-language': navigator.language || 'en-US'
    };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    if (accountId) headers['ChatGPT-Account-ID'] = accountId;

    const res = await fetchWithTimeout(USAGE_PATH, {
      cache: 'no-store',
      credentials: 'include',
      headers
    });

    if (!res.ok) {
      const source = accessToken ? 'content-token' : 'content-cookie';
      await chrome.storage.local.set({
        codexUsageError: { status: res.status, source, ts: Date.now() }
      });
      void requestBackgroundFallback();
      return { ok: false, status: res.status, source };
    }

    const data = await mergeResetCredits(await res.json(), headers);
    const codexUsage = normalizeUsage(data, { source: 'content' });
    if (!codexUsage) {
      await chrome.storage.local.set({
        codexUsageError: {
          status: 'invalid-response',
          source: 'content',
          ts: Date.now()
        }
      });
      return { ok: false, status: 'invalid-response', source: 'content' };
    }

    await chrome.storage.local.set({ codexUsage, codexUsageError: null });
    return { ok: true, source: 'content' };
  } catch (error) {
    const status = error?.name === 'AbortError' ? 'timeout' : 'exception';
    await chrome.storage.local.set({
      codexUsageError: { status, source: 'content', ts: Date.now() }
    });
    void requestBackgroundFallback();
    return { ok: false, status, source: 'content' };
  }
}

async function readResetCredits(headers) {
  try {
    const res = await fetchWithTimeout(RESET_CREDITS_PATH, {
      cache: 'no-store',
      credentials: 'include',
      headers: {
        ...headers,
        'OpenAI-Beta': 'codex-1',
        originator: 'Codex Desktop'
      }
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function mergeResetCredits(data, headers) {
  if (data?.rateLimitResetCredits || data?.rate_limit_reset_credits) return data;
  const resetCredits = await readResetCredits(headers);
  return resetCredits ? { ...data, rate_limit_reset_credits: resetCredits } : data;
}

function fetchAndStoreUsage() {
  if (inFlight) return inFlight;
  inFlight = runFetchAndStoreUsage().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

void hasUserDataConsent().then((consented) => {
  if (!consented) return;
  setTimeout(() => {
    void fetchAndStoreUsage();
  }, INITIAL_REFRESH_DELAY_MS);
});

document.addEventListener('visibilitychange', () => {
  const cooldownElapsed = Date.now() - lastRefreshAt >= VISIBILITY_REFRESH_COOLDOWN_MS;
  if (!document.hidden && cooldownElapsed) {
    void hasUserDataConsent().then((consented) => {
      if (consented) void fetchAndStoreUsage();
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'CAPTURE_USAGE_NOW') return false;

  fetchAndStoreUsage().then(sendResponse);
  return true;
});
