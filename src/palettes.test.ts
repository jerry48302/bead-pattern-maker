import { describe, expect, it } from 'vitest'
import { palettes, parsePaletteCsv, parsePaletteJson } from './palettes'

describe('palette data', () => {
  it('keeps the imported community systems separate and uniquely coded', () => {
    const expected = new Map([
      ['perler-community', 103],
      ['hama-midi-community', 92],
      ['artkal-s-community', 199],
      ['artkal-m-community', 220],
      ['nabbi-legacy-community', 30],
    ])
    for (const [id, count] of expected) {
      const palette = palettes.find(p => p.id === id)!
      expect(palette.colors).toHaveLength(count)
      expect(new Set(palette.colors.map(c => c.code)).size).toBe(count)
      expect(palette.colors.every(c => /^#[0-9A-F]{6}$/.test(c.hex))).toBe(true)
      expect(palette.version).toMatch(/^beadcolors-/)
    }
  })
  it('rejects duplicate or invalid user codes', () => {
    expect(() => parsePaletteCsv('code,name,hex\nA,Red,#FF0000\nA,Blue,#0000FF', 'x.csv')).toThrow(/重复/)
    expect(() => parsePaletteCsv('code,name,hex\nA,Red,red', 'x.csv')).toThrow(/无效/)
  })
  it('imports a JSON palette with validated colors', () => {
    const palette = parsePaletteJson('{"name":"我的库存","colors":[{"code":"A1","name":"红","hex":"#AA0011"}]}', 'mine.json')
    expect(palette.name).toBe('我的库存')
    expect(palette.colors[0].hex).toBe('#AA0011')
  })
  it('reads quoted CSV names without splitting their commas', () => {
    const palette = parsePaletteCsv('code,name,hex\nA1,"Red, bright",#AA0011', 'mine.csv')
    expect(palette.colors[0].name).toBe('Red, bright')
  })
})
