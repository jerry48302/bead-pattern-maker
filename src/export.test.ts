import { describe, expect, it } from 'vitest'
import { csvTextFor, svgTextFor } from './export'
import type { Pattern } from './types'

const pattern: Pattern = {
  schema: 1,
  width: 2,
  height: 2,
  cells: [0, 1, -1, 0],
  palette: {
    id: 'test', name: '测试色卡', version: '1', sourceDate: '2026-01-01', source: 'test', confidence: 'custom',
    colors: [
      { code: '@A', name: '红', hex: '#ff0000' },
      { code: 'B&2', name: '蓝', hex: '#0000ff' },
      { code: 'unused', name: '未使用', hex: '#00ff00' },
    ],
  },
  title: '测试 & <图纸>', mode: 'balanced', createdAt: '2026-01-01',
}

describe('exported pattern content', () => {
  it('keeps bead counts, spare quantities and blank cells in CSV', () => {
    const csv = csvTextFor(pattern, 5)
    expect(csv.startsWith('\uFEFF色号,名称,符号,颜色HEX,数量,含备品数量\r\n')).toBe(true)
    expect(csv).toContain('"\'@A","红","A","#ff0000","2","3"')
    expect(csv).toContain('"B&2","蓝","B","#0000ff","1","2"')
    expect(csv).toContain('总豆数,3')
    expect(csv).toContain('"-","\'@A"')
    expect(csv).not.toContain('unused')
  })

  it('escapes text and lists only used colors in SVG', () => {
    const svg = svgTextFor(pattern, true)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="112" height="228"')
    expect(svg).toContain('测试 &amp; &lt;图纸&gt;')
    expect(svg).toContain('B&amp;2 ×1')
    expect(svg).not.toContain('unused')
    expect((svg.match(/<rect x=/g) || []).length).toBe(6)
  })
})
