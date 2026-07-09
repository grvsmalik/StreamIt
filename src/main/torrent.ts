import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { rmSync } from 'fs'

// WebTorrent v3 is ESM-only; the main bundle is CJS, so load it dynamically.
// Types are structural stand-ins for the small surface we use.
interface WtFile {
  name: string
  path: string
  length: number
  select: () => void
  deselect: () => void
  createReadStream: (opts?: { start?: number; end?: number }) => NodeJS.ReadableStream
}
interface WtTorrent {
  infoHash: string
  name: string
  files: WtFile[]
  progress: number
  downloadSpeed: number
  uploadSpeed: number
  numPeers: number
  ready: boolean
  destroy: (cb?: () => void) => void
  once: (ev: string, cb: (...a: unknown[]) => void) => void
  on: (ev: string, cb: (...a: unknown[]) => void) => void
}
interface WtClient {
  add: (
    uri: string,
    opts: { path: string; deselect?: boolean },
    cb: (torrent: WtTorrent) => void
  ) => WtTorrent
  get: (infoHash: string) => Promise<WtTorrent | null>
  torrents: WtTorrent[]
  throttleUpload: (rate: number) => void
  destroy: (cb?: () => void) => void
}

const VIDEO_RE = /\.(mp4|mkv|webm|mov|m4v|avi|ogv|ts|m2ts|wmv|flv)$/i
const KiB = 1024

export interface TorrentFileInfo {
  index: number
  name: string
  size: number
  isVideo: boolean
}
export interface TorrentStatus {
  infoHash: string
  name: string
  ready: boolean
  files: TorrentFileInfo[]
  progress: number
  downloadSpeed: number
  uploadSpeed: number
  peers: number
}

/**
 * Owns the WebTorrent client plus a loopback HTTP server that serves torrent
 * file contents with Range support. Range reads map onto WebTorrent piece
 * prioritization, which is what makes play-while-downloading work — both the
 * <video> element (direct play) and ffmpeg (transcode) just speak HTTP to it.
 */
export class TorrentEngine {
  private client: WtClient | null = null
  private server: Server | null = null
  private port = 0
  private streaming = false
  private uploadCapKBs: number

  constructor(
    private readonly storageDir: string,
    uploadCapKBs = 100
  ) {
    this.uploadCapKBs = uploadCapKBs
  }

  private async ensure(): Promise<WtClient> {
    if (this.client) return this.client
    const { default: WebTorrent } = (await import('webtorrent')) as unknown as {
      default: new (opts?: object) => WtClient
    }
    this.client = new WebTorrent()
    this.applyThrottle()
    this.server = createServer((req, res) => void this.serve(req, res))
    await new Promise<void>((res) => this.server!.listen(0, '127.0.0.1', res))
    const addr = this.server.address()
    this.port = typeof addr === 'object' && addr ? addr.port : 0
    return this.client
  }

  /** Cap uploads hard while a Go Live stream is running — seeding must never
   *  starve the upstream bandwidth Discord needs. */
  setStreaming(on: boolean): void {
    this.streaming = on
    this.applyThrottle()
  }

  setUploadCap(kbs: number): void {
    this.uploadCapKBs = kbs
    this.applyThrottle()
  }

  private applyThrottle(): void {
    // 1 KiB/s while live keeps peer connections alive without competing.
    this.client?.throttleUpload((this.streaming ? 1 : Math.max(1, this.uploadCapKBs)) * KiB)
  }

  /** Add a magnet URI or .torrent file path; resolves once metadata is known. */
  async add(uri: string): Promise<TorrentStatus> {
    const client = await this.ensure()
    const existing = await this.findByUri(uri)
    if (existing) return this.statusOf(existing)
    const torrent = await new Promise<WtTorrent>((res, rej) => {
      const t = client.add(uri, { path: this.storageDir, deselect: true }, res)
      t.once('error', (err) => rej(err instanceof Error ? err : new Error(String(err))))
    })
    return this.statusOf(torrent)
  }

  private async findByUri(uri: string): Promise<WtTorrent | null> {
    const m = /urn:btih:([0-9a-fA-F]{40})/.exec(uri)
    if (!m) return null
    return this.client ? await this.client.get(m[1].toLowerCase()) : null
  }

  async status(infoHash: string): Promise<TorrentStatus | null> {
    const t = await this.client?.get(infoHash)
    return t ? this.statusOf(t) : null
  }

  private statusOf(t: WtTorrent): TorrentStatus {
    return {
      infoHash: t.infoHash,
      name: t.name || t.infoHash,
      ready: t.ready,
      files: t.files.map((f, index) => ({
        index,
        name: f.name,
        size: f.length,
        isVideo: VIDEO_RE.test(f.name)
      })),
      progress: t.progress,
      downloadSpeed: t.downloadSpeed,
      uploadSpeed: t.uploadSpeed,
      peers: t.numPeers
    }
  }

  /** True once a client exists (something was added this session). */
  isActive(): boolean {
    return this.client !== null
  }

  /** Loopback URL for a file inside a torrent — the pipeline's input. */
  fileUrl(infoHash: string, fileIndex: number): string {
    return `http://127.0.0.1:${this.port}/${infoHash}/${fileIndex}`
  }

  /** True when `url` is one this engine handed out (protocol allowlist). */
  ownsUrl(url: string): boolean {
    return this.port > 0 && url.startsWith(`http://127.0.0.1:${this.port}/`)
  }

  private async serve(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const m = /^\/([0-9a-f]{40})\/(\d+)$/.exec(req.url ?? '')
    const torrent = m ? await this.client?.get(m[1]) : null
    const file = torrent?.files[Number(m?.[2])]
    if (!file) {
      res.writeHead(404).end()
      return
    }
    file.select() // stream target: download this file (rest stays deselected)

    const size = file.length
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
    let start = range && range[1] ? parseInt(range[1], 10) : 0
    let end = range && range[2] ? parseInt(range[2], 10) : size - 1
    if (isNaN(start) || start < 0) start = 0
    if (isNaN(end) || end >= size) end = size - 1
    if (start > end) start = 0

    res.writeHead(req.headers.range ? 206 : 200, {
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      ...(req.headers.range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {})
    })
    const stream = file.createReadStream({ start, end })
    stream.pipe(res)
    const stop = (): void => {
      ;(stream as unknown as { destroy?: () => void }).destroy?.()
    }
    res.on('close', stop)
    res.on('error', stop)
  }

  /** Tear down; deletes downloaded data unless `keepFiles`. */
  async destroy(keepFiles: boolean): Promise<void> {
    if (!this.client) return
    await new Promise<void>((res) => this.client!.destroy(() => res()))
    this.client = null
    this.server?.close()
    this.server = null
    if (!keepFiles) {
      try {
        rmSync(this.storageDir, { recursive: true, force: true })
      } catch {
        /* files may be in use; best effort */
      }
    }
  }
}
