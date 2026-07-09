# Roadmap

Milestone-based, not date-based (this is a personal/vibe project). Each milestone
is shippable and demoable on its own.

## M0 — Planning ✅ (current)
- Concept, scope, and the DRM boundary settled.
- Visual direction locked: Electron + React + HeroUI v3 + Discord preset.
- All core surfaces mocked (main window, theater, settings, first-run).
- Docs written: README, DECISIONS, ARCHITECTURE, DISCORD, this roadmap.

## M1 — Shell (in progress)
- ✅ Electron + TypeScript + React 19 + HeroUI v3 with the Discord theme.
- ✅ Real tabbed browsing via `WebContentsView` (main-process `TabManager`),
  address bar with search/URL normalization, back/forward/reload, create/close,
  live bounds reporting so the native view tracks the content region.
- ✅ Go Live marks the active tab as the live tab.
- ✅ Custom Discord-themed title bar (`titleBarOverlay`), tabs in the title-bar
  row, window drag regions.
- ✅ Settings screen (General / Playback / Audio / Discord / About) bound to the
  persisted settings backend: hardware-acceleration toggle with restart notice
  (D10), home page, default capture profile, theater aspect. Active page is
  detached while settings is open so the DOM overlay is visible.
- ✅ Favicons in the tab strip — fetched in the main process and passed as data
  URLs (keeps the chrome CSP tight; no remote images in the privileged renderer).
- **Demo:** it browses real pages, has a themed title bar and a working settings
  screen. (Verified: WebContentsView loads example.com + live DOM read-back;
  settings render + section nav via a11y snapshot; app boots clean.)

## M2 — Theater + audio wins (in progress)
- ✅ Theater mode (`F`): chrome hides, LIVE badge, transport bar.
- ✅ Live-tab designation + `● LIVE` marker (D6).
- ✅ Keep painting while unfocused/occluded so capture doesn't go black
  (occlusion + backgroundThrottling switches; see ARCHITECTURE.md).
