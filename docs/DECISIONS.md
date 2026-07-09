# Decision log

Architecture Decision Records for StreamIt. Newest decisions may supersede older
ones — status noted per entry. This is the canonical record; the README
summarizes, this explains *why*.

---

## D1 — No DRM circumvention
**Status:** Accepted (firm, non-negotiable)

DRM-protected commercial streaming (Netflix, Disney+, etc.) renders in a
protected path and captures black. StreamIt does **not** attempt to defeat this by
any mechanism — including indirect ones like forcing a hardware-acceleration
downgrade to Widevine L3. Circumventing copy protection is out of scope as a
matter of principle, not capability.

**Consequence:** Product targets non-DRM and personal media only. Marketing frames
StreamIt as "watch your own and freely-available media with friends."

## D2 — Phase A first, Phase B later
**Status:** Accepted

Phase A: be a pristine Go Live *source*; Discord owns transport. Phase B: own the
WebRTC transport to a viewer page (bypasses Discord's caps, enables sync +
pass-the-remote). Phase A ships first because it's immediately useful and carries
no ToS risk; Phase B is the eventual moat.

**Consequence:** All Phase A architecture must leave room for Phase B without a
rewrite (see ARCHITECTURE.md).

## D3 — Electron over Tauri
**Status:** Accepted

We need Chromium's full media stack, codec coverage, and `desktopCapturer`. Tauri
(system WebView) can't guarantee those across platforms.

**Consequence:** Larger binary; accepted tradeoff.

## D4 — HeroUI v3 + Discord preset, flavored not cloned
**Status:** Accepted

Renderer uses React 19 + HeroUI v3, themed with HeroUI's first-party **Discord
preset** (OKLCH tokens: blurple `#5865F2`, `#1e1f22 / #2b2d31 / #313338` surfaces).
We deliberately stop at Discord-*flavored* — familiar and native to the audience —
and do not clone Discord's exact chrome/trade dress (brand-confusion risk if
StreamIt goes public).

## D5 — Go Live controls: slide-out Drawer, full-width browser
**Status:** Accepted (resolves former open question)

Browser-first identity. The Go Live button opens a right-hand Drawer for
setup/session controls; it auto-opens on first stream setup and closes for
theater. Beats an always-visible panel, which shrinks the content area
permanently.

## D6 — Multi-tab with one designated "live tab"
**Status:** Accepted (resolves former open question)

Keep multi-tab browsing, but exactly one tab is the **live tab**. Capture and
broadcast audio follow the *chosen* live tab, never merely the focused tab — so
the user can browse/queue in other tabs without disturbing the stream. The live
tab shows a persistent `● LIVE` marker; non-live tabs are audio-muted (see
ARCHITECTURE.md, audio pipeline).

## D7 — Nitro tier auto-detection via `premium_type`
**Status:** Accepted (resolves former open question)

Detect tier from the user object's `premium_type` (0 none / 1 Nitro Classic /
2 Nitro / 3 Nitro Basic) under the `identify` scope; fall back to asking if
absent. Use it to cap the offered capture profiles and drive the honesty meter.

**Caveat to verify:** 1080p60 can additionally require a boosted server;
`premium_type` won't reveal that. We detect the account ceiling and always allow
manual override.

## D8 — Broadcast boundary made legible
**Status:** Accepted (resolves former open question)

In the all-dark theme, the content area ("frame friends see") is distinguished
from private controls via a distinct panel elevation + a hairline divider, and the
content border is tinted while live. The broadcast/private boundary is
conceptually load-bearing and must always read clearly.

## D9 — No synthetic input into Discord
**Status:** Accepted

We never simulate keypresses/clicks into the Discord client, use reverse-engineered
private RPC, or ship a client mod — all risk getting *users* banned. Near-one-click
Go Live is achieved only via official surfaces: registering StreamIt as a
detectable app (surfaces the "Stream StreamIt" button) and the user's own
"Toggle Screen share" keybind. See DISCORD.md.

## D10 — Hardware acceleration is a standard setting
**Status:** Accepted

