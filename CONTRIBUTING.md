# Contributing

Thanks for your interest in improving **Support My Streamers**!

## Getting started

```bash
git clone https://github.com/jaugustodafranca/support-my-streamers.git
cd support-my-streamers
npm install
npm run extension:oauth-redirect   # register printed URLs in Twitch Developer Console
npm test
```

Load the extension unpacked at `chrome://extensions` (Developer mode → Load unpacked → this folder) for manual testing. Register `https://<extension-id>.chromiumapp.org/` as a Redirect URL in your Twitch app.

## Ground rules

- **English only** in code: identifiers, comments, error messages, tests, and commit messages.
- User-visible UI text goes in [`src/i18n.js`](src/i18n.js) — always add both `pt` and `en` keys.
- Keep pure logic (`rotation.js`, `auth.js`, `twitchApi.js`) free of `chrome.*` calls; all Chrome side effects live in `src/background.js`.
- Follow KISS / Clean Code — see [.cursor/rules/coding-standards.mdc](.cursor/rules/coding-standards.mdc): **`const` arrows**, **readable names** (no `s`/`c`/`e` in callbacks), **English-only** code.
- Stack is **JavaScript** (no TypeScript / no build). TypeScript needs an issue and maintainer approval first.
- Read [AGENTS.md](AGENTS.md) for architecture boundaries and core invariants, and [how-it-works.md](how-it-works.md) for product behavior.

## Commits & pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`…). Releases are automated with release-please, so commit messages decide version bumps.
- Run `npm test` before opening a PR — all tests must pass.
- Keep diffs small and focused; don't refactor unrelated code in the same PR.
- New npm dependencies, manifest permissions, or changes to core invariants (slots, sync/raid rules, audio behavior) need discussion first — open an issue.

## Release flow

One merge to `main` → automatic GitHub Release + Store zip (no second PR).

| Step | What you do | What happens |
|------|-------------|--------------|
| **1. PR** | Open a PR with [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, …). Review and merge into `main`. | CI runs tests. release-please bumps the version, updates `CHANGELOG.md`, creates a GitHub Release, and attaches **support-my-streamers-X.Y.Z.zip**. |
| **2. Chrome Web Store** | Download the zip from [Releases](https://github.com/jaugustodafranca/support-my-streamers/releases). Upload in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) → Package → Submit / Publish. | Users get the new version after Google review. |

**Notes**

- Only `feat:`, `fix:`, and other releasable conventional commits trigger a version bump (`docs:` / `chore:` alone do not).
- CI does not upload to the Chrome Web Store — no `CHROME_*` secrets needed.

**Build locally** (optional — same zip as CI)

```bash
npm run build       # Store zip (no manifest "key")
npm run build:dev   # Dev zip (keeps manifest "key" for unpacked testing)
```

## Ethics

This extension automates *personal* lurking for channels the user already follows. PRs that enable viewbotting, server-directed audiences, or chat automation will not be accepted.
