# Discord integration

How StreamIt works *with* Discord, using only official surfaces. The guiding
constraint: never do anything that could get a **user's** account flagged (D9).

## The hard reality

Discord exposes **no public API to start Go Live / screen share.** It must be
initiated in the Discord client, with the user picking the source. We do not work
around this via UI automation, reverse-engineered private RPC, or client mods. We
get as close to one-click as the official surfaces allow.

## What we use

### OAuth2
- Scopes: `identify` (user + `premium_type` for tier detection, D7), `guilds`
  (server list). `rpc` / voice scopes are **whitelist-only** — not a launch
  dependency.
- Token stored in `userData`, OS keychain where available.

### Rich Presence (RPC `SET_ACTIVITY`)
- Available to every app via local IPC using the app's client id — no OAuth grant
  needed.
- Shows "Watching [title] · StreamIt" with art assets. Highest-leverage
  integration we fully control.

### Voice-channel awareness
- Read which VC has friends in it; surface "N friends in [channel]" in the drawer.
- Deep-link (`discord://`) to jump Discord to that channel so the user is already
  in the VC before they Go Live.

### The "Stream StreamIt" button (the near-one-click path)
- Registering StreamIt as a **detectable app** makes Discord show a dedicated
  **"Stream StreamIt"** shortcut in the voice panel (no window picker), and makes
  the official **"Toggle Screen share" keybind** target StreamIt.
- Two registration routes:
  1. **User-side, immediately:** user adds StreamIt via Discord → Settings →
     Registered Games → "Add it!" (covered in first-run flow).
  2. **Official, later:** submit StreamIt to Discord's detectable-games database
     via the developer portal so it's recognized automatically with zero user
     setup.

### Keybind
- Discord's built-in **"Toggle Screen share"** keybind, once StreamIt is detected,
  toggles streaming StreamIt. The **user** binds and presses it. We never
  synthesize the keypress (D9). First-run offers this as an optional step.

## Tier detection (D7)
- `premium_type` on the user object → cap offered capture profiles + drive the
  honesty meter.
- Caveat: 1080p60 may also need a boosted server, which `premium_type` won't
  reveal. Detect the account ceiling, always allow manual override. **Verify**
  current boost interaction before relying on it in UI copy.

## First-run flow (mocked)
1. Connect Discord (OAuth).
2. Register StreamIt as a detectable app → surfaces the "Stream StreamIt" button.
3. (Optional) Bind "Toggle Screen share" in Discord keybinds.
4. Ready.

## Explicit non-goals
- No starting Go Live programmatically.
- No UI automation, no synthetic input, no client modification, no private/
  undocumented RPC.
- `SELECT_VOICE_CHANNEL` auto-move: only if Discord grants the whitelist; never a
  launch dependency.

## To verify before build
- Current OAuth return shape for `premium_type`.
- Exact developer-portal path for detectable-app submission in 2026.
- Whether "Toggle Screen share" reliably targets a manually-registered app vs.
  only officially-detected ones.
