const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { describe, it } = require('node:test');
const vm = require('node:vm');

function createBackgroundHarness() {
  const localState = {};
  const sessionState = {};
  const messageListeners = [];
  const fetchUrls = [];
  const event = () => ({ addListener() {} });

  const context = {
    AbortController,
    URL,
    atob,
    clearTimeout,
    console,
    fetch: async (url) => {
      fetchUrls.push(url);
      if (url.includes('/auth/session')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'abcdefghijklmnop',
            accountId: 'account-review-test'
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ rateLimitResetCredits: { available_count: 0 } })
      };
    },
    importScripts() {
      context.CodexUsage = {
        normalizeUsage: () => ({ remainingPercent: 50, ts: Date.now() }),
        weeklyWindow: () => null
      };
    },
    setTimeout,
    chrome: {
      action: {
        setBadgeBackgroundColor: async () => {},
        setBadgeText: async () => {},
        setTitle: async () => {}
      },
      alarms: { create() {}, onAlarm: event() },
      i18n: { getUILanguage: () => 'zh-CN' },
      runtime: {
        id: 'manifold-meter-test',
        getURL: (path) => `chrome-extension://manifold-meter-test/${path}`,
        onInstalled: event(),
        onMessage: {
          addListener(listener) {
            messageListeners.push(listener);
          }
        },
        onStartup: event()
      },
      storage: {
        local: {
          async get(keys) {
            const list = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(
              list.filter((key) => key in localState).map((key) => [key, localState[key]])
            );
          },
          async set(values) {
            Object.assign(localState, values);
          }
        },
        onChanged: event(),
        session: {
          async get(keys) {
            const list = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(
              list.filter((key) => key in sessionState).map((key) => [key, sessionState[key]])
            );
          },
          async remove(keys) {
            for (const key of keys) delete sessionState[key];
          },
          async set(values) {
            Object.assign(sessionState, values);
          }
        }
      },
      tabs: { create: async () => {} }
    }
  };

  vm.runInNewContext(readFileSync('background.js', 'utf8'), context);

  async function sendFetchNow() {
    return new Promise((resolve, reject) => {
      const handled = messageListeners[0](
        { type: 'FETCH_NOW', force: true },
        { id: context.chrome.runtime.id },
        resolve
      );
      if (!handled) reject(new Error('FETCH_NOW message was not handled'));
    });
  }

  return { fetchUrls, localState, sendFetchNow, sessionState };
}

describe('user data consent gate', () => {
  it('does not request ChatGPT before explicit consent', async () => {
    const harness = createBackgroundHarness();
    const result = await harness.sendFetchNow();

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 'consent-required');
    assert.deepStrictEqual(harness.fetchUrls, []);
    assert.deepStrictEqual(harness.sessionState, {});
  });

  it('allows the disclosed sync after consent', async () => {
    const harness = createBackgroundHarness();
    harness.localState.codexUserDataConsent = '2026-08-01';

    const result = await harness.sendFetchNow();

    assert.strictEqual(result.ok, true);
    assert.ok(harness.fetchUrls.some((url) => url.includes('/auth/session')));
    assert.ok(harness.fetchUrls.some((url) => url.includes('/backend-api/wham/usage')));
    assert.strictEqual(harness.sessionState.codexAccountId, 'account-review-test');
  });

  it('keeps disclosure ahead of the explicit consent action', () => {
    const html = readFileSync('onboarding.html', 'utf8');
    const disclosureIndex = html.indexOf('连接后，扩展会从');
    const actionIndex = html.indexOf('同意并连接 Codex 数据');

    assert.ok(disclosureIndex >= 0);
    assert.ok(actionIndex > disclosureIndex);
    assert.ok(html.includes('https://manifoldor.github.io/manifoldmeter/privacy.html'));
  });
});