- ✅ Per-tab audio isolation: only the live tab makes sound, all others muted
  so they can't leak into the stream (with a mute indicator in the tab strip).
  System-sounds-excluded is inherent (Discord captures only StreamIt's audio).
- ✅ Local file open: native file dialog (toolbar button + Ctrl+O) opens video
  in a new tab via `file://`; drag-and-drop opens a new tab from anywhere —
  chrome/empty areas (chrome renderer) and drops onto a loaded page (per-tab
  `tab.js` preload captures in-page drops and routes them to a new tab).
- ✅ Loudness normalization for local files: local media plays through a
  same-origin `streamit://` player (custom protocol, range-streamed, allowlisted)
  so the Web Audio graph isn't taint-silenced; real-time RMS→target auto-gain with
  a limiter, toggled live from the panel. (Architecture verified: same-origin,
  206 range, allowlist 403. Audio itself needs real-machine testing — no audio
  device in the build env.)
- ☐ Independent local monitor volume ("Your volume" slider is still cosmetic —
  true separation needs virtual audio routing; hard, likely Phase B).
- **Demo:** screenshare StreamIt in Discord — stays live when unfocused, only the
  broadcast tab's audio goes out.

## M3 — Discord integration (in progress)
- ✅ Discord local RPC (own minimal IPC client, frame codec verified) — no OAuth.
  The READY handshake yields the logged-in user, so identity + tier come free.
- ✅ Rich Presence: sets "Watching <live tab> · on StreamIt", updated as the live
  tab changes; user provides a client ID in Settings → Discord.
- ✅ `premium_type` tier detection (D7) drives the panel tier badge + honesty
  meter (Free vs Nitro) from the real account — no more hardcoded "Free tier".
- ✅ Panel + settings show real connection state (no more fake "tarish / 3 friends
  in General VC").
- ☐ VC awareness ("N friends in [channel]") — needs the whitelist-only `rpc`
  scope; deferred.
- ✅ "Stream StreamIt" button now opens a guided helper (join VC → Go Live →
  pick StreamIt → press F), honest that Discord doesn't let apps auto-start Go
  Live (D9). A true one-click still needs detectable-app registration (below).
- ☐ Detectable-app registration → real one-click "Stream StreamIt" button.
  Now unblocked: the app is packaged, so it can be submitted to Discord's
  detectable-games database (or added user-side via Registered Games).
- **Needs live testing:** no Discord client in the build env — verified the wire
  protocol + graceful no-op without a client ID; connection itself is untested.

## M4 — Quality honesty (in progress)
- ✅ Honesty meter from the real Nitro tier (`premium_type`): Free → 720p30/1.5
  Mbps, Nitro → up to 1080p60/8 Mbps.
- ✅ Capture profiles are real: entering theater resizes the window to a clean
  capture resolution (profile sets height, tier caps it, aspect sets shape,
  clamped to fit the screen) so Discord captures a pixel-exact window. The locked
  resolution is shown in the theater LIVE badge. (Verified: sizing math + exact
  `setContentSize`.)
- ✅ "Match content" reads the live video's real aspect ratio (reported by the
  tab preload) and sizes theater to it; falls back to 16:9.
- ☐ (Stretch) motion-aware profile recommendation.

## M5 — Polish / beta (in progress)
- ✅ Broadcast-boundary visual treatment (D8): live-tinted top edge + "broadcasting
  this tab" pill on the content frame.
- ✅ Icon/branding.
- ✅ Ad/tracker blocking (`@ghostery/adblocker-electron`, uBlock Origin + EasyList
  lists) at the network level on the default session — ads never load, so none
  show up in the stream. Cached to disk; "Block ads and trackers" toggle in
  Settings (on by default). The real uBO extension can't run in modern Electron
  (MV2 killed); this is the same filter lists the supported way. (Verified: API,
  externalization, boots, ships in the installer asar with its cosmetic preload.
  Live list fetch + actual blocking are user-tested — CDN blocked in build env.)
- ✅ **Packaging** — electron-builder produces `dist/StreamIt Setup 0.1.0.exe`
  (NSIS installer, desktop/start-menu shortcuts). Verified: packaged `StreamIt.exe`
  boots with a window; asar bundles the player page + icon.
- ✅ **Auto-update** (`electron-updater` + the GitHub publish config, D12):
  background check on launch + every 6h, downloads silently, Settings → About shows
  version + status with a "Restart to update" action; `npm run release` publishes
  the update metadata. Reports "unsupported" in dev. (Verified: typecheck + build,
  dep externalized in the main bundle, About panel renders/interacts in preview;
  real update flow needs a published release to test.)
- ✅ **Bookmarks** — star toggle in the address bar (Ctrl/Cmd+D) saves the active
  tab; a bookmarks bar under the toolbar shows saved pages (favicon + title), click
  to open in the current tab, hover to remove. Persisted as `bookmarks.json` in
  userData (main-process store + IPC, same pattern as settings). (Verified in
  preview: add/remove via star, chip, and Ctrl+D; bar hides when empty; no errors.)
- ☐ Onboarding refinement; empty/error states.
- ☐ Submit to Discord's detectable-games database (zero-setup recognition).
- **Demo:** shareable beta installer exists.

## M6 — Universal playback + torrents (in progress)
- ✅ Probe-and-adapt media pipeline (`media.ts`): `ffprobe` classifies every
  source into direct / remux / audio / full and `ffmpeg` streams non-direct ones
  as fragmented MP4, so AC3/DTS/E-AC3 audio and odd containers play instead of
  going silent/black. HEVC direct-plays via hardware decode with a transcode
  fallback. (Verified: real ffmpeg — AC3-in-MKV → detected `audio` → transcoded
  output re-probes as direct/H.264+AAC; HEVC & clean MP4 classify correctly.)
- ✅ Torrent streaming (`torrent.ts`): magnet links + `.torrent` files open a
  landing page (metadata, file list, live progress) and play while downloading via
  a loopback Range server driving WebTorrent piece priority. Seeding auto-throttles
  to ~0 during Go Live; downloads discarded on quit unless kept. (Verified:
  WebTorrent import/instantiation + loopback bind/teardown; typecheck + build.)
- ✅ Custom player controls for pipeline mode (fMP4 has no native seek): scrub =
  restart ffmpeg at the new timestamp; buffering overlay for torrent fetches.
- ✅ User-responsibility framing on the torrent page (D11, D1 preserved).
- ✅ Settings UI: Torrents section with "Keep downloaded files" toggle and
  "Upload speed limit" field (clamped 1–100000 KB/s). (Verified in preview: renders,
  toggle + clamp work, no console errors.)
- ✅ Subtitles + audio-track selection: probe enumerates all audio and (text)
  subtitle streams; the player gets CC + audio menus. Audio switch runs through the
  pipeline with the chosen track (transcoded to AAC); embedded text subs render via
  a `<track>` element, with cue timestamps rebased in JS so they stay in sync after
  a pipeline seek. Image subs (PGS/VobSub) and external .srt loading are follow-ups.
  (Verified with real ffmpeg: 2-audio + embedded-SRT MKV enumerates correctly,
  picked-audio output re-probes as H.264+AAC, subtitle extracts to valid WebVTT,
  the JS cue-shifter drops/clamps/rebases correctly. On-screen menu + subtitle
  rendering needs a real-machine pass.)
- ☐ Real-machine test: live magnet playback + Discord broadcast under load;
  subtitle/audio menus on real files.
- **Demo:** paste a magnet link, pick the file, watch-party it in Discord — even
  if it's an HEVC/AC3 MKV.

## Phase B — Own transport (post-v1, the moat)
- In-app WebRTC encoder → viewer page; bot posts a watch link.
- Bypass Discord's bitrate ceiling (true 1080p60+).
- Playback sync + pass-the-remote.
- Harder audio wins become feasible here (independent monitor via own pipeline).
- Transport candidate: LiveKit (managed SFU) or mediasoup.

## Deferred / if-approved
- `SELECT_VOICE_CHANNEL` auto-move-into-VC (Discord whitelist).
- Loudness normalization for cross-origin web content (needs output-side approach).
