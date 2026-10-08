import { describe, expect, it } from 'vitest'
import { deltaE00, rgbToLab } from './color'

describe('CIEDE2000', () => {
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
    [[50, 0, 0], [50, -1, 2], 2.3669],
  ] as const)('matches a published Sharma reference pair', (a, b, expected) => {
    expect(deltaE00([...a], [...b])).toBeCloseTo(expected, 3)
  })
  it('maps white and black to opposite ends of L', () => {
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 3)
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 3)
  })
})
