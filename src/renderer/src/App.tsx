import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react'
import { Button } from '@heroui/react'
import type { TabsSnapshot, DiscordStatus, Bookmark } from '../../shared/types'
import { SettingsScreen } from './Settings'
import { StreamItMark } from './Logo'
import {
  ChevronLeft,
  ChevronRight,
  Refresh,
  Lock,
  Share,
  Theater,
  Settings,
  Discord,
  Headphones,
  Adjustments,
  BellOff,
  Alert,
  Plus,
  X,
  Play,
  Maximize,
  Globe,
  VolumeX,
  FolderOpen,
  Star
} from './icons'

const api = typeof window !== 'undefined' ? window.streamit : undefined

// Fallback for the browser-only preview harness (no Electron / no native views).
const DEMO: TabsSnapshot = {
  activeId: 't1',
  tabs: [
    { id: 't1', title: 'Sunset timelapse 4K', url: 'https://youtube.com/watch?v=…', loading: false, canGoBack: true, canGoForward: false, muted: false, favicon: null },
    { id: 't2', title: 'Jellyfin', url: 'https://jellyfin.local', loading: false, canGoBack: false, canGoForward: false, muted: false, favicon: null }
  ]
}

const PROFILES = ['Match content', 'Fast motion', 'Movie'] as const

/** What Discord actually delivers at the user's Nitro tier (see docs/DISCORD.md). */
function tierInfo(premiumType?: number): { badge: string; delivers: string; warn: boolean } {
  if (premiumType && premiumType > 0) {
    return { badge: 'Nitro', delivers: 'up to 1080p60 · 8 Mbps', warn: false }
  }
  return { badge: 'Free tier', delivers: '720p30 · 1.5 Mbps', warn: true }
}

function useReportBounds(ref: React.RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !api) return
    const report = (): void => {
      const r = el.getBoundingClientRect()
      api.view.setBounds({
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height)
      })
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    window.addEventListener('resize', report)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [ref])
}

