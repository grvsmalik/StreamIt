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
- ☐ Onboarding refinement; empty/error states.
- ☐ Submit to Discord's detectable-games database (zero-setup recognition).
- **Demo:** shareable beta installer exists.

## Phase B — Own transport (post-v1, the moat)
- In-app WebRTC encoder → viewer page; bot posts a watch link.
- Bypass Discord's bitrate ceiling (true 1080p60+).
- Playback sync + pass-the-remote.
- Harder audio wins become feasible here (independent monitor via own pipeline).
- Transport candidate: LiveKit (managed SFU) or mediasoup.

## Deferred / if-approved
- `SELECT_VOICE_CHANNEL` auto-move-into-VC (Discord whitelist).
- Loudness normalization for cross-origin web content (needs output-side approach).
