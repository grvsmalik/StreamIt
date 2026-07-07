// Runs inside every tab's web page. Captures file drops on the page (which the
// chrome renderer can't see, since the WebContentsView sits above it) and opens
// dropped videos in a NEW tab instead of letting Chromium navigate the page to
// the file.
//
// Safe by design: contextIsolation keeps ipcRenderer/webUtils out of page JS, so
// only genuine user drops trigger this — a page can't forge a File with a real
// OS path (webUtils.getPathForFile returns '' for page-created Files).
import { contextBridge, ipcRenderer, webUtils } from 'electron'

// The StreamIt player page (streamit://app) subscribes to normalization toggles.
contextBridge.exposeInMainWorld('streamitTab', {
  onNormalize: (cb: (on: boolean) => void): void => {
    ipcRenderer.on('normalize:set', (_e, on: boolean) => cb(!!on))
    ipcRenderer.send('normalize:get')
  }
})

// Report the playing video's real aspect ratio so theater's "Match content"
// can size the window to it.
let lastRatio = 0
function reportAspect(): void {
  const v = document.querySelector('video')
  if (v && v.videoWidth > 0 && v.videoHeight > 0) {
    const r = v.videoWidth / v.videoHeight
    if (Math.abs(r - lastRatio) > 0.001) {
      lastRatio = r
      ipcRenderer.send('tab:videoAspect', r)
    }
  }
}
window.addEventListener('loadedmetadata', reportAspect, true)
window.addEventListener('resize', reportAspect, true)
setInterval(reportAspect, 2000)

const VIDEO_RE = /\.(mp4|mkv|webm|mov|m4v|avi|ogv)$/i

function hasFiles(e: DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
}

window.addEventListener(
  'dragover',
  (e) => {
    if (hasFiles(e)) e.preventDefault()
  },
  true
)

window.addEventListener(
  'drop',
  (e) => {
    if (!hasFiles(e)) return
    const videos = Array.from(e.dataTransfer!.files).filter(
      (f) => VIDEO_RE.test(f.name) || f.type.startsWith('video/')
    )
    if (videos.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    for (const f of videos) {
      const path = webUtils.getPathForFile(f)
      if (path) ipcRenderer.send('tabs:openFile', path)
    }
  },
  true
)
