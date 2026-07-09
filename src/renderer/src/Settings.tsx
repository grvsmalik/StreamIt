import { useEffect, useState, type JSX } from 'react'
import {
  DEFAULT_SETTINGS,
  type Settings,
  type CaptureProfile,
  type TheaterAspect,
  type DiscordStatus,
  type UpdateState
} from '../../shared/types'
import { Sliders, Play, Headphones, Discord, Info, X, Alert, Magnet, Refresh } from './icons'
import { StreamItMark } from './Logo'

const api = typeof window !== 'undefined' ? window.streamit : undefined

type Section = 'general' | 'playback' | 'audio' | 'torrents' | 'discord' | 'about'

const NAV: { id: Section; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'playback', label: 'Playback', icon: Play },
  { id: 'audio', label: 'Audio', icon: Headphones },
  { id: 'torrents', label: 'Torrents', icon: Magnet },
  { id: 'discord', label: 'Discord', icon: Discord },
  { id: 'about', label: 'About', icon: Info }
]

const PROFILES: CaptureProfile[] = ['Match content', 'Fast motion', 'Movie']
const ASPECTS: TheaterAspect[] = ['Match', '16:9', '21:9', 'Vertical']

export function SettingsScreen({ onClose }: { onClose: () => void }): JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [section, setSection] = useState<Section>('general')
  const [hwaChanged, setHwaChanged] = useState(false)
  const [discord, setDiscord] = useState<DiscordStatus>({ connected: false, user: null })

  useEffect(() => {
    void api?.getSettings().then(setSettings)
    void api?.discord.get().then(setDiscord)
    return api?.discord.onStatus(setDiscord)
  }, [])

  const patch = (p: Partial<Settings>): void => {
    setSettings((s) => ({ ...s, ...p }))
    api?.setSettings(p)
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'var(--si-bg)' }}>
      <header
        className="drag flex items-center justify-between py-3 pl-5"
        style={{ paddingRight: 146, borderBottom: '1px solid var(--si-divider)' }}
      >
        <span className="text-[15px] font-medium" style={{ color: 'var(--si-text)' }}>
          Settings
        </span>
        <button onClick={onClose} className="no-drag" style={{ color: 'var(--si-text-dim)' }} aria-label="Close settings">
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[168px] shrink-0 flex-col gap-0.5 p-2" style={{ background: 'var(--si-surface)' }}>
          {NAV.map((n) => {
            const on = n.id === section
            const Icon = n.icon
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px]"
                style={{ background: on ? 'var(--si-active)' : 'transparent', color: on ? 'var(--si-text)' : 'var(--si-text-dim)' }}
              >
                <Icon size={16} />
                {n.label}
              </button>
            )
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-6">
          {section === 'general' && (
            <Section title="General">
              <Row
                label="Block ads and trackers"
                hint="Uses uBlock Origin's filter lists to block ads and trackers before they load — so no ads show up in your stream. Applies to all tabs."
              >
                <Toggle on={settings.adBlock} onChange={(v) => patch({ adBlock: v })} />
              </Row>
              <Row label="Home / new-tab page" hint="Where new tabs open.">
                <input
                  value={settings.homeUrl}
                  onChange={(e) => patch({ homeUrl: e.target.value })}
                  spellCheck={false}
                  className="rounded-md px-3 py-1.5 text-[13px] outline-none"
                  style={{ background: 'var(--si-surface)', color: 'var(--si-text)', minWidth: 240, border: '1px solid var(--si-divider)' }}
                />
              </Row>
            </Section>
          )}

          {section === 'playback' && (
            <Section title="Playback">
              <Row
                label="Hardware acceleration"
                hint="Uses your GPU to render pages. Turn off to fix rendering glitches, driver crashes, or to save laptop battery. Restart required to apply."
              >
                <Toggle
                  on={settings.hardwareAcceleration}
                  onChange={(v) => {
                    patch({ hardwareAcceleration: v })
                    setHwaChanged(true)
                  }}
                />
              </Row>
              {hwaChanged && (
                <div className="mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-[12px]" style={{ background: 'rgba(240,178,50,0.1)', color: 'var(--si-warn)' }}>
                  <Alert size={14} /> Restart StreamIt for this to take effect.
                </div>
              )}
              <Row label="Default capture profile" hint="Applied to new streams. Override per session in the Go Live panel.">
                <Chips options={PROFILES} value={settings.defaultProfile} onChange={(v) => patch({ defaultProfile: v })} />
              </Row>
              <Row label="Theater aspect" hint="Match the content, or lock to a fixed shape.">
                <Chips options={ASPECTS} value={settings.theaterAspect} onChange={(v) => patch({ theaterAspect: v })} />
              </Row>
            </Section>
          )}

          {section === 'audio' && (
            <Section title="Audio">
              <Placeholder>
                Live audio controls (volume, loudness normalization) are in the Go Live panel for now. System sounds are always excluded from the stream.
              </Placeholder>
            </Section>
          )}

          {section === 'torrents' && (
            <Section title="Torrents">
              <Row
                label="Keep downloaded files"
                hint="Off (default): torrent downloads are stored temporarily and discarded when you quit StreamIt. On: files are kept so you can rewatch or keep seeding."
              >
                <Toggle
                  on={settings.torrentKeepFiles}
                  onChange={(v) => patch({ torrentKeepFiles: v })}
                />
              </Row>
              <Row
                label="Upload speed limit"
                hint="How fast StreamIt seeds to other peers while not broadcasting. Uploads are automatically paused during Go Live so seeding never starves your stream."
              >
                <NumberField
                  value={settings.torrentUploadKBs}
                  min={1}
                  max={100000}
                  suffix="KB/s"
                  onChange={(v) => patch({ torrentUploadKBs: v })}
                />
              </Row>
              <Placeholder>
                Paste a magnet link in the address bar, or open a .torrent file, to
                start a watch party. You are responsible for the content you download,
                view, and stream.
              </Placeholder>
            </Section>
          )}

          {section === 'discord' && (
            <Section title="Discord">
              <div className="mb-5 flex items-center gap-2 text-[13px]" style={{ color: 'var(--si-text-dim)' }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: discord.connected ? 'var(--si-online)' : 'var(--si-text-faint)' }} />
                {discord.connected
                  ? `Connected as ${discord.user?.global_name || discord.user?.username || 'Discord user'}`
                  : 'Not connected'}
              </div>
              <Row
                label="Application client ID"
                hint="Optional. StreamIt ships with its own Discord app, so Rich Presence just works when Discord is running. Only set this to point at your own app."
              >
                <input
                  value={settings.discordClientId}
                  onChange={(e) => patch({ discordClientId: e.target.value.trim() })}
                  placeholder="Using StreamIt's built-in app"
                  spellCheck={false}
                  className="rounded-md px-3 py-1.5 text-[13px] outline-none"
                  style={{ background: 'var(--si-surface)', color: 'var(--si-text)', minWidth: 240, border: '1px solid var(--si-divider)' }}
                />
              </Row>
              <Placeholder>
                Seeing which friends are in a voice channel needs Discord's whitelist-only voice scope, so it's not available yet. Rich Presence works today.
              </Placeholder>
            </Section>
          )}

          {section === 'about' && <About />}
        </div>
      </div>
    </div>
  )
}

