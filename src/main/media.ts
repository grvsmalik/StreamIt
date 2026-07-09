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

/** A selectable audio stream (dubs, languages, commentary). */
export interface AudioTrack {
  index: number // absolute ffmpeg stream index, for -map 0:<index>
  codec: string | null
  language: string | null
  title: string | null
  channels: number
  isDefault: boolean
}

/** A subtitle stream. `textBased` false = bitmap (PGS/VobSub) we can't render as text. */
export interface SubtitleTrack {
  index: number
  codec: string | null
  language: string | null
  title: string | null
  isDefault: boolean
  textBased: boolean
}

export interface MediaProbe {
  mode: PlayMode
  duration: number // seconds, 0 when unknown
  videoCodec: string | null
  audioCodec: string | null
  width: number
  height: number
  audioTracks: AudioTrack[]
  subtitleTracks: SubtitleTrack[]
}

// What Chromium's <video> demuxes/decodes. HEVC is included because StreamIt
// enables PlatformHEVCDecoderSupport (hardware decode, near-universal on GPUs
// since ~2015); if a machine can't, the player falls back to force=full.
const OK_VIDEO = new Set(['h264', 'vp8', 'vp9', 'av1', 'hevc'])
const OK_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac'])
// format_name is a comma list, e.g. "matroska,webm" / "mov,mp4,m4a,3gp,3g2,mj2"
const OK_CONTAINER = /matroska|webm|mp4|mov|ogg/
// Subtitle codecs ffmpeg can convert to WebVTT text. Bitmap subs (PGS/VobSub/
// DVB) are images — not text-convertible, so we surface but can't render them.
const TEXT_SUB = new Set(['subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt', 'text', 'subviewer'])

interface FfprobeStream {
  index?: number
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  channels?: number
  disposition?: { default?: number }
  tags?: { language?: string; title?: string }
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

  const audioTracks: AudioTrack[] = streams
    .filter((s) => s.codec_type === 'audio')
    .map((s) => ({
      index: s.index ?? 0,
      codec: s.codec_name ?? null,
      language: s.tags?.language ?? null,
      title: s.tags?.title ?? null,
      channels: s.channels ?? 0,
      isDefault: s.disposition?.default === 1
    }))

  const subtitleTracks: SubtitleTrack[] = streams
    .filter((s) => s.codec_type === 'subtitle')
    .map((s) => ({
      index: s.index ?? 0,
      codec: s.codec_name ?? null,
      language: s.tags?.language ?? null,
      title: s.tags?.title ?? null,
      isDefault: s.disposition?.default === 1,
      textBased: TEXT_SUB.has(s.codec_name ?? '')
    }))

  return {
    mode,
    duration: Number(info.format?.duration) || 0,
    videoCodec,
    audioCodec,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    audioTracks,
    subtitleTracks
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
 * treats the output as a stream that begins at that timestamp. `audioIndex`
 * (absolute stream index) selects a non-default audio track; when set, that
 * track is always transcoded to AAC so any codec plays.
 */
export function startPipeline(
  input: string,
  mode: Exclude<PlayMode, 'direct'>,
  startAt = 0,
  audioIndex?: number
): { stream: Readable; kill: () => void } {
  const args = ['-hide_banner', '-loglevel', 'error']
  if (startAt > 0) args.push('-ss', String(startAt))
  args.push('-i', input, '-map', '0:v:0?')
  // A specific audio track (by absolute index) or the default one.
  args.push('-map', audioIndex === undefined ? '0:a:0?' : `0:${audioIndex}`)

  if (mode === 'full') {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p')
  } else {
    args.push('-c:v', 'copy')
  }
  // Stream-copy audio only in remux mode with the default track; a hand-picked
  // track may be any codec, so transcode it to be safe.
  if (mode === 'remux' && audioIndex === undefined) {
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

/**
 * Extract one embedded (text) subtitle stream as WebVTT (full file, absolute
 * timestamps) for a `<track>` element. The player shifts cue times to match the
 * pipeline offset after a seek — ffmpeg's own `-ss` doesn't rebase subtitle
 * cues to line up with an offset-seeked video stream.
 */
export function extractSubtitleVtt(
  input: string,
  streamIndex: number
): { stream: Readable; kill: () => void } {
  const args = ['-hide_banner', '-loglevel', 'error']
  args.push('-i', input, '-map', `0:${streamIndex}`, '-f', 'webvtt', 'pipe:1')

  const child = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  children.add(child)
  child.on('close', () => children.delete(child))

  const kill = (): void => {
    children.delete(child)
    child.kill('SIGKILL')
  }
  child.stdout!.on('close', () => {
    if (child.exitCode === null) kill()
  })
  return { stream: child.stdout!, kill }
}
