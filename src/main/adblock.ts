import { app, session } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { ElectronBlocker } from '@ghostery/adblocker-electron'

// Ad/tracker blocking using uBlock Origin + EasyList filter lists, applied at the
// network level on the default session (which all tab views use), so ads never
// download and never show up in the captured stream. Lists are cached to disk so
// after the first launch it's fast and works offline.

let blocker: ElectronBlocker | null = null
let desired = false
let active = false

export async function initAdblock(enable: boolean): Promise<void> {
  desired = enable
  if (!blocker) {
    const path = join(app.getPath('userData'), 'adblocker-engine.bin')
    try {
      blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
        path,
        read: async (p) => new Uint8Array(await readFile(p)),
        write: async (p, data) => writeFile(p, data)
      })
    } catch (err) {
      console.error('Ad blocker failed to initialize:', err)
      return
    }
  }
  apply()
}

export function setAdblock(enable: boolean): void {
  desired = enable
  apply()
}

function apply(): void {
  if (!blocker) return
  if (desired && !active) {
    blocker.enableBlockingInSession(session.defaultSession)
    active = true
  } else if (!desired && active) {
    blocker.disableBlockingInSession(session.defaultSession)
    active = false
  }
}
