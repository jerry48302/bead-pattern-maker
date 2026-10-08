import type { BeadColor, Palette } from './types'
import perlerCsv from './data/beadcolors/perler.csv?raw'
import hamaCsv from './data/beadcolors/hama.csv?raw'
import artkalSCsv from './data/beadcolors/artkal_s.csv?raw'
import artkalMCsv from './data/beadcolors/artkal_m.csv?raw'
import nabbiCsv from './data/beadcolors/nabbi.csv?raw'

const make = (rows: string): BeadColor[] => rows.trim().split('\n').map(line => {
  const [code, name, hex] = line.split('|')
  return { code, name, hex: `#${hex}` }
})

function communityColors(csv: string): BeadColor[] {
  return csv.trim().split(/\r?\n/).map(row => {
    const [code, name, r, g, b] = row.split(',')
    const hex = `#${[r, g, b].map(v => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`
    const finish = /transparent|translucent|clear/i.test(name) ? 'transparent'
      : /glitter|sparkle/i.test(name) ? 'glitter'
      : /glow/i.test(name) ? 'glow'
      : /neon|pearl|metallic|stripe/i.test(name) ? 'other' : 'solid'
    return { code, name, hex, finish }
  })
}

const communityPalette = (id: string, name: string, csv: string, pitchMm: number): Palette => ({
  id, name, pitchMm, version: 'beadcolors-f97ff42', sourceDate: '2026-08-17',
  source: 'BeadColors MIT 社区数据；色号与屏幕 RGB 未获品牌官方认证', confidence: 'reference',
  colors: communityColors(csv),
})

// These are screen approximations for trying the workflow, not measured plastic colors.
// A production brand profile must be imported from a checked, versioned source.
export const palettes: Palette[] = [
  communityPalette('perler-community', 'Perler · 社区色卡', perlerCsv, 5),
  communityPalette('hama-midi-community', 'Hama Midi · 社区色卡', hamaCsv, 5),
  communityPalette('artkal-s-community', 'Artkal S 5mm · 社区色卡', artkalSCsv, 5),
  communityPalette('artkal-m-community', 'Artkal M 2.6mm · 社区色卡', artkalMCsv, 2.6),
  communityPalette('nabbi-legacy-community', 'NABBI 30 色 · 社区旧版', nabbiCsv, 5),
  {
    id: 'studio-36', name: '小豆基础 36 色', version: 'demo-2026-10', sourceDate: '2026-10-06',
    source: '项目自制显示参考色；非品牌官方色卡', confidence: 'reference', pitchMm: 5,
    colors: make(`T01|奶油白|F9F5E9
T02|雪白|FFFFFF
T03|浅灰|D9D9D4
T04|中灰|A7A7A1
T05|深灰|696B70
T06|炭黑|292B32
T07|香草黄|F8E8A5
T08|明黄|F8D456
T09|金黄|EDAA30
T10|蜜橙|EF883A
T11|杏桃|F4AA83
T12|珊瑚|EE7768
T13|大红|D94745
T14|酒红|913D50
T15|浅粉|F8CDD1
T16|樱粉|EB9CB8
T17|玫红|CB628F
T18|浅紫|D9C7E8
T19|薰衣草|AD95CB
T20|深紫|765D9C
T21|天蓝|B7D9ED
T22|湖蓝|77B6DA
T23|钴蓝|4C85BB
T24|海军蓝|334E78
T25|薄荷|C8E6D6
T26|青绿|80C6AF
T27|草绿|8DBB6A
T28|深绿|487A5A
T29|米黄|F1D5AC
T30|肤色|E9B894
T31|浅棕|BE875D
T32|棕色|8F604A
T33|深棕|654636
T34|赭石|AF6549
T35|橄榄|93945C
T36|浅青|ABD9D8`),
  },
  {
    id: 'grayscale-12', name: '灰阶 12 色', version: 'demo-2026-10', sourceDate: '2026-10-06',
    source: '项目自制显示参考色；适合测试单色图案', confidence: 'reference', pitchMm: 5,
    colors: make(`G01|纯白|FFFFFF
G02|雾白|F1F1EE
G03|浅灰一|E0E0DD
G04|浅灰二|CBCBC9
G05|中浅灰|B7B7B5
G06|中灰|9C9D9D
G07|石墨灰|818287
G08|钢灰|686A70
G09|深灰一|51535B
G10|深灰二|3E4149
G11|炭灰|30323A
G12|黑色|202126`),
  },
]

function splitCsvLine(line: string): string[] {
  const output: string[] = []
  let value = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && quoted && line[i + 1] === '"') { value += '"'; i++ }
    else if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { output.push(value.trim()); value = '' }
    else value += ch
  }
  output.push(value.trim())
  return output
}

export function parsePaletteCsv(text: string, filename: string): Palette {
  const rows = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(Boolean)
  if (rows.length < 2) throw new Error('CSV 至少需要表头和一种颜色')
  const head = splitCsvLine(rows.shift()!).map(v => v.toLowerCase())
  const codeAt = head.indexOf('code'), nameAt = head.indexOf('name'), hexAt = head.indexOf('hex')
  if (codeAt < 0 || hexAt < 0) throw new Error('CSV 表头必须包含 code,hex；可选 name')
  const colors = rows.map((row, i) => {
    const cells = splitCsvLine(row)
    const code = cells[codeAt], name = nameAt >= 0 ? cells[nameAt] : code
    const hex = cells[hexAt]?.toUpperCase()
    if (!code || !/^#?[0-9A-F]{6}$/.test(hex || '')) throw new Error(`第 ${i + 2} 行的色号或 HEX 无效`)
    return { code, name: name || code, hex: hex.startsWith('#') ? hex : `#${hex}` }
  })
  if (colors.length > 300) throw new Error('一次最多导入 300 色')
  if (new Set(colors.map(c => c.code)).size !== colors.length) throw new Error('CSV 中有重复色号')
  return { id: `custom-${Date.now()}`, name: filename.replace(/\.csv$/i, ''), version: 'imported-1', sourceDate: new Date().toISOString().slice(0, 10), source: '用户导入 CSV', confidence: 'custom', colors }
}

export function parsePaletteJson(text: string, filename: string): Palette {
  const input: unknown = JSON.parse(text)
  const raw = Array.isArray(input) ? input : input && typeof input === 'object' && 'colors' in input ? input.colors : null
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 300) throw new Error('JSON 需要 1–300 个 colors')
  const colors: BeadColor[] = raw.map((item, i) => {
    const code = String(item?.code ?? '').trim()
    const name = String(item?.name ?? code).trim()
    const value = String(item?.hex ?? '').trim().toUpperCase()
    if (!code || !/^#?[0-9A-F]{6}$/.test(value)) throw new Error(`第 ${i + 1} 种颜色的 code 或 hex 无效`)
    return { code, name, hex: value.startsWith('#') ? value : `#${value}` }
  })
  if (new Set(colors.map(c => c.code)).size !== colors.length) throw new Error('JSON 中有重复色号')
  const name = !Array.isArray(input) && input && typeof input === 'object' && 'name' in input && typeof input.name === 'string' ? input.name : filename.replace(/\.json$/i, '')
  return { id: `custom-${Date.now()}`, name, version: 'imported-1', sourceDate: new Date().toISOString().slice(0, 10), source: '用户导入 JSON', confidence: 'custom', colors }
}
