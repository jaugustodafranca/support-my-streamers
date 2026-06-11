# AGENTS.md

Instructions for **any AI assistant** working on this repository.

Format based on the open standard: [agents.md](https://agents.md/) · [agentsmd/agents.md](https://github.com/agentsmd/agents.md)

**Read first:** [`how-it-works.md`](how-it-works.md) for product behavior.

---

## Project

Chrome Extension **Manifest V3** — personal Twitch lurking. User selects followed live channels; extension opens 2 tabs, syncs on a timer.

| Stack | JavaScript ES modules, Vitest, no TypeScript, no build step |
| Ethics | User-local channel list only. No viewbotting or server-directed audiences |

---

## Commands

```bash
npm install
npm test                    # required before finishing logic changes
```

Manual smoke test: load unpacked at `chrome://extensions`.

---

## Boundaries

### Always

- Write **English only** in code: identifiers, comments, errors, tests, commit messages.
- Put **user-visible UI text** only in `src/i18n.js` (`pt` + `en` keys).
- Keep **pure logic** in `rotation.js`, `auth.js`, `twitchApi.js` — testable without Chrome mocks.
- Keep **all `chrome.*` side effects** in `src/background.js` only.
- Import constants from `config.js` (`SLOTS`, `HEALTH_CHECK_MINUTES`) — no magic numbers.
- Follow **KISS**, **DRY**, **YAGNI**, **Clean Code** (see [`.cursor/rules/coding-standards.mdc`](.cursor/rules/coding-standards.mdc)).
- Run `npm test` after changing pure modules.
- Preserve **core invariants** in `how-it-works.md` (sync cycle, raid rules, audio, session persistence).

### Ask first

- New npm dependencies.
- New manifest permissions or host permissions.
- Changing `SLOTS`, sync/raid rules, or audio behavior.
- Backend/VPS integration beyond the `recordCycleEnd()` hook.

### Never

- Portuguese (or any non-English) in source code, comments, or variables.
- Commit secrets, `.env`, or tokens.
- Content scripts registered globally on all Twitch pages (inject from background only).
- Git commits unless the user explicitly requests.
- Force-push to `main`.

---

## Architecture

```
src/background.js     # Service worker — chrome.* only
src/rotation.js       # Pure: FIFO rotation, decideTabAction, parseChannelLogin
src/twitchPlayer.js   # Injected content script (volume, overlays)
src/twitchApi.js      # Helix API
src/auth.js           # OAuth helpers (flow in background.js)
src/storage.js        # chrome.storage.local
src/config.js         # SLOTS, defaults; CLIENT_ID from generated config.secrets.js (.env)
src/i18n.js           # UI strings (pt/en) — not chrome.i18n
src/popup/  src/options/
test/
```

Messages: popup/options → `chrome.runtime.sendMessage` → `background.js`.

---

## Core invariants (do not break)

1. Channels: user **selected** + **follows** + **live** (`liveSelected()`).
2. `SLOTS = 2` tabs max.
3. `syncCycle`: `reconcileTabs` → `fillEmptySlots` → rotate only if `live.length > SLOTS` and `intervalMinutes > 0`.
4. Interval ∞ (`0`): health check every `HEALTH_CHECK_MINUTES` (5), no rotation.
5. Raid without list replacement → close tab (`decideTabAction`).
6. Tab mute in Chrome; player volume in `twitchPlayer.js`.
7. Runtime in `chrome.storage.session` (`persistRuntime` / `restoreRuntime`).

---

## Debugging map

| Symptom | Files |
|---|---|
| Tabs / raid / offline | `background.js`, `rotation.js` |
| Player / volume | `twitchPlayer.js`, `applyTabAudio` |
| Auth / API | `auth.js`, `twitchApi.js` |
| SW lost tabs | `persistRuntime`, `restoreRuntime` |
| Popup status | `popup/popup.js` |

---

## Docs

| File | Purpose |
|---|---|
| [`how-it-works.md`](how-it-works.md) | Behavior, examples |
| [`README.md`](README.md) | Dev setup |
| [`.cursor/rules/coding-standards.mdc`](.cursor/rules/coding-standards.mdc) | KISS, Clean Code, style |
