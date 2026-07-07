import type { JSX } from 'react'

type P = { size?: number; className?: string; style?: React.CSSProperties }

function Stroke({ size = 18, className, style, d }: P & { d: string }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export const ChevronLeft = (p: P): JSX.Element => <Stroke {...p} d="M15 6l-6 6l6 6" />
export const ChevronRight = (p: P): JSX.Element => <Stroke {...p} d="M9 6l6 6l-6 6" />
export const ChevronDown = (p: P): JSX.Element => <Stroke {...p} d="M6 9l6 6l6 -6" />
export const Refresh = (p: P): JSX.Element => (
  <Stroke
    {...p}
    d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"
  />
)
export const Lock = (p: P): JSX.Element => (
  <Stroke {...p} d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v5a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2zM8 11v-4a4 4 0 1 1 8 0v4" />
)
export const Share = (p: P): JSX.Element => (
  <Stroke {...p} d="M3 5h18v10H3zM8 20h8M12 15v5" />
)
export const Theater = (p: P): JSX.Element => <Stroke {...p} d="M4 6h16v12H4z" />
export const Maximize = (p: P): JSX.Element => (
  <Stroke {...p} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
)
export const Settings = (p: P): JSX.Element => (
  <svg
    width={p.size ?? 18}
    height={p.size ?? 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
    style={p.style}
    aria-hidden="true"
  >
    <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const Users = (p: P): JSX.Element => (
  <Stroke {...p} d="M9 7a3 3 0 1 0 0 6a3 3 0 0 0 0 -6M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0 -3 -3.85" />
)
export const Volume = (p: P): JSX.Element => (
  <Stroke {...p} d="M6 9H4a1 1 0 0 0 -1 1v4a1 1 0 0 0 1 1h2l3.5 3.5a1 1 0 0 0 1.5 -1V6.5a1 1 0 0 0 -1.5 -1zM16 8a5 5 0 0 1 0 8" />
)
export const VolumeX = (p: P): JSX.Element => (
  <Stroke {...p} d="M6 9H4a1 1 0 0 0 -1 1v4a1 1 0 0 0 1 1h2l3.5 3.5a1 1 0 0 0 1.5 -1V6.5a1 1 0 0 0 -1.5 -1zM16 10l4 4M20 10l-4 4" />
)
export const Headphones = (p: P): JSX.Element => (
  <Stroke {...p} d="M4 15v-3a8 8 0 0 1 16 0v3M18 19a2 2 0 0 1 -2 2h-1v-6h1a2 2 0 0 1 2 2zM6 19a2 2 0 0 0 2 2h1v-6H8a2 2 0 0 0 -2 2z" />
)
export const Adjustments = (p: P): JSX.Element => (
  <Stroke {...p} d="M6 4v6M6 14v6M12 4v10M12 18v2M18 4v2M18 10v10M4 14h4M10 8h4M16 6h4" />
)
export const BellOff = (p: P): JSX.Element => (
  <Stroke {...p} d="M17 17H4a3 3 0 0 0 2 -3V9a6 6 0 0 1 .6 -2.6M9 4.5a6 6 0 0 1 9 4.5v5M9 17v1a3 3 0 0 0 6 0v-1M3 3l18 18" />
)
export const Alert = (p: P): JSX.Element => (
  <Stroke {...p} d="M12 9v4M12 17h.01M10.24 3.957l-8.422 14.06A1.989 1.989 0 0 0 3.518 21h16.964a1.989 1.989 0 0 0 1.7 -2.983l-8.42 -14.06a1.989 1.989 0 0 0 -3.522 0z" />
)
export const Check = (p: P): JSX.Element => <Stroke {...p} d="M5 12l5 5l10 -10" />
export const Plus = (p: P): JSX.Element => <Stroke {...p} d="M12 5v14M5 12h14" />
export const X = (p: P): JSX.Element => <Stroke {...p} d="M6 6l12 12M18 6l-12 12" />
export const Play = (p: P): JSX.Element => (
  <svg
    width={p.size ?? 18}
    height={p.size ?? 18}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={p.className}
    style={p.style}
    aria-hidden="true"
  >
    <path d="M7 4v16l13 -8z" />
  </svg>
)
export const FolderOpen = (p: P): JSX.Element => (
  <Stroke
    {...p}
    d="M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2"
  />
)
export const Info = (p: P): JSX.Element => (
  <Stroke {...p} d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18M12 8h.01M11 12h1v4h1" />
)
export const Sliders = (p: P): JSX.Element => (
  <Stroke {...p} d="M4 6h8M16 6h4M4 12h4M12 12h8M4 18h12M18 18h2M14 4v4M8 10v4M16 16v4" />
)
export const Globe = (p: P): JSX.Element => (
  <Stroke
    {...p}
    d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18"
  />
)
export const Discord = (p: P): JSX.Element => (
  <svg
    width={p.size ?? 18}
    height={p.size ?? 18}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={p.className}
    style={p.style}
    aria-hidden="true"
  >
    <path d="M20.317 4.37a19.79 19.79 0 0 0 -4.885 -1.515a.074 .074 0 0 0 -.078 .037a13.78 13.78 0 0 0 -.608 1.25a18.27 18.27 0 0 0 -5.487 0a12.64 12.64 0 0 0 -.617 -1.25a.077 .077 0 0 0 -.079 -.037a19.74 19.74 0 0 0 -4.885 1.515a.07 .07 0 0 0 -.032 .027c-3.111 4.648 -3.964 9.182 -3.545 13.66a.082 .082 0 0 0 .031 .056a19.9 19.9 0 0 0 5.993 3.03a.078 .078 0 0 0 .084 -.028a14.2 14.2 0 0 0 1.226 -1.994a.076 .076 0 0 0 -.041 -.106a13.1 13.1 0 0 1 -1.872 -.892a.077 .077 0 0 1 -.008 -.128a10.2 10.2 0 0 0 .372 -.291a.074 .074 0 0 1 .077 -.01c3.928 1.793 8.18 1.793 12.061 0a.074 .074 0 0 1 .079 .009c.12 .099 .246 .198 .373 .292a.077 .077 0 0 1 -.006 .127a12.3 12.3 0 0 1 -1.873 .891a.077 .077 0 0 0 -.041 .107c.36 .698 .772 1.362 1.225 1.993a.076 .076 0 0 0 .084 .028a19.84 19.84 0 0 0 6.002 -3.03a.077 .077 0 0 0 .032 -.055c.5 -5.177 -.838 -9.674 -3.549 -13.66a.06 .06 0 0 0 -.031 -.03zM8.02 15.33c-1.183 0 -2.157 -1.086 -2.157 -2.419c0 -1.333 .956 -2.419 2.157 -2.419c1.211 0 2.176 1.095 2.157 2.419c0 1.333 -.956 2.419 -2.157 2.419zm7.975 0c-1.183 0 -2.157 -1.086 -2.157 -2.419c0 -1.333 .955 -2.419 2.157 -2.419c1.211 0 2.176 1.095 2.157 2.419c0 1.333 -.946 2.419 -2.157 2.419z" />
  </svg>
)
