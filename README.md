# Manifold Meter

> Many models. One meter.

Manifold Meter is a local-first Chrome extension for ambient AI usage monitoring. The current release supports Codex usage from a signed-in ChatGPT session and presents it in two coordinated surfaces:

- a compact toolbar popup
- an always-on dashboard designed for a 1136 × 640 secondary display

## Features

- Current 5-hour window and weekly allowance
- Remaining percentage, current-window reset time, and weekly reset date
- Optional credit balance
- Toolbar badge with usage severity
- Credit balance in both the popup and dashboard when available
- Coordinated background refresh every 10 minutes
- Request timeout, refresh de-duplication, and explicit stale/error states
- Manual refresh and stale-data states
- Dedicated low-luminance secondary-display dashboard
- No Manifold account, telemetry, or remote storage

## Installation

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `manifold-meter` folder.
5. Open the Codex usage page once while signed in to ChatGPT.
6. Open the extension popup and choose **打开副屏**.

## How it works

Manifold Meter reads Codex quota metadata from the usage endpoint used by ChatGPT, authenticated through the browser session that already exists on `chatgpt.com`.

The extension stores normalized quota metadata in `chrome.storage.local`. A
short-lived access token may be held only in Chrome's in-memory
`storage.session`; it is cleared when the browser restarts or the extension is
reloaded. Email addresses, account IDs, cookies, session tokens, and chat
content are not stored.

| Permission | Purpose |
|---|---|
| `storage` | Store quota snapshots and refresh state locally |
| `alarms` | Refresh quota data periodically |
| `chatgpt.com` host access | Read Codex quota metadata and session authentication from the signed-in origin |

Chrome host permissions apply to the entire `https://chatgpt.com` origin even
when code only calls specific paths. Manifold Meter limits its requests to the
session endpoints and the Codex usage endpoint listed in `background.js`.

## Development

```bash
npm install
npm run check
npm run package
npm run store:assets
```

`npm run package` creates a release archive in `dist/` from an explicit file
allowlist so development files and dependencies are not shipped accidentally.
`npm run store:assets` regenerates the Chrome Web Store screenshots and
promotional images from the real local UI and demo data.

## Product scope

The Manifold Meter name is intentionally provider-neutral. Codex is the first supported source; additional AI providers can be added as separate adapters without changing the product identity.

## Independence and attribution

Manifold Meter is independent software and is not affiliated with or endorsed by OpenAI.

The original Codex quota-reading implementation was derived from the MIT-licensed Codex Quota Monitor project. The original copyright notice is preserved in [LICENSE](LICENSE).

## License

MIT