export default function App(): JSX.Element {
  const [snap, setSnap] = useState<TabsSnapshot>(api ? { tabs: [], activeId: null } : DEMO)
  const [liveId, setLiveId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [theater, setTheater] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [profile, setProfile] = useState<(typeof PROFILES)[number]>('Match content')
  const [normalize, setNormalize] = useState(true)
  const [dragActive, setDragActive] = useState(false)
  const [discord, setDiscord] = useState<DiscordStatus>({ connected: false, user: null })
  const [lockedRes, setLockedRes] = useState<{ width: number; height: number } | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  useEffect(() => {
    if (!api) return
    const off = api.tabs.onSync(setSnap)
    api.tabs.ready()
    void api.tabs.get().then(setSnap)
    void api.getSettings().then((s) => setProfile(s.defaultProfile))
    void api.bookmarks.list().then(setBookmarks)
    return off
  }, [])

  useEffect(() => {
    if (!api) return
    void api.discord.get().then(setDiscord)
    return api.discord.onStatus(setDiscord)
  }, [])

  useEffect(() => {
    api?.tabs.setLive(liveId)
  }, [liveId])

  const openSettings = (): void => {
    setSettingsOpen(true)
    api?.view.setHidden(true)
  }
  const closeSettings = (): void => {
    setSettingsOpen(false)
    api?.view.setHidden(false)
    void api?.getSettings().then((s) => setProfile(s.defaultProfile))
  }
  const openGuide = (): void => {
    setGuideOpen(true)
    api?.view.setHidden(true)
  }
  const closeGuide = (): void => {
    setGuideOpen(false)
    api?.view.setHidden(false)
  }

  const enterTheater = async (): Promise<void> => {
    setTheater(true)
    const s = await api?.getSettings()
    const res = await api?.theater.enter({ profile, aspect: s?.theaterAspect ?? 'Match' })
    if (res) setLockedRes(res)
  }
  const exitTheater = (): void => {
    setTheater(false)
    api?.theater.exit()
    setLockedRes(null)
  }

  const active = snap.tabs.find((t) => t.id === snap.activeId) ?? null

  const bookmarkable = !!active && !!active.url && active.url !== 'about:blank'
  const isBookmarked = bookmarkable && bookmarks.some((b) => b.url === active!.url)

  const toggleBookmark = (): void => {
    if (!bookmarkable || !active) return
    const p = isBookmarked
      ? api?.bookmarks.remove(active.url)
      : api?.bookmarks.add({
          url: active.url,
          title: active.title || active.url,
          favicon: active.favicon
        })
    if (p) void p.then(setBookmarks)
    else if (!api) {
      // Preview harness (no Electron): update local state so the UI is testable.
      setBookmarks((list) =>
        isBookmarked
          ? list.filter((b) => b.url !== active.url)
          : [{ url: active.url, title: active.title || active.url, favicon: active.favicon }, ...list]
      )
    }
  }

  const openBookmark = (url: string): void => {
    if (active) api?.tabs.navigate(active.id, url)
    else api?.tabs.create(url)
  }

  const removeBookmark = (url: string): void => {
    const p = api?.bookmarks.remove(url)
    if (p) void p.then(setBookmarks)
    else setBookmarks((list) => list.filter((b) => b.url !== url))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT'
      if (e.key.toLowerCase() === 'f' && !typing && !e.metaKey && !e.ctrlKey) {
        if (theater) exitTheater()
        else void enterTheater()
      }
      if (e.key.toLowerCase() === 'o' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        void api?.openFileDialog()
      }
      if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        toggleBookmark()
      }
      if (e.key === 'Escape') exitTheater()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theater, profile, active, isBookmarked, bookmarkable])

  const goLive = (): void => {
    if (active) setLiveId(active.id)
    setPanelOpen(true)
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragActive(false)
    for (const f of Array.from(e.dataTransfer.files)) {
      if (/\.(mp4|mkv|webm|mov|m4v|avi|ogv)$/i.test(f.name) || f.type.startsWith('video/')) {
        const p = api?.getPathForFile(f)
        if (p) api?.tabs.openFile(p)
      }
    }
  }

  if (settingsOpen) return <SettingsScreen onClose={closeSettings} />
  if (guideOpen) return <GuidedGoLive onClose={closeGuide} />
  if (theater) return <TheaterView onExit={exitTheater} lockedRes={lockedRes} />

  return (
    <div
      className="relative flex h-full flex-col"
      style={{ background: 'var(--si-bg)' }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={(e) => {
        if (!e.relatedTarget) setDragActive(false)
      }}
      onDrop={onDrop}
    >
      {dragActive && (
        <div
          className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] font-medium"
          style={{ background: 'var(--si-blurple)', color: '#fff' }}
        >
          Drop a video to open it
        </div>
      )}
      <TabStrip snap={snap} liveId={liveId} />
      <Toolbar
        active={active}
        onGoLive={goLive}
        onTheater={() => void enterTheater()}
        onSettings={openSettings}
        bookmarkable={bookmarkable}
        isBookmarked={isBookmarked}
        onToggleBookmark={toggleBookmark}
      />
      {bookmarks.length > 0 && (
        <BookmarksBar bookmarks={bookmarks} onOpen={openBookmark} onRemove={removeBookmark} />
      )}
      <div className="flex min-h-0 flex-1">
        <ContentArea
          hasPage={!!active && active.url !== '' && active.url !== 'about:blank'}
          isLive={!!active && active.id === liveId}
        />
        {panelOpen && (
          <GoLivePanel
            profile={profile}
            setProfile={setProfile}
            normalize={normalize}
            setNormalize={setNormalize}
            streaming={liveId !== null}
            discord={discord}
            onGuide={openGuide}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

function TabStrip({ snap, liveId }: { snap: TabsSnapshot; liveId: string | null }): JSX.Element {
  return (
    <div
      className="drag flex items-end gap-1 pl-2 pt-2"
      style={{ background: 'var(--si-bg)', paddingRight: 146, minHeight: 40 }}
    >
      {snap.tabs.map((t) => {
        const active = t.id === snap.activeId
        return (
          <div
            key={t.id}
            onClick={() => api?.tabs.activate(t.id)}
            className="no-drag flex max-w-[210px] cursor-default items-center gap-2 rounded-t-lg px-3 py-2"
            style={{
              background: active ? 'var(--si-raised)' : 'transparent',
              color: active ? 'var(--si-text)' : 'var(--si-text-faint)'
            }}
          >
            {t.id === liveId ? (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--si-danger)' }} title="Live tab" />
            ) : t.muted ? (
              <span className="shrink-0" style={{ color: 'var(--si-text-faint)' }} title="Muted — not the live tab">
                <VolumeX size={13} />
              </span>
            ) : t.favicon ? (
              <img src={t.favicon} width={14} height={14} alt="" className="shrink-0" style={{ borderRadius: 2 }} />
            ) : !t.url || t.url === 'about:blank' ? (
              <span className="shrink-0">
                <StreamItMark size={14} />
              </span>
            ) : (
              <span className="shrink-0 opacity-70">
                <Globe size={13} />
              </span>
            )}
            <span className="truncate text-[13px]">{t.title || 'New tab'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                api?.tabs.close(t.id)
              }}
              style={{ color: 'var(--si-text-faint)' }}
              aria-label="Close tab"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
      <button
        onClick={() => api?.tabs.create()}
        className="no-drag p-1.5"
        style={{ color: 'var(--si-text-faint)' }}
        title="New tab"
        aria-label="New tab"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

function Toolbar({
  active,
  onGoLive,
  onTheater,
  onSettings,
  bookmarkable,
  isBookmarked,
  onToggleBookmark
}: {
  active: TabsSnapshot['tabs'][number] | null
  onGoLive: () => void
  onTheater: () => void
  onSettings: () => void
  bookmarkable: boolean
  isBookmarked: boolean
  onToggleBookmark: () => void
}): JSX.Element {
  const [address, setAddress] = useState('')
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setAddress(active?.url ?? '')
  }, [active?.url, active?.id])

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (active) api?.tabs.navigate(active.id, address)
    ;(document.activeElement as HTMLElement)?.blur()
  }

  const canBack = active?.canGoBack ?? false
  const canFwd = active?.canGoForward ?? false

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2"
      style={{ background: 'var(--si-raised)', borderBottom: '1px solid var(--si-divider)' }}
    >
      <button
        onClick={() => active && api?.tabs.back(active.id)}
        disabled={!canBack}
        style={{ color: canBack ? 'var(--si-text-dim)' : 'var(--si-active)' }}
        aria-label="Back"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => active && api?.tabs.forward(active.id)}
        disabled={!canFwd}
        style={{ color: canFwd ? 'var(--si-text-dim)' : 'var(--si-active)' }}
        aria-label="Forward"
      >
        <ChevronRight size={18} />
      </button>
      <button
        onClick={() => active && api?.tabs.reload(active.id)}
        style={{ color: 'var(--si-text-dim)' }}
        aria-label="Reload"
      >
        <Refresh size={16} />
      </button>
      <button
        onClick={() => api?.openFileDialog()}
        style={{ color: 'var(--si-text-dim)' }}
        title="Open local video (Ctrl+O)"
        aria-label="Open file"
      >
        <FolderOpen size={16} />
      </button>
      <form onSubmit={submit} className="flex flex-1 items-center gap-2 rounded-md px-3 py-1.5" style={{ background: 'var(--si-bg)' }}>
        <span style={{ color: active?.url.startsWith('https') ? 'var(--si-online)' : 'var(--si-text-faint)' }}>
          <Lock size={13} />
        </span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onFocus={(e) => {
            focused.current = true
            e.target.select()
          }}
          onBlur={() => {
            focused.current = false
            setAddress(active?.url ?? '')
          }}
          placeholder="Search or enter address"
          spellCheck={false}
          className="flex-1 bg-transparent text-[13px] outline-none"
          style={{ color: 'var(--si-text-dim)' }}
        />
        <button
          type="button"
          onClick={onToggleBookmark}
          disabled={!bookmarkable}
          className="shrink-0"
          style={{
            color: isBookmarked ? 'var(--si-warn)' : 'var(--si-text-faint)',
            opacity: bookmarkable ? 1 : 0.4,
            cursor: bookmarkable ? 'pointer' : 'default'
          }}
          title={isBookmarked ? 'Remove bookmark (Ctrl+D)' : 'Bookmark this page (Ctrl+D)'}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
        >
          <Star size={15} filled={isBookmarked} />
        </button>
      </form>
      <Button variant="primary" size="sm" onPress={onGoLive} className="gap-1.5" style={{ background: 'var(--si-blurple)', color: '#fff' }}>
        <Share size={16} />
        Go Live
      </Button>
      <button onClick={onTheater} style={{ color: 'var(--si-text-dim)' }} title="Theater mode (F)" aria-label="Theater mode">
        <Theater size={17} />
      </button>
      <button onClick={onSettings} style={{ color: 'var(--si-text-dim)' }} title="Settings" aria-label="Settings">
        <Settings size={17} />
      </button>
    </div>
  )
}

function BookmarksBar({
  bookmarks,
  onOpen,
  onRemove
}: {
  bookmarks: Bookmark[]
  onOpen: (url: string) => void
  onRemove: (url: string) => void
}): JSX.Element {
  return (
    <div
      className="flex items-center gap-1 overflow-x-auto px-2 py-1"
      style={{ background: 'var(--si-raised)', borderBottom: '1px solid var(--si-divider)' }}
    >
      {bookmarks.map((b) => (
        <div
          key={b.url}
          className="group flex shrink-0 items-center gap-1.5 rounded-md py-1 pl-2 pr-1"
          style={{ color: 'var(--si-text-dim)' }}
          title={b.url}
        >
          <button
            onClick={() => onOpen(b.url)}
            className="flex items-center gap-1.5 text-[12px]"
            style={{ color: 'inherit', maxWidth: 160 }}
          >
            {b.favicon ? (
              <img src={b.favicon} width={14} height={14} alt="" className="shrink-0" style={{ borderRadius: 2 }} />
            ) : (
              <span className="shrink-0 opacity-70">
                <Globe size={13} />
              </span>
            )}
            <span className="truncate">{b.title || b.url}</span>
          </button>
          <button
            onClick={() => onRemove(b.url)}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--si-text-faint)' }}
            title="Remove bookmark"
            aria-label="Remove bookmark"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

function ContentArea({ hasPage, isLive }: { hasPage: boolean; isLive: boolean }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useReportBounds(ref)
  return (
    <div
      ref={ref}
      className="relative flex flex-1 flex-col items-center justify-center gap-3.5"
      style={{
        background: '#000',
        color: '#72767d',
        borderRight: '1px solid var(--si-divider)',
        // The broadcast frame gets a live-tinted top edge so it reads as distinct
        // from the private chrome around it (docs/DECISIONS.md D8).
        borderTop: isLive ? '2px solid var(--si-danger)' : '2px solid transparent',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)'
      }}
    >
      {isLive && (
        <div
          className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ background: 'rgba(242,63,67,0.15)', color: 'var(--si-danger)' }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--si-danger)' }} /> broadcasting this tab
        </div>
      )}
      {!hasPage && (
        <>
          <Play size={46} />
          <span className="text-[13px]">content area — the frame friends see</span>
          <span className="text-[11px]" style={{ color: '#5c5c63' }}>
            drop a video here, or press Ctrl+O to open a file
          </span>
          <div
            className="absolute bottom-3.5 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px]"
            style={{ background: 'rgba(30,31,34,0.85)', color: '#dbdee1' }}
          >
            <Theater size={13} /> press F for theater — hides all chrome
          </div>
        </>
      )}
    </div>
  )
}

function GoLivePanel({
  profile,
  setProfile,
  normalize,
  setNormalize,
  streaming,
  discord,
  onGuide,
  onClose
}: {
  profile: string
  setProfile: (p: (typeof PROFILES)[number]) => void
  normalize: boolean
  setNormalize: (v: boolean) => void
  streaming: boolean
  discord: DiscordStatus
  onGuide: () => void
  onClose: () => void
}): JSX.Element {
  const connected = discord.connected
  const name = connected
    ? discord.user?.global_name || discord.user?.username || 'Discord user'
    : 'Not connected'
  const tier = tierInfo(discord.user?.premium_type)
  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-4 p-3.5" style={{ background: 'var(--si-surface)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--si-text-faint)' }}>
          Go Live
        </span>
        <button onClick={onClose} style={{ color: 'var(--si-text-faint)' }} aria-label="Close panel">
          <X size={15} />
        </button>
      </div>

      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--si-blurple)', color: '#fff' }}>
            <Discord size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-medium" style={{ color: 'var(--si-text)' }}>
              {name}
            </span>
            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: connected ? 'var(--si-online)' : 'var(--si-text-faint)' }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: connected ? 'var(--si-online)' : 'var(--si-text-faint)' }}
              />
              {connected ? 'connected' : 'not connected'}
            </span>
          </div>
        </div>
        <div className="rounded-md p-2.5 text-[12px]" style={{ background: 'var(--si-bg)', color: 'var(--si-text-dim)' }}>
          <span className="flex items-center gap-1.5">
            <Discord size={13} />{' '}
            {connected ? 'Showing your activity on Discord' : 'Open Discord to show your activity'}
          </span>
          <Button
            variant="primary"
            fullWidth
            size="sm"
            className="mt-2"
            onPress={onGuide}
            style={{ background: streaming ? 'var(--si-online)' : 'var(--si-blurple)', color: '#fff' }}
          >
            {streaming ? 'Streaming this tab' : 'Stream StreamIt'}
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--si-text-faint)' }}>
            Capture profile
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{
              background: tier.warn ? 'rgba(240,178,50,0.15)' : 'rgba(35,165,90,0.15)',
              color: tier.warn ? 'var(--si-warn)' : 'var(--si-online)'
            }}
          >
            {tier.badge}
          </span>
        </div>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {PROFILES.map((p) => {
            const on = p === profile
            return (
              <button
                key={p}
                onClick={() => setProfile(p)}
                className="rounded-md px-2 py-1 text-[11px]"
                style={{ background: on ? 'var(--si-blurple)' : 'var(--si-bg)', color: on ? '#fff' : 'var(--si-text-dim)' }}
              >
                {p}
              </button>
            )
          })}
        </div>
        <div
          className="flex gap-2 rounded-md p-2.5"
          style={{ background: tier.warn ? 'rgba(240,178,50,0.1)' : 'rgba(35,165,90,0.1)' }}
        >
          <span className="mt-0.5 shrink-0" style={{ color: tier.warn ? 'var(--si-warn)' : 'var(--si-online)' }}>
            <Alert size={14} />
          </span>
          <span className="text-[11px] leading-relaxed" style={{ color: tier.warn ? '#e8b866' : '#7fce9f' }}>
            Friends see{' '}
            <span style={{ color: tier.warn ? 'var(--si-warn)' : 'var(--si-online)', fontWeight: 500 }}>
              {tier.delivers}
            </span>
            {tier.warn ? '. Fast scenes will blur at your tier.' : '.'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--si-text-faint)' }}>
          Audio
        </span>
        <button
          onClick={() => {
            const next = !normalize
            setNormalize(next)
            api?.setNormalize(next)
          }}
          className="flex items-center justify-between text-[12px]"
          style={{ color: 'var(--si-text-dim)' }}
        >
          <span className="flex items-center gap-1.5">
            <Adjustments size={15} />
            <span className="flex flex-col items-start leading-tight">
              <span>Normalize loudness</span>
              <span style={{ fontSize: 10, color: 'var(--si-text-faint)' }}>Local files only</span>
            </span>
          </span>
          <span className="relative h-5 w-9 rounded-full transition-colors" style={{ background: normalize ? 'var(--si-online)' : 'var(--si-active)' }}>
            <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: normalize ? '18px' : '2px' }} />
          </span>
        </button>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#72767d' }}>
          <BellOff size={14} /> System sounds excluded from stream
        </div>
      </div>
    </aside>
  )
}

