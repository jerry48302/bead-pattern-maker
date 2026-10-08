import { describe, expect, it } from 'vitest'
import { generate } from './generate'
import type { Palette } from '../types'

const palette: Palette = {
  id: 'test', name: 'test', version: '1', sourceDate: '2026-10-06', source: 'test', confidence: 'custom',
  colors: [
    { code: 'W', name: 'white', hex: '#FFFFFF' },
    { code: 'B', name: 'black', hex: '#000000' },
    { code: 'R', name: 'red', hex: '#FF0000' },
  ],
}

describe('generator constraints', () => {
  it('uses only allowed colors and respects K in every variant', () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255, 0, 0, 0, 255,
      255, 0, 0, 255, 255, 255, 255, 255,
    ])
    const result = generate({ width: 2, height: 2, rgba, palette, maxColors: 2, transparent: false })
    for (const cells of Object.values(result.variants)) {
      expect(cells).toHaveLength(4)
      expect(new Set(cells).size).toBeLessThanOrEqual(2)
      expect(cells.every(i => i >= 0 && i < palette.colors.length)).toBe(true)
    }
  })
  it('keeps transparent source cells empty', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 255])
    const result = generate({ width: 2, height: 1, rgba, palette, maxColors: 2, transparent: true })
    for (const cells of Object.values(result.variants)) expect(cells[0]).toBe(-1)
  })
  it('retains a small dark facial detail under a four-color limit', () => {
    const width = 30, height = 30
    const rgba = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4
      const eye = (x >= 9 && x <= 11 && y >= 11 && y <= 13) || (x >= 19 && x <= 21 && y >= 11 && y <= 13)
      const face = (x - 15) ** 2 + (y - 15) ** 2 < 10 ** 2
      const color = eye ? [25, 28, 32] : face ? [175, 109, 67] : [244, 217, 184]
      rgba.set([...color, 255], p)
    }
    const result = generate({ width, height, rgba, palette, maxColors: 3, transparent: false })
    const cells = result.variants.balanced
    expect(cells[12 * width + 10]).toBe(cells[12 * width + 20])
    expect(cells[12 * width + 10]).not.toBe(cells[15 * width + 15])
  })
})
