<div align="center">

<img src="docs/assets/banner.png" alt="StreamIt — the browser built for watch parties over Discord" width="100%">

[![Website](https://img.shields.io/badge/website-streamitnow.vercel.app-5865f2?logo=vercel&logoColor=white)](https://streamitnow.vercel.app)
[![Download](https://img.shields.io/github/v/release/grvsmalik/StreamIt?label=download&color=5865f2)](https://github.com/grvsmalik/StreamIt/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows-2d3250)](https://github.com/grvsmalik/StreamIt/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-3ba55d)](LICENSE)

**[🌐 Website](https://streamitnow.vercel.app)** · **[⬇️ Download](https://github.com/grvsmalik/StreamIt/releases/latest)** · **[📖 Docs](docs/)** · **[🤝 Contributing](CONTRIBUTING.md)**

<br>

**A browser built for watching media with friends over Discord.**

StreamIt makes Discord's Go Live the best it can be — clean per-tab audio, a
distraction-free theater frame locked to a crisp capture resolution, live Rich
Presence, built-in ad blocking, and first-class local & personal-media playback.

</div>

---

## Why StreamIt

Screen-sharing a browser to friends in Discord is painful: system pings leak into
the stream, you're juggling windows, the quality is capped and opaque, and ads
crash the party. StreamIt fixes the **source** side of all of it.

It doesn't try to replace Discord or run its own servers — it rides the rails
your friends already use. **Your friends install nothing;** only the host runs
StreamIt, and everyone else just watches in the Discord voice channel they're
already in.

### Where it sits

The watch-together market splits in two:

- **Sync apps** (Teleparty, Watch2Gether, Scener) — everyone plays their *own*
  copy in sync. Great for streaming services, but everyone needs their own
  account, and it only works on supported sites.
- **Broadcast** (Discord Go Live, and cloud tools like Hyperbeam) — one source is
  sent to everyone. Works with anything, but quality is capped and it costs money
  to run a server for it.

StreamIt is **broadcast without the server bill** — it uses Discord's transport
and your machine, so it's free to run and free to use. Its niche is the one
nobody else owns: **your own and freely-available media** — Jellyfin/Plex, local
files, YouTube, Twitch, and the like.

## Features

- 🎬 **Theater mode** — one keypress hides all chrome and locks the window to a
  clean capture resolution (720p/1080p, 16:9/21:9/vertical, tier-aware) so Discord
  captures a pixel-perfect frame.
- 🔊 **Clean audio** — only the tab you're broadcasting makes sound; other tabs
  are muted so nothing leaks, and system notifications never enter the stream.
- 🧱 **Ad & tracker blocking** — uBlock Origin / EasyList filter lists applied at
  the network level, so ads never load and never show up in your stream.
- 📺 **Local & personal media** — drag-and-drop or open local video (served
  through a same-origin player with real-time loudness normalization); great for
  Jellyfin/Plex watch parties.
- 🧲 **Torrent streaming** — paste a magnet link or open a `.torrent` and it plays
  while it downloads (Internet Archive, public-domain film, open movies, your own
  remote media). Seeding auto-throttles during Go Live so it never starves the
  stream. *You are responsible for the content you access.*
- 🔁 **Plays anything** — an on-the-fly `ffmpeg` pipeline detects each file's
  codecs and remuxes/transcodes only what it must (AC3/DTS audio, HEVC, odd
  containers), so files that normally play silent or black just play.
- 💬 **Discord Rich Presence** — shows "Watching &lt;title&gt; · on StreamIt" with
  your real identity and tier, no setup required.
- 📊 **Honest quality** — detects your Nitro tier and tells you exactly what your
  friends will actually see, instead of letting you send more than Discord carries.
- 🧭 **A real browser** — tabs, address bar, favicons, bookmarks, themed to feel at
  home next to Discord.

## Scope & the DRM question

StreamIt targets media that's yours or freely available to share: personal media
servers, local files, and non-DRM sites. It **does not** attempt to capture
DRM-protected commercial streaming (Netflix, Disney+, etc.) — that renders black
by design, and circumventing it is out of scope as a matter of principle. For
those services, the only legitimate co-watching model is everyone using their own
account (a sync app like Teleparty), which is a different tool.

A standard hardware-acceleration toggle exists in Settings as an ordinary
troubleshooting option, exactly as every browser has one.

## Install

**From a release:** grab the latest `StreamIt Setup` installer from the
[website](https://streamitnow.vercel.app) or the
[Releases page](https://github.com/grvsmalik/StreamIt/releases/latest) and run it.

**From source:** see below.

## Build from source

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
npm run dev          # run in development
npm run gen:icons    # regenerate app icons from build/icon.svg
npm run package      # build a distributable installer into dist/
```

Discord Rich Presence works out of the box — StreamIt ships with its own Discord
application ID (a public identifier, not a secret). You can point it at your own
app in Settings → Discord if you prefer.

## Tech

Electron · TypeScript · React 19 · Vite · Tailwind CSS v4 ·
[HeroUI v3](https://heroui.com) · [@ghostery/adblocker](https://github.com/ghostery/adblocker)

## Project layout

```
src/main/       Electron main process (tabs, Discord RPC, ad-block, media protocol)
src/preload/    Context-isolated bridges (chrome + per-tab)
src/renderer/   React UI (browser chrome, Go Live panel, settings, theater)
src/player/     Same-origin local-media player with loudness normalization
docs/           Design decisions, architecture, Discord integration, roadmap
```

Deeper docs live in [`docs/`](docs/): [decisions](docs/DECISIONS.md),
[architecture](docs/ARCHITECTURE.md), [Discord integration](docs/DISCORD.md), and
the [roadmap](docs/ROADMAP.md).

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
