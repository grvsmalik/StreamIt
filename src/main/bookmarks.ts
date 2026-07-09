import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Bookmark } from '../shared/types'

// Bookmarks persist alongside settings in userData, same simple JSON approach.
function bookmarksFile(): string {
  return join(app.getPath('userData'), 'bookmarks.json')
}

export function loadBookmarks(): Bookmark[] {
  try {
    const data = JSON.parse(readFileSync(bookmarksFile(), 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function save(list: Bookmark[]): void {
  try {
    writeFileSync(bookmarksFile(), JSON.stringify(list, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to persist bookmarks:', err)
  }
}

/** Add (or move to front / refresh) a bookmark, keyed by URL. */
export function addBookmark(b: Bookmark): Bookmark[] {
  const list = loadBookmarks().filter((x) => x.url !== b.url)
  list.unshift(b)
  save(list)
  return list
}

export function removeBookmark(url: string): Bookmark[] {
  const list = loadBookmarks().filter((x) => x.url !== url)
  save(list)
  return list
}