Settings exposes a hardware-acceleration toggle as an ordinary troubleshooting
option (GPU glitches, driver crashes, battery), identical in framing to
Chrome/Edge/Firefox. It is not site-wired, not auto-flipped, and not documented as
a capture workaround. Distinct from D1: a general setting is fine; building a
circumvention pipeline around it is not.

## D12 — Auto-update via electron-updater + GitHub releases
**Status:** Accepted

StreamIt ships as a self-updating desktop app rather than making users re-download
installers. `electron-updater` reads the existing GitHub `publish` config
(electron-builder.yml, owner `grvsmalik` / repo `StreamIt`) to find new versions —
no separate update server. `src/main/updater.ts` background-downloads on a check
(on launch + every 6h) and surfaces state through an IPC channel the Settings →
About panel mirrors; the user chooses when to relaunch ("Restart to update"),
though a pending update also installs on next quit. In dev / unpackaged builds it
reports `unsupported` and never touches the network.

**Operational requirement:** updates only work if each GitHub release contains the
`latest.yml` + installer + `.blockmap` that electron-builder emits. Cut releases
with `npm run release` (`electron-builder --publish always`) — not the plain
`package` script, which builds the installer but uploads nothing. A release whose
`version` is ≤ the installed one is simply ignored, so the version in package.json
must be bumped per release.

## D11 — Torrent streaming: user-responsibility, universal codecs
**Status:** Accepted

StreamIt streams torrents (magnet links + `.torrent` files) so peer-to-peer and
freely-distributed media (Internet Archive, public-domain film, open movies,
personal remote backups) is a first-class watch-party source. This does **not**
weaken D1: torrents are not DRM circumvention, and StreamIt applies no
content filtering — the **user is responsible for what they choose to download,
view, and stream.** The torrent page states this plainly, including that
downloading a torrent also uploads to peers.

To make *every* file play (the requirement that motivated this), playback runs
through a probe-and-adapt pipeline rather than hoping Chromium accepts the bytes:

- `media.ts` runs `ffprobe` and picks a **PlayMode**: `direct` (Chromium plays
  as-is, native seeking + range requests), `remux` (codecs fine, container isn't
  — repackage to fragmented MP4, stream copy, no re-encode), `audio` (video
  copied, only the audio transcoded to AAC — the common AC3/DTS/E-AC3 case), or
  `full` (both transcoded — the HEVC-without-hardware / exotic-codec fallback).
- Non-direct modes stream through `ffmpeg` into fragmented MP4 (`frag_keyframe+
  empty_moov`), which plays while still being written. Because fMP4 has no fixed
  end, the player uses a **custom control bar** and seeking = restart ffmpeg with
  `-ss <t>` (the `/pipe?...&t=` endpoint); the pipeline is killed on the request's
  abort signal so a seek/close doesn't leak a transcode.
- HEVC is enabled for direct play via `PlatformHEVCDecoderSupport`; if a machine
  can't hardware-decode it, the player's `error` handler falls back to `full`
  once. So HEVC costs no CPU where the GPU handles it, and still always plays.

Torrent bytes reach both the `<video>` and ffmpeg over a **loopback HTTP server**
(`TorrentEngine`) whose Range reads drive WebTorrent piece prioritization — that
is what makes play-while-downloading work. The `streamit://` handler proxies to it
and gates torrent-control endpoints behind an `x-streamit` header that web content
can't forge. **Seeding is throttled to ~0 whenever a Go Live tab is active**
(`onLiveChange` → `setStreaming`) so uploads never starve the broadcast upstream.
Downloads land in `userData/torrents` and are discarded on quit unless
`torrentKeepFiles` is set. ffmpeg/ffprobe ship as `asarUnpack`ed binaries.

**Consequence:** a large native dependency (~80MB ffmpeg) and real CPU cost when
transcoding, accepted because "it just plays" is the whole point. Transcoding
while *also* encoding a Discord stream is CPU-heavy on weak machines; `veryfast`
preset mitigates. The design keeps the existing same-origin player, loudness
normalization, theater, and capture path unchanged — torrents/local files are just
new *sources* into the same pipe.
