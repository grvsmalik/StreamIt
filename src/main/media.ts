import { spawn, execFile, type ChildProcess } from 'child_process'
import { Readable } from 'stream'

// Electron-free on purpose: everything here is testable under plain Node.
// Binary paths resolve out of node_modules; in a packaged app the binaries are
// asarUnpacked (electron-builder.yml), so the .asar path is rewritten.
function unpacked(p: string): string {
  return p.replace('app.asar', 'app.asar.unpacked')
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const FFMPEG: string = unpacked(require('ffmpeg-static') as string)
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const FFPROBE: string = unpacked((require('ffprobe-static') as { path: string }).path)

/** How a source reaches the <video> element. */
export type PlayMode =
  | 'direct' // Chromium plays the bytes as-is (range requests, native seeking)
  | 'remux' // codecs fine, container not: repackage into fragmented MP4
  | 'audio' // video copied, audio transcoded to AAC
  | 'full' // video AND audio transcoded

export interface MediaProbe {
  mode: PlayMode
  duration: number // seconds, 0 when unknown
  videoCodec: string | null
  audioCodec: string | null
  width: number
  height: number
}

// What Chromium's <video> demuxes/decodes. HEVC is included because StreamIt
// enables PlatformHEVCDecoderSupport (hardware decode, near-universal on GPUs
// since ~2015); if a machine can't, the player falls back to force=full.
const OK_VIDEO = new Set(['h264', 'vp8', 'vp9', 'av1', 'hevc'])
const OK_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac'])
// format_name is a comma list, e.g. "matroska,webm" / "mov,mp4,m4a,3gp,3g2,mj2"
const OK_CONTAINER = /matroska|webm|mp4|mov|ogg/

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
}
interface FfprobeOutput {
  streams?: FfprobeStream[]
  format?: { format_name?: string; duration?: string }
}

function runFfprobe(input: string): Promise<FfprobeOutput> {
  return new Promise((res, rej) => {
    execFile(
      FFPROBE,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input],
      { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) rej(err)
        else res(JSON.parse(stdout) as FfprobeOutput)
      }
    )
  })
}

/** Inspect a source (file path or URL) and decide how to play it. */
export async function probeMedia(input: string): Promise<MediaProbe> {
  const info = await runFfprobe(input)
  const streams = info.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video')
  const audio = streams.find((s) => s.codec_type === 'audio')
  const videoCodec = video?.codec_name ?? null
  const audioCodec = audio?.codec_name ?? null

  const videoOk = !video || OK_VIDEO.has(videoCodec ?? '')
  const audioOk = !audio || OK_AUDIO.has(audioCodec ?? '')
  const containerOk = OK_CONTAINER.test(info.format?.format_name ?? '')

  let mode: PlayMode
  if (!videoOk) mode = 'full'
  else if (!audioOk) mode = 'audio'
  else if (!containerOk) mode = 'remux'
  else mode = 'direct'

  return {
    mode,
    duration: Number(info.format?.duration) || 0,
    videoCodec,
    audioCodec,
    width: video?.width ?? 0,
    height: video?.height ?? 0
  }
}

const children = new Set<ChildProcess>()

/** Kill every live ffmpeg (app quit). */
export function killAllPipelines(): void {
  for (const c of children) c.kill('SIGKILL')
  children.clear()
}

/**
 * Spawn ffmpeg turning `input` (file path or URL) into a fragmented-MP4 stream
 * Chromium can play. `startAt` seeks before demuxing (fast seek) — the player
 * treats the output as a stream that begins at that timestamp.
 */
export function startPipeline(
  input: string,
  mode: Exclude<PlayMode, 'direct'>,
  startAt = 0
): { stream: Readable; kill: () => void } {
  const args = ['-hide_banner', '-loglevel', 'error']
  if (startAt > 0) args.push('-ss', String(startAt))
  args.push('-i', input, '-map', '0:v:0?', '-map', '0:a:0?')

  if (mode === 'full') {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p')
  } else {
    args.push('-c:v', 'copy')
  }
  if (mode === 'remux') {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2')
  }
  // Fragmented MP4: playable while still being written, no seekable output needed.
  args.push('-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', 'pipe:1')

  const child = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  children.add(child)

  let errBuf = ''
  child.stderr!.on('data', (d: Buffer) => {
    errBuf = (errBuf + d.toString()).slice(-2000)
  })
  child.on('close', (code) => {
    children.delete(child)
    if (code !== 0 && code !== null && errBuf) {
      console.error(`[media] ffmpeg exited ${code}: ${errBuf}`)
    }
  })

  const kill = (): void => {
    children.delete(child)
    child.kill('SIGKILL')
  }
  // Consumer gone (tab closed, seek restarted the pipeline) → stop transcoding.
  child.stdout!.on('close', () => {
    if (child.exitCode === null) kill()
  })

  return { stream: child.stdout!, kill }
}
