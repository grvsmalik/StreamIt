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
