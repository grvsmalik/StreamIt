export interface Size {
  width: number
  height: number
}

// Pick a clean capture resolution for theater mode so Discord captures the
// window at an exact size (no double-scaling blur). Profile sets the height
// intent, tier caps it, aspect sets the shape, and it's clamped to fit the
// display's work area.
export function computeTheaterSize(
  profile: string,
  ratio: number,
  nitro: boolean,
  workArea: { width: number; height: number }
): Size {
  let h = profile === 'Fast motion' ? 720 : 1080
  if (!nitro) h = Math.min(h, 720) // free tier caps at 720p — no point sending more

  let w = Math.round(h * ratio)

  const maxW = workArea.width - 40
  const maxH = workArea.height - 48
  if (w > maxW) {
    w = maxW
    h = Math.round(w / ratio)
  }
  if (h > maxH) {
    h = maxH
    w = Math.round(h * ratio)
  }

  w -= w % 2
  h -= h % 2
  return { width: w, height: h }
}
