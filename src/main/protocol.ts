import { app, protocol } from 'electron'
import { createReadStream, statSync, readFileSync } from 'fs'
import { Readable } from 'stream'
import { join, resolve } from 'path'

// Local media is served through this scheme so the player page and the media
// share one origin (streamit://app) — otherwise Web Audio would taint the
// MediaElementSource and normalization would output silence.
export const STREAMIT_SCHEME = 'streamit'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.ogg': 'audio/ogg',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac'
}

function mimeFor(p: string): string {
  const ext = p.slice(p.lastIndexOf('.')).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}

// Only files explicitly opened via openFile can be served — stops a web page
// from reading arbitrary local files via a crafted streamit://app/media URL.
const allowed = new Set<string>()
export function allowMediaFile(filePath: string): void {
  allowed.add(resolve(filePath))
}

export function registerStreamitProtocol(): void {
  protocol.handle(STREAMIT_SCHEME, async (request) => {
    const url = new URL(request.url)

    if (url.pathname === '/player.html' || url.pathname === '/player') {
      const html = readFileSync(join(app.getAppPath(), 'src', 'player', 'player.html'))
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    if (url.pathname === '/media') {
      const src = url.searchParams.get('src')
      if (!src) return new Response('missing src', { status: 400 })
      const filePath = resolve(decodeURIComponent(src))
      if (!allowed.has(filePath)) return new Response('forbidden', { status: 403 })

      let size: number
      try {
        size = statSync(filePath).size
      } catch {
        return new Response('not found', { status: 404 })
      }

      const type = mimeFor(filePath)
      const range = request.headers.get('range')
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range)
        let start = m && m[1] ? parseInt(m[1], 10) : 0
        let end = m && m[2] ? parseInt(m[2], 10) : size - 1
        if (isNaN(start) || start < 0) start = 0
        if (isNaN(end) || end >= size) end = size - 1
        if (start > end) start = 0
        const stream = createReadStream(filePath, { start, end })
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 206,
          headers: {
            'Content-Type': type,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(end - start + 1)
          }
        })
      }

      const stream = createReadStream(filePath)
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 200,
        headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(size) }
      })
    }

    return new Response('not found', { status: 404 })
  })
}
