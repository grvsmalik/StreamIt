import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_SETTINGS, type Settings } from '../shared/types'

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsFile(), 'utf8')) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch }
  try {
    writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to persist settings:', err)
  }
  return next
}
