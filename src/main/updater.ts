import { app, ipcMain, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateState } from '../shared/types'

const { autoUpdater } = electronUpdater

// One shared state object the renderer mirrors; drives the Settings → About UI.
let state: UpdateState = app.isPackaged ? { status: 'idle' } : { status: 'unsupported' }
let getWindow: (() => BrowserWindow | null) | null = null

function push(next: UpdateState): void {
  state = next
  getWindow?.()?.webContents.send('update:state', state)
}

/** Wire electron-updater to our state channel and register IPC. Safe to call in
 *  dev — it just reports 'unsupported' and never touches the network. */
export function initUpdater(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter

  ipcMain.handle('update:get', () => state)
  ipcMain.handle('update:check', () => {
    void checkForUpdates(true)
    return state
  })
  ipcMain.on('update:install', () => {
    if (state.status === 'ready') autoUpdater.quitAndInstall()
  })

  if (!app.isPackaged) return

  // Background-download the update, but let the user choose when to relaunch.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => push({ status: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    push({ status: 'available', version: info.version })
  )
  autoUpdater.on('update-not-available', () => push({ status: 'current' }))
  autoUpdater.on('download-progress', (p) =>
    push({ status: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => push({ status: 'ready', version: info.version }))
  autoUpdater.on('error', (err) =>
    push({ status: 'error', message: err?.message ?? 'update failed' })
  )

  // Check shortly after launch, then every 6 hours.
  setTimeout(() => void checkForUpdates(false), 8_000)
  setInterval(() => void checkForUpdates(false), 6 * 60 * 60 * 1000)
}

/** `manual` = user pressed the button (surface errors even when offline). */
async function checkForUpdates(manual: boolean): Promise<void> {
  if (!app.isPackaged) return
  // Don't interrupt an in-flight download/ready state on the periodic timer.
  if (!manual && (state.status === 'downloading' || state.status === 'ready')) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    push({ status: 'error', message: err instanceof Error ? err.message : 'update check failed' })
  }
}
