import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  TabsSnapshot,
  Bounds,
  Settings,
  DiscordStatus,
  UpdateState,
  Bookmark
} from '../shared/types'

const api = {
  platform: process.platform,

  /** Installed app version (from package.json / the built app). */
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', patch),

  /** Open a native file picker for local video; returns how many were opened. */
  openFileDialog: (): Promise<number> => ipcRenderer.invoke('dialog:openFile'),
  /** Resolve the absolute path of a dropped File (Electron removed File.path). */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  /** Broadcast loudness-normalization on/off to local-media player tabs. */
  setNormalize: (on: boolean): void => ipcRenderer.send('normalize:setAll', on),

  tabs: {
    get: (): Promise<TabsSnapshot> => ipcRenderer.invoke('tabs:get'),
    ready: (): void => ipcRenderer.send('tabs:ready'),
    create: (url?: string): void => ipcRenderer.send('tabs:create', url),
    close: (id: string): void => ipcRenderer.send('tabs:close', id),
    activate: (id: string): void => ipcRenderer.send('tabs:activate', id),
    navigate: (id: string, url: string): void =>
      ipcRenderer.send('tabs:navigate', { id, url }),
    back: (id: string): void => ipcRenderer.send('tabs:back', id),
    forward: (id: string): void => ipcRenderer.send('tabs:forward', id),
    reload: (id: string): void => ipcRenderer.send('tabs:reload', id),
    setLive: (id: string | null): void => ipcRenderer.send('tabs:setLive', id),
    openFile: (filePath: string): void => ipcRenderer.send('tabs:openFile', filePath),
    onSync: (cb: (snapshot: TabsSnapshot) => void): (() => void) => {
      const handler = (_e: unknown, snapshot: TabsSnapshot): void => cb(snapshot)
      ipcRenderer.on('tabs:sync', handler)
      return () => ipcRenderer.removeListener('tabs:sync', handler)
    }
  },

  view: {
    setBounds: (bounds: Bounds): void => ipcRenderer.send('view:setBounds', bounds),
    setHidden: (hidden: boolean): void => ipcRenderer.send('view:setHidden', hidden)
  },

  bookmarks: {
    list: (): Promise<Bookmark[]> => ipcRenderer.invoke('bookmarks:get'),
    add: (b: Bookmark): Promise<Bookmark[]> => ipcRenderer.invoke('bookmarks:add', b),
    remove: (url: string): Promise<Bookmark[]> => ipcRenderer.invoke('bookmarks:remove', url)
  },

  theater: {
    enter: (opts: { profile: string; aspect: string }): Promise<{ width: number; height: number }> =>
      ipcRenderer.invoke('theater:enter', opts),
    exit: (): void => ipcRenderer.send('theater:exit')
  },

  discord: {
    get: (): Promise<DiscordStatus> => ipcRenderer.invoke('discord:get'),
    onStatus: (cb: (status: DiscordStatus) => void): (() => void) => {
      const handler = (_e: unknown, status: DiscordStatus): void => cb(status)
      ipcRenderer.on('discord:status', handler)
      return () => ipcRenderer.removeListener('discord:status', handler)
    }
  },

  updates: {
    get: (): Promise<UpdateState> => ipcRenderer.invoke('update:get'),
    /** Kick off a manual check; resolves with the state at call time. */
    check: (): Promise<UpdateState> => ipcRenderer.invoke('update:check'),
    /** Relaunch into the downloaded update (only valid when state is 'ready'). */
    install: (): void => ipcRenderer.send('update:install'),
    onState: (cb: (state: UpdateState) => void): (() => void) => {
      const handler = (_e: unknown, state: UpdateState): void => cb(state)
      ipcRenderer.on('update:state', handler)
      return () => ipcRenderer.removeListener('update:state', handler)
    }
  }
}

contextBridge.exposeInMainWorld('streamit', api)

export type StreamItApi = typeof api
