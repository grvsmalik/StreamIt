import { app, protocol } from 'electron'
import { createReadStream, statSync, readFileSync } from 'fs'
import { Readable } from 'stream'
import { join, resolve } from 'path'
import { probeMedia, startPipeline, type PlayMode } from './media'
import type { TorrentEngine } from './torrent'

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

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })

/**
 * Resolve the media source named by a request's query params to something
 * ffmpeg/fs can open. Two source kinds:
 *   src  — a local file path, must have been allowlisted by openFile
 *   turl — a loopback torrent-stream URL, must belong to our engine
 */
function resolveSource(
  url: URL,
  engine: TorrentEngine
): { input: string; isFile: boolean } | null {
  const src = url.searchParams.get('src')
  if (src) {
    const filePath = resolve(decodeURIComponent(src))
    return allowed.has(filePath) ? { input: filePath, isFile: true } : null
  }
  const turl = url.searchParams.get('turl')
  if (turl && engine.ownsUrl(turl)) return { input: turl, isFile: false }
  return null
}

function servePage(name: string): Response {
  const html = readFileSync(join(app.getAppPath(), 'src', 'player', name))
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

/** Serve a local file with HTTP range support (direct play of local media). */
function serveFile(filePath: string, rangeHeader: string | null): Response {
  let size: number
  try {
    size = statSync(filePath).size
  } catch {
    return new Response('not found', { status: 404 })
  }
  const type = mimeFor(filePath)
  if (rangeHeader) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
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

/** Proxy a range request through to the torrent engine's loopback server. */
async function proxyTorrent(turl: string, request: Request): Promise<Response> {
  const range = request.headers.get('range')
  const upstream = await fetch(turl, { headers: range ? { range } : {} })
  const headers = new Headers()
  for (const h of ['content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set('Content-Type', 'video/mp4') // hint only; Chromium sniffs the demuxer
  return new Response(upstream.body, { status: upstream.status, headers })
}

export function registerStreamitProtocol(engine: TorrentEngine): void {
  protocol.handle(STREAMIT_SCHEME, async (request) => {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/player.html' || path === '/player') return servePage('player.html')
    if (path === '/torrent.html') return servePage('torrent.html')

    // ---- media metadata: how should the player treat this source? ----
    if (path === '/probe') {
      const source = resolveSource(url, engine)
      if (!source) return new Response('forbidden', { status: 403 })
      try {
        return json(await probeMedia(source.input))
      } catch {
        return json({ error: 'unreadable' }, 415)
      }
    }

    // ---- direct play: raw bytes with range support ----
    if (path === '/media') {
      const source = resolveSource(url, engine)
      if (!source) return new Response('forbidden', { status: 403 })
      return source.isFile
        ? serveFile(source.input, request.headers.get('range'))
        : proxyTorrent(source.input, request)
    }

    // ---- pipeline play: ffmpeg remux/transcode to fragmented MP4 ----
    if (path === '/pipe') {
      const source = resolveSource(url, engine)
      if (!source) return new Response('forbidden', { status: 403 })
      const mode = (url.searchParams.get('mode') ?? 'audio') as Exclude<PlayMode, 'direct'>
      if (!['remux', 'audio', 'full'].includes(mode)) {
        return new Response('bad mode', { status: 400 })
      }
      const t = Math.max(0, Number(url.searchParams.get('t')) || 0)
      const { stream, kill } = startPipeline(source.input, mode, t)
      request.signal.addEventListener('abort', kill)
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' }
      })
    }

    // ---- torrent control (fetch-only: the custom header can't be attached by
    // cross-origin pages or plain navigation, so web content can't hit these) ----
    if (path.startsWith('/torrent/')) {
      if (request.headers.get('x-streamit') !== '1') {
        return new Response('forbidden', { status: 403 })
      }
      try {
        if (path === '/torrent/add' && request.method === 'POST') {
          const body = (await request.json()) as { uri?: string; file?: string }
          let source = body.uri
          if (!source && body.file) {
            const filePath = resolve(body.file)
            if (!allowed.has(filePath)) return new Response('forbidden', { status: 403 })
            source = filePath
          }
          if (!source || !/^(magnet:|[a-zA-Z]:\\|\/)/.test(source)) {
            return json({ error: 'bad source' }, 400)
          }
          return json(await engine.add(source))
        }
        if (path === '/torrent/status') {
          const ih = url.searchParams.get('ih') ?? ''
          const status = await engine.status(ih)
          return status ? json(status) : json({ error: 'unknown torrent' }, 404)
        }
        if (path === '/torrent/fileUrl') {
          const ih = url.searchParams.get('ih') ?? ''
          const index = Number(url.searchParams.get('i'))
          const status = await engine.status(ih)
          if (!status || !status.files[index]) return json({ error: 'unknown file' }, 404)
          return json({ turl: engine.fileUrl(ih, index) })
        }
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'torrent error' }, 500)
      }
    }

    return new Response('not found', { status: 404 })
  })
}
