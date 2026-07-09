export interface TabState {
  id: string
  title: string
  url: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** Muted because another tab is the live/broadcast tab. */
  muted: boolean
  /** Favicon as a data URL (fetched in main to keep the chrome CSP tight). */
  favicon: string | null
}

export interface TabsSnapshot {
  tabs: TabState[]
  activeId: string | null
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** A saved page. `url` is the identity (one bookmark per URL). */
export interface Bookmark {
  url: string
  title: string
  favicon: string | null
}

export type CaptureProfile = 'Match content' | 'Fast motion' | 'Movie'
export type TheaterAspect = 'Match' | '16:9' | '21:9' | 'Vertical'

export interface Settings {
  /** Standard browser GPU toggle; applied at launch, restart to change (D10). */
  hardwareAcceleration: boolean
  /** Start page for new tabs and the first tab. */
  homeUrl: string
  /** Capture profile applied to new streams; overridable per session. */
  defaultProfile: CaptureProfile
  /** Default theater framing. */
  theaterAspect: TheaterAspect
  /** Discord application client ID for Rich Presence (user-provided). */
  discordClientId: string
  /** Block ads and trackers (uBlock Origin / EasyList filters) across all tabs. */
  adBlock: boolean
  /** Torrent seeding upload cap in KB/s (auto-throttled to ~0 while streaming). */
  torrentUploadKBs: number
  /** Keep downloaded torrent data on quit instead of discarding it. */
  torrentKeepFiles: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  hardwareAcceleration: true,
  homeUrl: 'https://www.youtube.com',
  defaultProfile: 'Match content',
  theaterAspect: 'Match',
  discordClientId: '',
  adBlock: true,
  torrentUploadKBs: 100,
  torrentKeepFiles: false
}

/** StreamIt's own Discord application ID — public (not a secret), shipped with
 *  the app so users need no setup. The settings field overrides this only if a
 *  user wants to point at their own app. */
export const DEFAULT_DISCORD_CLIENT_ID = '1523858351862054983'

/** Basic Discord user from the RPC READY handshake (no OAuth needed). */
export interface DiscordUser {
  id: string
  username: string
  global_name?: string | null
  avatar?: string | null
  discriminator?: string
  premium_type?: number
}

export interface DiscordStatus {
  connected: boolean
  user: DiscordUser | null
}

/** Auto-update lifecycle, mirrored from main to the Settings → About UI. */
export type UpdateState =
  | { status: 'unsupported' } // dev build / not installed
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'ready'; version: string } // downloaded, relaunch to apply
  | { status: 'current' } // already latest
  | { status: 'error'; message: string }
