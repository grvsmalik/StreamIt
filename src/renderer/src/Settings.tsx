import { useEffect, useState, type JSX } from 'react'
import {
  DEFAULT_SETTINGS,
  type Settings,
  type CaptureProfile,
  type TheaterAspect,
  type DiscordStatus
} from '../../shared/types'
import { Sliders, Play, Headphones, Discord, Info, X, Alert } from './icons'
import { StreamItMark } from './Logo'

const api = typeof window !== 'undefined' ? window.streamit : undefined

type Section = 'general' | 'playback' | 'audio' | 'discord' | 'about'

const NAV: { id: Section; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'playback', label: 'Playback', icon: Play },
  { id: 'audio', label: 'Audio', icon: Headphones },
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

          {section === 'about' && (
            <Section title="About">
              <div className="flex items-center gap-3.5">
                <StreamItMark size={56} />
                <div className="text-[13px] leading-relaxed" style={{ color: 'var(--si-text-dim)' }}>
                  <div className="text-[15px] font-medium" style={{ color: 'var(--si-text)' }}>
                    StreamIt <span style={{ color: 'var(--si-text-faint)', fontWeight: 400 }}>0.1.0</span>
                  </div>
                  A browser for watching non-DRM and personal media with friends over Discord.
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
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
