# Contributing to StreamIt

Thanks for your interest! StreamIt is a desktop app that turns Discord's Go Live
into a great watch-party source. This guide covers getting set up and the
conventions we follow.

## Getting started

Requires [Node.js](https://nodejs.org/) 20+ and a Windows machine (the current
build target; macOS/Linux support is welcome).

```bash
npm install
npm run dev
```

`npm run dev` starts the Electron app with hot reload. On Windows PowerShell, if
you hit a script-execution-policy error, either call `npm.cmd run dev` or run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Project layout

| Path | What lives there |
|------|------------------|
| `src/main/` | Electron main process: tab manager (`WebContentsView` per tab), Discord RPC, ad blocker, the `streamit://` media protocol, theater sizing, settings |
| `src/preload/` | Context-isolated bridges — `index.ts` (chrome) and `tabPreload.ts` (per-tab: drops, video aspect) |
| `src/renderer/` | React UI: browser chrome, Go Live panel, settings, theater |
| `src/player/` | Self-contained local-media player page (Web Audio loudness normalization) |
| `src/shared/` | Types shared across processes |
| `docs/` | Design decisions, architecture, Discord integration, roadmap |

Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/DECISIONS.md`](docs/DECISIONS.md) to understand the *why* behind the
structure — especially the non-obvious bits (keeping the window painting while
unfocused, `WebContentsView`-over-DOM limits, the same-origin media protocol).

## Conventions

- **TypeScript, strict.** Match the surrounding style — no new lint config needed.
- **Security first.** Renderer is context-isolated with no Node access; web
  content runs sandboxed. Don't widen these. The `streamit://` media handler
  serves only explicitly-opened files (allowlist) — keep it that way.
- **Match altitude.** Small, focused changes; comments explain *why*, not *what*,
  and only where the reasoning is non-obvious.

## Before you open a PR

Run these and make sure they're clean:

```bash
npm run typecheck    # both main and renderer
npm run build        # full production build must pass
```

### Testing note

Some features can't be verified by build alone and need a real machine:

- **Audio / normalization** — needs an audio device.
- **Discord Rich Presence** — needs the Discord desktop app running.
- **Screen-capture behavior** — needs a real GPU/display.
- **Ad blocking** — needs network access to fetch filter lists on first run.

If your change touches these, please test manually and describe what you saw in
the PR.

## Scope

StreamIt targets non-DRM and personal media. Please don't propose features aimed
at capturing DRM-protected content — it's out of scope by design (see the README
and [`docs/DECISIONS.md`](docs/DECISIONS.md)).

## Pull requests

- Keep PRs focused on one thing.
- Describe the change and how you tested it.
- Update the relevant `docs/` file if you change behavior or make a design
  decision worth recording.
