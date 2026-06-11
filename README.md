<p align="center">
  <img src="icons/icon128.png" alt="Support My Streamers" width="96" height="96" />
</p>

<h1 align="center">Support My Streamers</h1>

<p align="center">
  <strong>Lurk the Twitch channels you follow — two at a time, on autopilot.</strong>
</p>

<p align="center">
  Chrome extension · Manifest V3 · PT / EN · No backend · Official Twitch API
</p>

---

You pick who to support. The extension opens **up to 2 live streams** in a tab group and **rotates** through your list on a timer — so you can keep working while still showing up for the streamers you care about.

Personal lurking only: a real viewer, channels you chose, no chat bots, no server-directed audiences.

## Features

| | |
|---|---|
| **Live follows** | See who you follow that is live right now — game and viewer count |
| **Your list** | Toggle channels on/off before you start |
| **FIFO rotation** | Shuffled once, then fair queue; skips offline channels automatically |
| **Tab group** | Streams open in a dedicated **Support My Streamers** group |
| **Flexible timing** | 5–120 min, or ∞ (health check only, no switching) |
| **Audio** | Mute the browser tab; player volume stays high so you count as a viewer |
| **Privacy** | No analytics, no our servers — [privacy policy](PRIVACY.md) |

## How it works

```
Connect Twitch  →  Pick live channels  →  Start
        ↓
   2 tabs open in a group  →  rotate every N minutes  →  Stop closes the group
```

1. **Connect** with Twitch (scope: `user:read:follows` only).
2. **Select** streamers from the live list in the popup.
3. **Start** — tabs open muted (by default); a red dot on the icon means rotation is active.
4. **Stop** — closes the group and clears the queue.

Raid and offline rules, audio details, and the sync cycle: **[how-it-works.md](how-it-works.md)**.

## Quick start (end user)

**Chrome Web Store** — install when published.

**Load unpacked (development):**

1. Clone the repo and set up secrets (developers only — see below).
2. `chrome://extensions` → **Developer mode** → **Load unpacked** → this folder.
3. Open the popup → **Connect with Twitch** → select channels → **Start**.

## Development

### Prerequisites

- Node.js 18+
- A [Twitch Developer](https://dev.twitch.tv/console/apps) app (Application Integration)

### One-time setup

```bash
npm install
cp .env.example .env
# Set TWITCH_CLIENT_ID=... in .env
npm run secrets:inject
```

Register the extension redirect URL in the Twitch app:

`https://<extension-id>.chromiumapp.org/`

(Extension ID appears on `chrome://extensions` after load unpacked.)

For **CI releases**, add GitHub secret `TWITCH_CLIENT_ID`. The workflow injects it before packaging.

### Commands

```bash
npm test              # Vitest — pure logic (48 tests)
npm run build         # zip → build/support-my-streamers-<version>.zip
npm run icons:active  # regenerate toolbar icons with live dot
npm run secrets:inject
```

### Project layout

```
src/
  background.js     Service worker (Chrome APIs only)
  rotation.js       FIFO queue — pure, tested
  twitchApi.js      Helix wrapper
  popup/            Start / stop, channel list, progress bar
  options/          Interval, audio, language
test/
AGENTS.md           AI assistant guide
how-it-works.md     Behavior spec
```

**AI assistants:** read [AGENTS.md](AGENTS.md) and [coding standards](.cursor/rules/coding-standards.mdc). Code in English; UI strings in `src/i18n.js`.

## Ethics

Built for **personal** support of channels you already follow. Not viewbotting, not inflating metrics for strangers, not simulating engagement. See [how-it-works.md](how-it-works.md) and the [design notes](docs/superpowers/specs/2026-06-10-twitch-lurker-extension-design.md).

## License

Private project — check with the maintainer before redistributing.

<p align="center">
  <sub>powered by <a href="https://zaintech.com.br">zaintech.com.br</a></sub>
</p>
