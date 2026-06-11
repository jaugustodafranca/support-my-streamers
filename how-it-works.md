# How it works

<!--
  AI assistants: read AGENTS.md first for architecture and coding rules.
  This file describes product/runtime behavior in detail.
-->

Documentation for **Support My Streamers** — tab cycle, audio, Twitch sync, and
offline/raid rules.

> **For AIs:** [AGENTS.md](AGENTS.md) · [coding-standards.mdc](.cursor/rules/coding-standards.mdc) · [CLAUDE.md](CLAUDE.md)  
> **Code language:** English only in source; UI copy in `src/i18n.js` (PT/EN).

## Overview

1. User connects their Twitch account (OAuth).
2. The popup lists **live follows** via the Helix API.
3. User selects channels to support and clicks **Start**.
4. The extension opens up to **2 tabs** (`SLOTS`) in a **Support My Streamers** group.
5. Every **N minutes** (configurable in options), a **silent background cycle** runs —
   no notification or sound for the user.

Only channels the user **selected** and **follows on Twitch** enter the rotation.

---

## Sync cycle (`syncCycle`)

Triggered by Chrome’s internal timer (`chrome.alarms`). Does not notify the user.

| Time setting | Timer behavior |
|---|---|
| **5–120 min** | Cycle every N minutes |
| **∞ (never switch)** | Health check every **5 min** (`HEALTH_CHECK_MINUTES`) — no rotation |

### Steps each cycle

```
1. liveSelected()     → who from the list is still live (Twitch API)
2. reconcileTabs()    → fix each tab (offline, raid, replacement)
3. fillEmptySlots()   → open a tab if a live channel has no slot
4. rotate (optional)  → only if more than 2 live AND interval > 0
5. recordCycleEnd()   → empty hook for future VPS reporting
```

---

## Per-tab rules

Each tab tracks which channel it is **supporting** (`tabLogins`). Each cycle compares
that to the tab’s actual URL.

| Situation | Action |
|---|---|
| Supported channel **live** and tab on correct URL | Keep |
| Supported **live** but tab is on a **raid** target | Navigate back to supported channel |
| Supported **offline**, **another list channel** is live | Swap to next available |
| **Offline**, no replacement, tab still on supported channel | Keep (offline screen) |
| **Raid**, no replacement in list | **Close** tab |

### Rotation (round-robin)

- Only when **3 or more** list channels are live.
- With **2 or fewer** live: keep current tabs even after the timer fires.
- Pure logic lives in `src/rotation.js` (`windowAt`, `nextCursor`, `decideTabAction`).

### Examples

**3 selected, 5 min interval**

```
t=0   → opens A and B
t=5   → A went offline → tab switches to C
t=10  → B raided to X (not in list), only C live → close B’s tab
t=15  → C offline, tab on twitch.tv/C → keep
```

**2 selected, 5 min interval**

```
→ opens A and B
→ timer fires but no rotation (no “next” beyond those 2)
→ popup (EN): "watching 2 of 2 · no switching"
```

---

## Audio and Twitch player

| Mode (options) | Chrome tab | Twitch player |
|---|---|---|
| **Muted** (default) | Muted — user hears nothing | High volume, unmuted |
| **Sound on** | Unmuted | High volume |

The content script `src/twitchPlayer.js` is injected on rotation tabs to:

- keep `video.volume = 1` and `video.muted = false`;
- ensure playback continues;
- auto-click overlays (mature content, classification, cookies).

Re-injection is prevented with `globalThis.__smsPlayerActive`.

---

## Persistence and service worker

Tab state (`tabIds`, `tabLogins`, `groupId`) is stored in `chrome.storage.session`
to survive service worker restarts.

- `persistRuntime()` — after every tab change
- `restoreRuntime()` — on SW startup and before each cycle/resume

Tabs closed manually by the user are dropped on restore.

---

## Authentication

- OAuth implicit grant (`src/auth.js`).
- `expiresAt` is checked before API calls (`isAuthExpired`).
- Invalid token or 401 → clear auth and prompt login in the popup.

---

## Key files

| File | Responsibility |
|---|---|
| `src/background.js` | Timer, tabs, group, cycle, mute, script injection |
| `src/rotation.js` | Pure logic: round-robin, URL parse, per-tab decisions |
| `src/twitchPlayer.js` | Content script on Twitch pages |
| `src/twitchApi.js` | Helix API (`streams/followed`, user) |
| `src/popup/` | UI: selection, play/pause/stop, status |
| `src/options/` | Interval, audio, language |
| `test/tabSync.test.js` | Tab sync logic tests |

---

## Support report (future — VPS)

At the end of each cycle, `recordCycleEnd(live, tabLogins)` will integrate with a
VPS backend to record:

- which channels were open during the cycle;
- interval duration;
- per-user timestamp.

This will power a popup report (“how many cycles each streamer was supported”).

---

## Tests

```bash
npm test
```

Pure logic coverage: rotation, auth, API, storage, i18n, tab sync (**41** tests).
`background.js` and `twitchPlayer.js` rely on manual smoke tests in Chrome.

---

## References

- [Original design (MVP)](docs/superpowers/specs/2026-06-10-twitch-lurker-extension-design.md)
- [Chrome Web Store listing](docs/store-listing.md)