function GuidedGoLive({ onClose }: { onClose: () => void }): JSX.Element {
  const steps = [
    'In Discord, join a voice channel with your friends.',
    'Click the “Screen” / Go Live button in Discord’s voice panel.',
    'Pick the StreamIt window as your source.',
    'Back here, press F for theater mode — a clean, chrome-free frame.'
  ]
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8" style={{ background: 'var(--si-bg)' }}>
      <StreamItMark size={56} />
      <div className="text-center">
        <div className="text-[18px] font-medium" style={{ color: 'var(--si-text)' }}>
          Go Live with StreamIt
        </div>
        <div className="mt-1.5 text-[13px]" style={{ color: 'var(--si-text-faint)', maxWidth: 420 }}>
          Discord doesn’t let apps start a stream for you, so this last step is manual — but StreamIt makes it a clean one-tap source.
        </div>
      </div>
      <ol className="flex w-full max-w-[440px] flex-col gap-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium"
              style={{ background: 'var(--si-blurple)', color: '#fff' }}
            >
              {i + 1}
            </span>
            <span className="pt-0.5 text-[13px] leading-relaxed" style={{ color: 'var(--si-text-dim)' }}>
              {s}
            </span>
          </li>
        ))}
      </ol>
      <Button variant="primary" onPress={onClose} style={{ background: 'var(--si-blurple)', color: '#fff' }}>
        Got it
      </Button>
    </div>
  )
}

