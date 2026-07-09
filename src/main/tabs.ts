import { WebContentsView, net, type BrowserWindow, type WebContents } from 'electron'
import { join } from 'path'
import { allowMediaFile } from './protocol'
import type { TabState, TabsSnapshot, Bounds } from '../shared/types'

const faviconCache = new Map<string, string>()

let counter = 0
const nextId = (): string => `tab-${++counter}`

/** Turn address-bar input into a real URL: pass URLs through, otherwise search. */
function normalizeInput(input: string): string {
  const s = input.trim()
  if (!s) return 'about:blank'
  // Magnet links open the torrent landing page instead of navigating.
  if (/^magnet:\?/i.test(s)) {
    return `streamit://app/torrent.html?uri=${encodeURIComponent(s)}`
  }
  if (/^[a-z]+:\/\//i.test(s) || s === 'about:blank') return s
  const looksLikeDomain = !s.includes(' ') && /^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(s)
  if (looksLikeDomain) return `https://${s}`
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`
}

function destroyWebContents(wc: WebContents): void {
  const destroyable = wc as unknown as { destroy?: () => void }
  destroyable.destroy?.()
}

/**
 * Owns one WebContentsView per tab and layers the active one over the content
 * region the renderer reports. The renderer is the chrome; these views are the
 * actual web pages (see docs/ARCHITECTURE.md).
 */
export class TabManager {
  private readonly win: BrowserWindow
  private readonly views = new Map<string, WebContentsView>()
  private order: string[] = []
  private activeId: string | null = null
  private liveId: string | null = null
  private bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 }
  private hidden = false
  private normalize = true
  private readonly favicons = new Map<string, string>()
  private readonly aspects = new Map<number, number>()

  /** Called on every state change (used to keep Discord presence in sync). */
  onUpdate: ((snapshot: TabsSnapshot) => void) | null = null
  /** Called when the live/broadcast tab is set or cleared (true = now live). */
  onLiveChange: ((isLive: boolean) => void) | null = null

  constructor(win: BrowserWindow) {
    this.win = win
  }

  /** Title of the live/broadcast tab, or null when not streaming. */
  liveTitle(): string | null {
    if (!this.liveId) return null
    const wc = this.views.get(this.liveId)?.webContents
    return wc ? wc.getTitle() || 'something' : null
  }

  count(): number {
    return this.views.size
  }

  snapshot(): TabsSnapshot {
    const tabs: TabState[] = this.order.map((id) => {
      const wc = this.views.get(id)!.webContents
      return {
        id,
        title: wc.getTitle() || 'New tab',
        url: wc.getURL(),
        loading: wc.isLoadingMainFrame(),
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
        muted: wc.isAudioMuted(),
        favicon: this.favicons.get(id) ?? null
      }
    })
    return { tabs, activeId: this.activeId }
  }

  /** Aspect ratio (w/h) of the live tab's video, for "Match content" theater. */
  liveAspect(): number | null {
    if (!this.liveId) return null
    const wc = this.views.get(this.liveId)?.webContents
    return wc ? this.aspects.get(wc.id) ?? null : null
  }

  setVideoAspect(webContentsId: number, ratio: number): void {
    if (ratio > 0) this.aspects.set(webContentsId, ratio)
  }

  private async resolveFavicon(id: string, url: string): Promise<void> {
    if (!/^https?:/i.test(url)) return
    let dataUrl = faviconCache.get(url)
    if (!dataUrl) {
      try {
        const res = await net.fetch(url)
        if (!res.ok) return
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length === 0 || buf.length > 200_000) return
        dataUrl = `data:${res.headers.get('content-type') || 'image/png'};base64,${buf.toString('base64')}`
        faviconCache.set(url, dataUrl)
      } catch {
        return
      }
    }
    if (!this.views.has(id)) return
    this.favicons.set(id, dataUrl)
    this.emit()
  }

  /** Only the live/broadcast tab makes sound; everything else is muted so it
   *  can't leak into the stream. No live tab = normal browsing, nothing muted. */
  private applyAudio(): void {
    for (const [id, view] of this.views) {
      view.webContents.setAudioMuted(this.liveId !== null && id !== this.liveId)
    }
  }

  setLiveTab(id: string | null): void {
    const next = id && this.views.has(id) ? id : null
    const changed = (this.liveId === null) !== (next === null)
    this.liveId = next
    this.applyAudio()
    if (changed) this.onLiveChange?.(next !== null)
    this.emit()
  }

  private emit(): void {
    if (this.win.isDestroyed()) return
    const snapshot = this.snapshot()
    this.win.webContents.send('tabs:sync', snapshot)
    this.onUpdate?.(snapshot)
  }

  create(input?: string): string {
    const id = nextId()
    const view = new WebContentsView({
      // backgroundThrottling: false keeps the page painting when StreamIt is
      // unfocused/occluded, so the video stays live in Discord's capture while
      // you interact with Discord to Go Live (see main/index.ts occlusion note).
      // tab.js captures in-page file drops and opens them as new tabs.
      webPreferences: {
        preload: join(__dirname, '../preload/tab.js'),
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false
      }
    })
    const wc = view.webContents
    const update = (): void => this.emit()
    wc.on('page-title-updated', update)
    wc.on('did-navigate', () => {
      this.favicons.delete(id) // clear the old page's icon while the new one loads
      update()
    })
    wc.on('did-navigate-in-page', update)
    wc.on('did-start-loading', update)
    wc.on('did-stop-loading', update)
    wc.on('page-favicon-updated', (_e, favicons) => {
      if (favicons[0]) void this.resolveFavicon(id, favicons[0])
    })
    wc.setWindowOpenHandler(({ url }) => {
      this.create(url)
      return { action: 'deny' }
    })

    this.views.set(id, view)
    this.order.push(id)
    void wc.loadURL(normalizeInput(input ?? 'about:blank')).catch(() => {})
    this.activate(id)
    this.applyAudio()
    return id
  }

  activate(id: string): void {
    if (!this.views.has(id) || this.activeId === id) {
      if (this.activeId === id) this.emit()
      return
    }
    if (this.activeId && !this.hidden) {
      const current = this.views.get(this.activeId)
      if (current) this.win.contentView.removeChildView(current)
    }
    const view = this.views.get(id)!
    this.activeId = id
    if (!this.hidden) {
      this.win.contentView.addChildView(view)
      view.setBounds(this.bounds)
    }
    this.emit()
  }

  /** Detach the active page so a renderer overlay (settings) is visible. */
  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return
    this.hidden = hidden
    const view = this.activeId ? this.views.get(this.activeId) : undefined
    if (!view) return
    if (hidden) {
      this.win.contentView.removeChildView(view)
    } else {
      this.win.contentView.addChildView(view)
      view.setBounds(this.bounds)
    }
  }

  close(id: string): void {
    const view = this.views.get(id)
    if (!view) return
    if (this.activeId === id) this.win.contentView.removeChildView(view)
    this.aspects.delete(view.webContents.id)
    this.favicons.delete(id)
    destroyWebContents(view.webContents)
    this.views.delete(id)
    this.order = this.order.filter((x) => x !== id)
    if (this.liveId === id) this.liveId = null
    if (this.activeId === id) {
      this.activeId = null
      const next = this.order[this.order.length - 1]
      if (next) this.activate(next)
    }
    this.emit()
  }

  navigate(id: string, input: string): void {
    const view = this.views.get(id)
    if (view) void view.webContents.loadURL(normalizeInput(input)).catch(() => {})
  }

  /** Open a local video in a new tab through the StreamIt player (served
   *  same-origin with the media so loudness normalization isn't taint-silenced).
   *  A .torrent file opens the torrent landing page instead. */
  openFile(filePath: string): void {
    allowMediaFile(filePath)
    if (/\.torrent$/i.test(filePath)) {
      this.create(`streamit://app/torrent.html?file=${encodeURIComponent(filePath)}`)
    } else {
      this.create(`streamit://app/player.html?src=${encodeURIComponent(filePath)}`)
    }
  }

  setNormalize(on: boolean): void {
    this.normalize = on
    for (const view of this.views.values()) view.webContents.send('normalize:set', on)
  }

  getNormalize(): boolean {
    return this.normalize
  }

  goBack(id: string): void {
    const wc = this.views.get(id)?.webContents
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  goForward(id: string): void {
    const wc = this.views.get(id)?.webContents
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  reload(id: string): void {
    this.views.get(id)?.webContents.reload()
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    if (this.activeId) this.views.get(this.activeId)?.setBounds(bounds)
  }
}
