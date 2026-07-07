# Architecture

Planning-stage technical design for StreamIt (Phase A). Grounded in what's
actually achievable, with known-hard problems flagged honestly rather than
hand-waved.

## Process model

- **Main process** (Electron/Node) — window/lifecycle, tab management, Discord
  RPC/OAuth, settings persistence, `app.disableHardwareAcceleration()` applied at
  launch per setting.
- **Renderer** (React 19 + HeroUI v3) — all chrome: tab strip, toolbar, Go Live
  drawer, settings, theater controls. Themed with the Discord preset.
- **Preload** — typed, minimal IPC bridge (contextIsolation on, nodeIntegration
  off). Renderer never touches Node directly.
- **Content views** — one **`WebContentsView`** per tab (the current API;
  `BrowserView` is deprecated). The renderer chrome is one view; each site is its
  own `WebContentsView` layered into the window.

## Tabs and the "live tab"

- N content views, one designated **live tab** (D6). A `liveTabId` lives in main
  process state.
- Only the live view is positioned to fill the "frame friends see" content area
  in theater; in normal mode it occupies the content region under the chrome.
- The live tab carries a persistent `● LIVE` marker in the tab strip.

## Capture path (Phase A)

StreamIt does **not** run its own capture in Phase A. Discord's Go Live captures
the **StreamIt application window** (or the app when shared). Our job is to make
that captured surface pristine:

- **Theater mode** removes all chrome so the captured frame is pure content.
- **Aspect/resolution** — the window/content region conforms to the chosen
  capture profile (match-content by default; 16:9 / 21:9 / vertical presets).
  Clean dimensions avoid double-rescaling blur.

Phase B replaces this with an in-app WebRTC encoder → viewer page.

## Audio pipeline — honest capability breakdown

Discord's Go Live captures the **application's** audio, not the whole system. That
shapes what's easy vs. hard:

| Goal | Feasibility in Phase A | How |
|------|------------------------|-----|
| **Exclude system sounds** (Discord pings, OS notifications) | **Easy — essentially free** | Those are other processes; Discord app-audio capture never includes them. |
| **Per-tab audio only** | **Achievable** | Mute all non-live `WebContentsView`s via `webContents.setAudioMuted(true)`; only the live tab emits audio into the captured app session. |
| **Loudness normalization** | **Hard for web content, easy for local files** | Cross-origin media elements (YouTube, etc.) are CORS-tainted — Web Audio can't tap them for analysis/gain. Works cleanly for local files (`file://`). Web content likely needs output-side processing or is deferred. |
| **Independent local monitor volume** (turn yourself down without lowering the broadcast) | **Hard — needs virtual audio routing** | Discord captures the single app output; lowering it lowers the broadcast too. True separation needs a virtual output device Discord captures while you monitor your real device. Power-user setup or Phase B. |

**Implication for v1:** ship the two solid wins immediately (system-sounds-excluded
+ per-tab via muting) — already a large step up from default screensharing.
Normalization ships for local files first; independent monitoring is R&D, not a v1
promise. Do **not** market the hard ones as done until they are (see communication
principle: report faithfully).

## Discord integration surface (see DISCORD.md for detail)

- Main process holds an RPC connection (local IPC) for `SET_ACTIVITY` (presence)
  and, if whitelisted later, voice commands.
- OAuth2 flow in main; tokens stored in `userData` (encrypted at rest where the OS
  keychain is available).

## Must keep painting while unfocused (screen-share requirement)

A screen-share source has to keep rendering when it is **not** the focused
window — you have to click over to Discord to hit Go Live, which unfocuses (and
often occludes) StreamIt. By default Chromium 120+ marks an
unfocused/occluded/backgrounded window hidden and stops painting, so the video
area (e.g. YouTube) goes **black** exactly at that moment. Non-negotiable
settings, applied in `main/index.ts` and the tab views:

- `app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')`
  — the main fix; disables the native occlusion calc that pauses paint.
- `disable-backgrounding-occluded-windows`, `disable-renderer-backgrounding`,
  `disable-background-timer-throttling`.
- `webPreferences.backgroundThrottling: false` on the BrowserWindow **and** on
  every tab `WebContentsView` (the video plays in the view, so this one matters
  most).

If video ever still goes black **only in Discord's capture** (but plays fine in
the app), that's a different problem — hardware video overlay planes that
window-capture can't read — and the lever there is disabling accelerated video
decode, not occlusion.

## Known limitation: overlays over web content

A `WebContentsView` always composites **above** the renderer DOM. So React
overlays (theater LIVE badge, transport bar) drawn on top of the content region
are hidden behind the native web view when a real page is loaded — they only show
over the empty placeholder. For theater this is acceptable (the goal is a pure
chrome-free broadcast frame; F/Esc toggle it via keyboard). If we later want
visible on-video controls, they need their own transparent overlay
`WebContentsView` layered above the content view, not DOM elements.

## Local media + loudness normalization

Local videos don't play via `file://` — that origin is opaque, and a Web Audio
`MediaElementSource` on cross-origin media is taint-silenced, which would kill
normalization. Instead a custom **`streamit://` scheme** (registered privileged:
standard + secure + stream) serves both:

- `streamit://app/player.html` — the StreamIt player page (`src/player/`).
- `streamit://app/media?src=<abs path>` — the file, range-streamed for seeking.

Both share origin `streamit://app`, so the player's Web Audio graph is never
tainted. `openFile` allowlists the path first; the media handler serves only
allowlisted files (a web page can't read arbitrary local files via a crafted
URL). Normalization is a real-time RMS→target auto-gain + limiter in the player,
toggled live via `normalize:set` relayed through the tab preload's `streamitTab`
bridge. Note: playback is still bounded by Chromium's codecs (mp4/H.264, webm,
ogg play; mkv/avi generally don't).

## Settings

- JSON in `app.getPath('userData')/settings.json`. Defaults in code.
- Hardware-acceleration and other launch-time flags read before `app.ready`.

## Phase B seams (build now, use later)

- Keep the live-tab abstraction transport-agnostic: Phase A points Discord at it;
  Phase B points a WebRTC encoder at the same view.
- Isolate "what am I broadcasting" state from "how it's transported."
- Candidate transport: LiveKit (managed SFU, small-group friendly) or mediasoup.

## Explicit non-goals (Phase A)

- No DRM circumvention (D1).
- No synthetic input / client mods / private RPC (D9).
- No custom video encoder (that's Phase B).
