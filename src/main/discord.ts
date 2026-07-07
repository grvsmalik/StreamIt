import { EventEmitter } from 'events'
import net from 'net'
import type { DiscordStatus, DiscordUser } from '../shared/types'

// Discord local RPC (IPC). Connects to the running Discord desktop client over a
// named pipe / unix socket and exchanges length-prefixed JSON frames. The READY
// handshake returns the logged-in user (name, avatar, premium_type) with no
// OAuth — enough for identity, tier, and Rich Presence. VC data would need the
// whitelist-only `rpc` scope and is deliberately out of scope (see DISCORD.md).

export const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 } as const

/** Frame = [op int32 LE][json length int32 LE][utf8 json]. */
export function encodeFrame(op: number, data: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(data), 'utf8')
  const header = Buffer.alloc(8)
  header.writeInt32LE(op, 0)
  header.writeInt32LE(json.length, 4)
  return Buffer.concat([header, json])
}

export interface DecodedFrame {
  op: number
  data: unknown
}

/** Pull all complete frames out of a buffer; returns them plus the leftover. */
export function decodeFrames(buf: Buffer): { frames: DecodedFrame[]; rest: Buffer } {
  const frames: DecodedFrame[] = []
  let offset = 0
  while (buf.length - offset >= 8) {
    const op = buf.readInt32LE(offset)
    const len = buf.readInt32LE(offset + 4)
    if (buf.length - offset - 8 < len) break
    const payload = buf.subarray(offset + 8, offset + 8 + len)
    offset += 8 + len
    try {
      frames.push({ op, data: JSON.parse(payload.toString('utf8')) })
    } catch {
      /* skip malformed frame */
    }
  }
  return { frames, rest: buf.subarray(offset) }
}

function ipcPath(id: number): string {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${id}`
  const base =
    process.env['XDG_RUNTIME_DIR'] || process.env['TMPDIR'] || process.env['TMP'] || '/tmp'
  return `${base}/discord-ipc-${id}`
}

export class DiscordRPC extends EventEmitter {
  private readonly clientId: string
  private socket: net.Socket | null = null
  private buf: Buffer = Buffer.alloc(0)
  private connected = false
  private user: DiscordUser | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private activity: object | null = null
  private stopped = false

  constructor(clientId: string) {
    super()
    this.clientId = clientId
  }

  status(): DiscordStatus {
    return { connected: this.connected, user: this.user }
  }

  start(): void {
    this.stopped = false
    if (!this.clientId) return
    this.tryConnect(0)
  }

  stop(): void {
    this.stopped = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.socket?.destroy()
  }

  private tryConnect(id: number): void {
    if (this.stopped || id > 9) {
      if (!this.stopped) this.scheduleReconnect()
      return
    }
    const sock = net.createConnection(ipcPath(id))
    sock.on('connect', () => {
      this.socket = sock
      this.buf = Buffer.alloc(0)
      this.write(OP.HANDSHAKE, { v: 1, client_id: this.clientId })
    })
    sock.on('data', (d) => this.onData(d))
    sock.on('error', () => {
      sock.destroy()
      if (!this.connected && !this.stopped) this.tryConnect(id + 1)
    })
    sock.on('close', () => this.onClose())
  }

  private onData(chunk: Buffer): void {
    const { frames, rest } = decodeFrames(Buffer.concat([this.buf, chunk]))
    this.buf = rest
    for (const f of frames) this.handle(f)
  }

  private handle({ op, data }: DecodedFrame): void {
    if (op === OP.PING) {
      this.write(OP.PONG, data)
      return
    }
    if (op === OP.CLOSE) {
      this.socket?.destroy()
      return
    }
    const msg = data as { cmd?: string; evt?: string; data?: { user?: DiscordUser } }
    if (msg.cmd === 'DISPATCH' && msg.evt === 'READY') {
      this.connected = true
      this.user = msg.data?.user ?? null
      this.emit('status', this.status())
      if (this.activity) this.pushActivity()
    }
  }

  /** activity = null clears presence. */
  setActivity(activity: object | null): void {
    this.activity = activity
    if (this.connected) this.pushActivity()
  }

  private pushActivity(): void {
    this.write(OP.FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: this.activity ?? undefined },
      nonce: `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    })
  }

  private write(op: number, data: unknown): void {
    if (op !== OP.HANDSHAKE && !this.socket) return
    this.socket?.write(encodeFrame(op, data))
  }

  private onClose(): void {
    const was = this.connected
    this.connected = false
    this.user = null
    this.socket = null
    if (was) this.emit('status', this.status())
    if (!this.stopped) this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.stopped) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.tryConnect(0)
    }, 5000)
  }
}
