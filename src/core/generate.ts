import { deltaE00, hexToRgb, rgbToLab } from './color'
import type { GenerationRequest, GenerationResult, Lab, Mode } from '../types'

const MODES: Mode[] = ['clear', 'balanced', 'photo']

export function generate(req: GenerationRequest): GenerationResult {
  const { width, height, rgba, palette, maxColors, transparent } = req
  if (width < 1 || height < 1 || rgba.length !== width * height * 4) throw new Error('图片网格数据无效')
  const available = palette.colors
  if (!available.length) throw new Error('所选色卡没有可用的普通颜色')
  const paletteLab = available.map(c => rgbToLab(hexToRgb(c.hex)))
  const source: (Lab | null)[] = new Array(width * height)
  const weights = new Float32Array(width * height)
  for (let i = 0; i < source.length; i++) {
    const p = i * 4
    source[i] = transparent && rgba[p + 3] < 80 ? null : rgbToLab([rgba[p], rgba[p + 1], rgba[p + 2]])
  }
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (!c) continue
    const x = i % width, y = Math.floor(i / width)
    let edge = 0
    if (x + 1 < width && source[i + 1]) edge = Math.max(edge, Math.abs(c[0] - source[i + 1]![0]) + 0.25 * Math.hypot(c[1] - source[i + 1]![1], c[2] - source[i + 1]![2]))
    if (y + 1 < height && source[i + width]) edge = Math.max(edge, Math.abs(c[0] - source[i + width]![0]) + 0.25 * Math.hypot(c[1] - source[i + width]![1], c[2] - source[i + width]![2]))
    weights[i] = 1 + Math.min(1.8, edge / 24)
  }

  // Greedy facility location on a spatially spread sample. Distances are computed once.
  const stride = Math.max(1, Math.floor(source.length / 3600))
  const samples: number[] = []
  for (let i = 0; i < source.length; i += stride) if (source[i]) samples.push(i)
  if (!samples.length) return { colors: available, variants: { clear: Array(source.length).fill(-1), balanced: Array(source.length).fill(-1), photo: Array(source.length).fill(-1) } }
  const distances = samples.map(i => paletteLab.map(p => deltaE00(source[i]!, p)))
  const best = new Float32Array(samples.length).fill(1000)
  const selected: number[] = []
  const remaining = new Set(paletteLab.map((_, i) => i))
  let currentError = Infinity
  for (let round = 0; round < Math.min(maxColors, available.length); round++) {
    let winner = -1, winnerGain = -Infinity
    for (const candidate of remaining) {
      let gain = 0
      for (let j = 0; j < samples.length; j++) gain += Math.max(0, best[j] - distances[j][candidate]) * weights[samples[j]]
      if (gain > winnerGain) { winnerGain = gain; winner = candidate }
    }
    if (winner < 0 || (round > 0 && winnerGain < Math.max(samples.length * 0.15, currentError * 0.004))) break
    selected.push(winner)
    remaining.delete(winner)
    for (let j = 0; j < samples.length; j++) best[j] = Math.min(best[j], distances[j][winner])
    currentError = 0
    for (let j = 0; j < samples.length; j++) currentError += best[j] * weights[samples[j]]
  }
  if (!selected.length) selected.push(0)

  // One weighted swap pass can recover a useful shade that greedy selection missed.
  for (let position = 0; position < selected.length; position++) {
    if (!remaining.size) break
    const without = new Float32Array(samples.length).fill(1000)
    for (let j = 0; j < samples.length; j++) {
      for (let k = 0; k < selected.length; k++) if (k !== position) without[j] = Math.min(without[j], distances[j][selected[k]])
    }
    let oldCost = 0
    for (let j = 0; j < samples.length; j++) oldCost += Math.min(without[j], distances[j][selected[position]]) * weights[samples[j]]
    let replacement = -1, replacementCost = oldCost
    for (const candidate of remaining) {
      let cost = 0
      for (let j = 0; j < samples.length; j++) cost += Math.min(without[j], distances[j][candidate]) * weights[samples[j]]
      if (cost < replacementCost) { replacement = candidate; replacementCost = cost }
    }
    if (replacement >= 0 && oldCost - replacementCost > Math.max(1, currentError * 0.001)) {
      remaining.delete(replacement)
      remaining.add(selected[position])
      selected[position] = replacement
      currentError = replacementCost
    }
  }

  const nearest = (lab: Lab) => {
    let bestIndex = selected[0], bestScore = Infinity
    for (const index of selected) {
      const score = deltaE00(lab, paletteLab[index])
      if (score < bestScore) { bestScore = score; bestIndex = index }
    }
    return bestIndex
  }
  const variants = {} as Record<Mode, number[]>
  for (const mode of MODES) {
    const cells = new Array<number>(source.length).fill(-1)
    const err = mode === 'photo' ? new Float32Array(source.length * 3) : null
    for (let i = 0; i < source.length; i++) {
      const lab = source[i]
      if (!lab) continue
      const adjusted: Lab = err ? [lab[0] + err[i * 3], lab[1] + err[i * 3 + 1], lab[2] + err[i * 3 + 2]] : lab
      cells[i] = nearest(adjusted)
      if (err) {
        const chosen = paletteLab[cells[i]]
        const spread = (at: number, amount: number) => {
          if (at < 0 || at >= source.length || !source[at]) return
          for (let k = 0; k < 3; k++) err[at * 3 + k] += (adjusted[k] - chosen[k]) * amount * 0.32
        }
        if (i % width < width - 1) spread(i + 1, 7 / 16)
        if (Math.floor(i / width) < height - 1) {
          if (i % width > 0) spread(i + width - 1, 3 / 16)
          spread(i + width, 5 / 16)
          if (i % width < width - 1) spread(i + width + 1, 1 / 16)
        }
      }
    }
    if (mode !== 'photo') {
      const original = cells.slice()
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const i = y * width + x, lab = source[i]
        if (!lab || (mode === 'clear' && weights[i] > 1.35)) continue
        const neighbors = [original[i - 1], original[i + 1], original[i - width], original[i + width]]
        const counts = new Map<number, number>()
        neighbors.forEach(n => { if (n >= 0) counts.set(n, (counts.get(n) || 0) + 1) })
        const [replacement, count] = [...counts].sort((a, b) => b[1] - a[1])[0] || [-1, 0]
        const needed = mode === 'clear' ? 4 : 3
        if (replacement >= 0 && replacement !== original[i] && count >= needed && deltaE00(lab, paletteLab[replacement]) - deltaE00(lab, paletteLab[original[i]]) < (mode === 'clear' ? 5 : 10)) cells[i] = replacement
      }
    }
    variants[mode] = cells
  }
  return { colors: available, variants }
}