function TheaterView({
  onExit,
  lockedRes
}: {
  onExit: () => void
  lockedRes: { width: number; height: number } | null
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useReportBounds(ref)
  return (
    <div ref={ref} className="relative flex h-full items-center justify-center" style={{ background: '#000' }}>
      <div className="flex flex-col items-center gap-3" style={{ color: '#4a4a4f' }}>
        <Play size={52} />
        <span className="text-[13px]">full-bleed content · zero chrome · pure broadcast frame</span>
      </div>
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: 'rgba(30,31,34,0.8)' }}>
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--si-danger)' }} />
        <span className="text-[12px] font-medium" style={{ color: 'var(--si-text)' }}>
          LIVE
        </span>
        {lockedRes && (
          <span className="text-[12px]" style={{ color: 'var(--si-text-dim)' }}>
            · {lockedRes.width}×{lockedRes.height}
          </span>
        )}
      </div>
      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: 'rgba(30,31,34,0.92)' }}>
        <div className="flex items-center gap-4" style={{ color: 'var(--si-text)' }}>
          <Play size={20} />
          <Headphones size={17} />
          <span className="text-[11px]" style={{ color: 'var(--si-text-dim)' }}>
            tab audio · normalized
          </span>
        </div>
        <div className="flex items-center gap-4" style={{ color: 'var(--si-text-dim)' }}>
          <button onClick={onExit} className="text-[11px]" style={{ color: '#72767d' }}>
            press F to exit theater
          </button>
          <Settings size={16} />
          <Maximize size={16} />
        </div>
      </div>
    </div>
  )
}
