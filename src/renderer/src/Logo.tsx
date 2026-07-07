import type { JSX } from 'react'

/** StreamIt brand mark (logo F): a screen with a play button and three viewers.
 *  Mirrors build/icon.svg — keep the two in sync if the mark changes. */
export function StreamItMark({ size = 32 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="8" y="8" width="80" height="80" rx="22" fill="#5865f2" />
      <rect x="20" y="19" width="56" height="32" rx="5" fill="#ffffff" />
      <path d="M44 28 L58 36 L44 44 Z" fill="#5865f2" />
      <g fill="#ffffff">
        <path d="M23 80 L23 77 A9 9 0 0 1 41 77 L41 80 Z" />
        <circle cx="32" cy="65" r="5.5" />
        <path d="M39 80 L39 77 A9 9 0 0 1 57 77 L57 80 Z" />
        <circle cx="48" cy="65" r="5.5" />
        <path d="M55 80 L55 77 A9 9 0 0 1 73 77 L73 80 Z" />
        <circle cx="64" cy="65" r="5.5" />
      </g>
    </svg>
  )
}

export function StreamItWordmark({ size = 18 }: { size?: number }): JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <StreamItMark size={size + 6} />
      <span style={{ fontSize: size, fontWeight: 500, color: 'var(--si-text)', letterSpacing: '-0.01em' }}>
        StreamIt
      </span>
    </span>
  )
}