function About(): JSX.Element {
  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    void api?.getVersion().then(setVersion)
    void api?.updates.get().then(setUpdate)
    return api?.updates.onState(setUpdate)
  }, [])

  const busy = update.status === 'checking' || update.status === 'downloading'

  return (
    <Section title="About">
      <div className="mb-6 flex items-center gap-3.5">
        <StreamItMark size={56} />
        <div className="text-[13px] leading-relaxed" style={{ color: 'var(--si-text-dim)' }}>
          <div className="text-[15px] font-medium" style={{ color: 'var(--si-text)' }}>
            StreamIt{' '}
            {version && (
              <span style={{ color: 'var(--si-text-faint)', fontWeight: 400 }}>{version}</span>
            )}
          </div>
          A browser for watching non-DRM and personal media with friends over Discord.
        </div>
      </div>

      <Row label="Updates" hint={updateHint(update)}>
        {update.status === 'ready' ? (
          <button
            onClick={() => api?.updates.install()}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium"
            style={{ background: 'var(--si-blurple)', color: '#fff' }}
          >
            Restart to update
          </button>
        ) : (
          <button
            onClick={() => void api?.updates.check().then(setUpdate)}
            disabled={busy || update.status === 'unsupported'}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px]"
            style={{
              background: 'var(--si-surface)',
              color: 'var(--si-text)',
              border: '1px solid var(--si-divider)',
              opacity: busy || update.status === 'unsupported' ? 0.5 : 1
            }}
          >
            <Refresh size={14} className={busy ? 'si-spin' : undefined} />
            {update.status === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </Row>
    </Section>
  )
}

function updateHint(u: UpdateState): string {
  switch (u.status) {
    case 'unsupported':
      return 'Automatic updates are available in the installed app. This looks like a development build.'
    case 'checking':
      return 'Looking for a newer version…'
    case 'available':
      return `Version ${u.version} is available and downloading in the background.`
    case 'downloading':
      return `Downloading the update… ${u.percent}%`
    case 'ready':
      return `Version ${u.version} is ready. Restart StreamIt to finish updating.`
    case 'current':
      return "You're on the latest version. StreamIt also checks automatically in the background."
    case 'error':
      return `Couldn't check for updates: ${u.message}`
    default:
      return 'StreamIt checks for updates automatically. You can also check now.'
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ maxWidth: 560 }}>
      <h2 className="mb-5 text-[16px] font-medium" style={{ color: 'var(--si-text)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-5 flex items-start justify-between gap-6 pb-5" style={{ borderBottom: '1px solid var(--si-divider)' }}>
      <div style={{ maxWidth: 340 }}>
        <div className="text-[13px]" style={{ color: 'var(--si-text)' }}>
          {label}
        </div>
        {hint && (
          <div className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--si-text-faint)' }}>
            {hint}
          </div>
        )}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button onClick={() => onChange(!on)} aria-label="Toggle" className="relative h-[22px] w-10 rounded-full transition-colors" style={{ background: on ? 'var(--si-blurple)' : 'var(--si-active)' }}>
      <span className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all" style={{ left: on ? '20px' : '2px' }} />
    </button>
  )
}

function NumberField({
  value,
  min,
  max,
  suffix,
  onChange
}: {
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (v: number) => void
}): JSX.Element {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = (): void => {
    const n = Math.round(Number(text))
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
    else setText(String(value))
  }
  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        inputMode="numeric"
        spellCheck={false}
        className="rounded-md px-3 py-1.5 text-right text-[13px] outline-none"
        style={{
          background: 'var(--si-surface)',
          color: 'var(--si-text)',
          width: 88,
          border: '1px solid var(--si-divider)'
        }}
      />
      {suffix && (
        <span className="text-[12px]" style={{ color: 'var(--si-text-faint)' }}>
          {suffix}
        </span>
      )}
    </div>
  )
}

function Chips<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o === value
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className="rounded-md px-2.5 py-1 text-[12px]"
            style={{ background: on ? 'var(--si-blurple)' : 'var(--si-surface)', color: on ? '#fff' : 'var(--si-text-dim)' }}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Placeholder({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-md p-4 text-[13px] leading-relaxed" style={{ background: 'var(--si-surface)', color: 'var(--si-text-dim)' }}>
      {children}
    </div>
  )
}
