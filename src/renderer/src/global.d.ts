import type { StreamItApi } from '../../preload'

declare global {
  interface Window {
    streamit: StreamItApi
  }
}

export {}
