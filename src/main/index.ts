import { app, BrowserWindow, ipcMain, dialog, protocol, screen } from 'electron'
import { join } from 'path'
import { loadSettings, saveSettings } from './settings'
import { TabManager } from './tabs'
import { registerStreamitProtocol, STREAMIT_SCHEME } from './protocol'
import { DiscordRPC } from './discord'
import { computeTheaterSize } from './theater'
import { initAdblock, setAdblock } from './adblock'
import { DEFAULT_DISCORD_CLIENT_ID, type Bounds, type DiscordStatus, type Settings } from '../shared/types'

/** User override wins; otherwise StreamIt's own bundled app ID. */
function effectiveClientId(s: Settings): string {
  return s.discordClientId.trim() || DEFAULT_DISCORD_CLIENT_ID
}

// Hardware acceleration must be decided before the app is ready. Standard
// browser setting; see docs/DECISIONS.md D10.
const settings = loadSettings()
if (!settings.hardwareAcceleration) {
  app.disableHardwareAcceleration()
}

// A screen-share source MUST keep painting while it's not the focused window —
// otherwise the moment you click over to Discord to hit Go Live, Chromium marks
// StreamIt occluded/backgrounded and the video goes black. Chromium 120+'s
// native occlusion calculation is the main culprit; these switches keep the
// window and its views rendering when unfocused or covered. (See also
// backgroundThrottling: false on the window and each tab view.)
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

// Local media the user opens should start playing (with audio) without an extra
// click; also lets the player's AudioContext resume for normalization.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// The streamit:// scheme serves the player + local media same-origin; must be
// declared privileged before the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: STREAMIT_SCHEME,
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true }
  }
])

let tabs: TabManager | null = null
let mainWindow: BrowserWindow | null = null
let discord: DiscordRPC | null = null
let theaterRestore: { bounds: Electron.Rectangle; maximized: boolean } | null = null

function updatePresence(): void {
  if (!discord) return
  const title = tabs?.liveTitle()
  discord.setActivity(
    title
      ? {
          details: `Watching ${title}`,
          state: 'on StreamIt',
          instance: false,
          assets: { large_image: 'streamit', large_text: 'StreamIt' }
        }
      : null
  )
}

function initDiscord(clientId: string): void {
  discord?.stop()
  discord = new DiscordRPC(clientId)
  discord.on('status', (status: DiscordStatus) => {
    mainWindow?.webContents.send('discord:status', status)
    updatePresence()
  })
  discord.start()
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#1e1f22',
    autoHideMenuBar: true,
    icon: join(app.getAppPath(), 'build', 'icon.png'),
    // Hide the OS title bar and draw our own Discord-themed one; keep native
    // window controls but tint them to match (Windows/Linux).
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1f22',
      symbolColor: '#b5bac1',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  mainWindow = win
  tabs = new TabManager(win)
  tabs.onUpdate = () => updatePresence()

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:set', (_e, patch) => {
    const next = saveSettings(patch)
    if (patch && 'discordClientId' in patch) initDiscord(effectiveClientId(next))
    if (patch && 'adBlock' in patch) setAdblock(next.adBlock)
    return next
  })

  ipcMain.handle('discord:get', () => discord?.status() ?? { connected: false, user: null })

  ipcMain.handle('tabs:get', () => tabs?.snapshot() ?? { tabs: [], activeId: null })
  // The renderer signals readiness after subscribing, so the first tab's sync
  // is never dropped in a startup race.
  ipcMain.on('tabs:ready', () => {
    if (tabs && tabs.count() === 0) tabs.create(loadSettings().homeUrl)
  })
  ipcMain.on('tabs:create', (_e, url?: string) => tabs?.create(url))
  ipcMain.on('tabs:close', (_e, id: string) => tabs?.close(id))
  ipcMain.on('tabs:activate', (_e, id: string) => tabs?.activate(id))
  ipcMain.on('tabs:navigate', (_e, arg: { id: string; url: string }) =>
    tabs?.navigate(arg.id, arg.url)
  )
  ipcMain.on('tabs:back', (_e, id: string) => tabs?.goBack(id))
  ipcMain.on('tabs:forward', (_e, id: string) => tabs?.goForward(id))
  ipcMain.on('tabs:reload', (_e, id: string) => tabs?.reload(id))
  ipcMain.on('tabs:setLive', (_e, id: string | null) => tabs?.setLiveTab(id))
  ipcMain.on('tabs:openFile', (_e, filePath: string) => tabs?.openFile(filePath))
  ipcMain.on('normalize:setAll', (_e, on: boolean) => tabs?.setNormalize(on))
  ipcMain.on('normalize:get', (e) => e.sender.send('normalize:set', tabs?.getNormalize() ?? true))
  ipcMain.handle('dialog:openFile', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const res = await dialog.showOpenDialog(win, {
      title: 'Open video',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video', extensions: ['mp4', 'mkv', 'webm', 'mov', 'm4v', 'avi', 'ogv'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (res.canceled) return 0
    for (const p of res.filePaths) tabs?.openFile(p)
    return res.filePaths.length
  })
  ipcMain.on('view:setBounds', (_e, b: Bounds) => tabs?.setBounds(b))
  ipcMain.on('view:setHidden', (_e, hidden: boolean) => tabs?.setHidden(hidden))

  ipcMain.on('tab:videoAspect', (e, ratio: number) => tabs?.setVideoAspect(e.sender.id, ratio))

  ipcMain.handle('theater:enter', (_e, opts: { profile: string; aspect: string }) => {
    if (!mainWindow) return { width: 0, height: 0 }
    const nitro = (discord?.status().user?.premium_type ?? 0) > 0
    const ratio =
      opts.aspect === '21:9'
        ? 21 / 9
        : opts.aspect === 'Vertical'
          ? 9 / 16
          : opts.aspect === 'Match'
            ? tabs?.liveAspect() ?? 16 / 9
            : 16 / 9
    theaterRestore = { bounds: mainWindow.getBounds(), maximized: mainWindow.isMaximized() }
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    const workArea = screen.getDisplayMatching(mainWindow.getBounds()).workAreaSize
    const size = computeTheaterSize(opts.profile, ratio, nitro, workArea)
    mainWindow.setContentSize(size.width, size.height)
    mainWindow.center()
    return size
  })
  ipcMain.on('theater:exit', () => {
    if (!mainWindow || !theaterRestore) return
    if (theaterRestore.maximized) mainWindow.maximize()
    else mainWindow.setBounds(theaterRestore.bounds)
    theaterRestore = null
  })
}

app.whenReady().then(() => {
  registerStreamitProtocol()
  registerIpc()
  createWindow()
  const startup = loadSettings()
  initDiscord(effectiveClientId(startup))
  void initAdblock(startup.adBlock)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
