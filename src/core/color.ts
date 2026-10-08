import type { Lab, RGB } from '../types'

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  const value = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rgbToLab([r, g, b]: RGB): Lab {
  const linear = [r, g, b].map(v => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const x = (linear[0] * 0.4124564 + linear[1] * 0.3575761 + linear[2] * 0.1804375) / 0.95047
  const y = (linear[0] * 0.2126729 + linear[1] * 0.7151522 + linear[2] * 0.0721750)
  const z = (linear[0] * 0.0193339 + linear[1] * 0.1191920 + linear[2] * 0.9503041) / 1.08883
  const f = (v: number) => v > 0.008856451679 ? Math.cbrt(v) : 7.787037037 * v + 16 / 116
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

// Sharma, Wu and Dalal (2005), CIEDE2000. Unit parametric weights.
export function deltaE00([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const deg = 180 / Math.PI
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2)
  const hue = (a: number, b: number) => (Math.atan2(b, a) * deg + 360) % 360
  const h1 = hue(ap1, b1), h2 = hue(ap2, b2)
  const dL = L2 - L1, dC = Cp2 - Cp1
  let dh = h2 - h1
  if (Cp1 * Cp2 === 0) dh = 0
  else if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2)
  const Lbar = (L1 + L2) / 2, Cpbar = (Cp1 + Cp2) / 2
  let hbar = h1 + h2
  if (Cp1 * Cp2 === 0) hbar = h1 + h2
  else if (Math.abs(h1 - h2) <= 180) hbar = (h1 + h2) / 2
  else if (h1 + h2 < 360) hbar = (h1 + h2 + 360) / 2
  else hbar = (h1 + h2 - 360) / 2
  const T = 1 - 0.17 * Math.cos((hbar - 30) * rad)
    + 0.24 * Math.cos(2 * hbar * rad)
    + 0.32 * Math.cos((3 * hbar + 6) * rad)
    - 0.20 * Math.cos((4 * hbar - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cpbar ** 7 / (Cpbar ** 7 + 25 ** 7))
  const Sl = 1 + 0.015 * (Lbar - 50) ** 2 / Math.sqrt(20 + (Lbar - 50) ** 2)
  const Sc = 1 + 0.045 * Cpbar
  const Sh = 1 + 0.015 * Cpbar * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  const l = dL / Sl, c = dC / Sc, h = dH / Sh
  return Math.sqrt(Math.max(0, l * l + c * c + h * h + Rt * c * h))
}
