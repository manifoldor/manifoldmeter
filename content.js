/**
 * Same-origin bootstrap for Codex pages.
 *
 * It captures one snapshot when the page opens and when a hidden page becomes
 * visible after a cooldown. Periodic refreshes are owned by the service worker.
 */

const USAGE_PATH = '/backend-api/wham/usage';
const INITIAL_REFRESH_DELAY_MS = 1500;
const VISIBILITY_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

let inFlight = null;
let lastRefreshAt = 0;
const { normalizeUsage } = CodexUsage;

function getAccessToken() {
  try {
    const el = document.getElementById('client-bootstrap');
    if (!el?.textContent) return null;
    const bootstrap = JSON.parse(el.textContent);
    return bootstrap?.session?.accessToken || null;
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
    const accessToken = getAccessToken();
    if (accessToken) {
      await chrome.runtime.sendMessage({ type: 'CACHE_ACCESS_TOKEN', accessToken });
    }

    const headers = {
      accept: 'application/json',
      'oai-language': navigator.language || 'en-US'
    };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;

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

    const data = await res.json();
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

function fetchAndStoreUsage() {
  if (inFlight) return inFlight;
  inFlight = runFetchAndStoreUsage().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

setTimeout(() => {
  void fetchAndStoreUsage();
}, INITIAL_REFRESH_DELAY_MS);

document.addEventListener('visibilitychange', () => {
  const cooldownElapsed = Date.now() - lastRefreshAt >= VISIBILITY_REFRESH_COOLDOWN_MS;
  if (!document.hidden && cooldownElapsed) void fetchAndStoreUsage();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'CAPTURE_USAGE_NOW') return false;

  fetchAndStoreUsage().then(sendResponse);
  return true;
});
