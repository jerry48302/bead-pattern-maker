import type { Pattern } from './types'

const symbols = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
export const symbolFor = (i: number) => symbols[i] || String(i + 1)
export const countsFor = (pattern: Pattern) => {
  const counts = new Array(pattern.palette.colors.length).fill(0) as number[]
  pattern.cells.forEach(cell => { if (cell >= 0 && cell < counts.length) counts[cell]++ })
  return counts
}
export const symbolsFor = (pattern: Pattern) => {
  const counts = countsFor(pattern)
  let rank = 0
  return counts.map(n => n ? symbolFor(rank++) : '')
}

const safeName = (title: string) => title.trim().replace(/[\\/:*?"<>|\x00-\x1F]/g, '-').slice(0, 50) || '拼豆图纸'
const csvCell = (input: string | number) => {
  const value = String(input)
  const safe = value !== '-' && /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}
const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片导出失败')), 'image/png'))

interface DrawOptions {
  startX?: number
  startY?: number
  width?: number
  height?: number
  cell?: number
  showGrid?: boolean
  showSymbols?: boolean
  showLegend?: boolean
  focusColor?: number | null
  spare?: number
}

export function drawChart(pattern: Pattern, options: DrawOptions = {}): HTMLCanvasElement {
  const startX = options.startX || 0, startY = options.startY || 0
  const width = options.width || pattern.width, height = options.height || pattern.height
  const cell = options.cell || (Math.max(width, height) > 100 ? 12 : 20)
  const showGrid = options.showGrid ?? true, showSymbols = options.showSymbols ?? false
  const showLegend = options.showLegend ?? false
  const labels = symbolsFor(pattern)
  const localCounts = new Array(pattern.palette.colors.length).fill(0) as number[]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = pattern.cells[(startY + y) * pattern.width + startX + x]
    if (index >= 0 && index < localCounts.length) localCounts[index]++
  }
  const legendIndices = localCounts.map((n, i) => n ? i : -1).filter(i => i >= 0)
  const legendColumns = Math.max(1, Math.min(4, Math.floor(width * cell / 180)))
  const margin = showLegend ? 42 : 0
  const legendHeight = showLegend ? 64 + Math.ceil(legendIndices.length / legendColumns) * 29 : 0
  const canvas = document.createElement('canvas')
  canvas.width = width * cell + margin * 2
  canvas.height = height * cell + margin * 2 + legendHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fffdf8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (showLegend) {
    ctx.fillStyle = '#252b2b'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillText(pattern.title || '拼豆图纸', margin, 29)
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#6c7471'
    ctx.fillText(`${pattern.width} × ${pattern.height} 格 · ${countsFor(pattern).reduce((a, b) => a + b, 0)} 颗 · ${pattern.palette.name} · ${pattern.palette.version}`, margin, 49)
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = pattern.cells[(startY + y) * pattern.width + startX + x]
    const px = margin + x * cell, py = margin + y * cell
    if (index >= 0) {
      const color = pattern.palette.colors[index]
      ctx.fillStyle = color?.hex || '#ff00ff'
      ctx.fillRect(px, py, cell, cell)
      if (options.focusColor != null && index !== options.focusColor) {
        ctx.fillStyle = 'rgba(255,255,255,.78)'
        ctx.fillRect(px, py, cell, cell)
      }
      if (showSymbols && cell >= 12) {
        const hex = (color?.hex || '#ffffff').slice(1)
        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
        ctx.fillStyle = (r * 0.2126 + g * 0.7152 + b * 0.0722) < 150 ? '#ffffff' : '#182022'
        ctx.font = `bold ${Math.max(9, Math.floor(cell * 0.55))}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(labels[index], px + cell / 2, py + cell / 2 + 1)
      }
    } else {
      ctx.fillStyle = (x + y) % 2 ? '#f3f0eb' : '#fffdf8'
      ctx.fillRect(px, py, cell, cell)
      if (showSymbols && cell >= 16) {
        ctx.fillStyle = '#b7b4ae'; ctx.font = `bold ${Math.floor(cell * .58)}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('×', px + cell / 2, py + cell / 2)
      }
    }
  }
  if (showGrid) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(50,55,55,.25)'
    ctx.beginPath()
    for (let x = 0; x <= width; x++) { const px = margin + x * cell + .5; ctx.moveTo(px, margin); ctx.lineTo(px, margin + height * cell) }
    for (let y = 0; y <= height; y++) { const py = margin + y * cell + .5; ctx.moveTo(margin, py); ctx.lineTo(margin + width * cell, py) }
    ctx.stroke()
    ctx.strokeStyle = 'rgba(27,43,40,.7)'; ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= width; x += 29) { const px = margin + x * cell + .5; ctx.moveTo(px, margin); ctx.lineTo(px, margin + height * cell) }
    for (let y = 0; y <= height; y += 29) { const py = margin + y * cell + .5; ctx.moveTo(margin, py); ctx.lineTo(margin + width * cell, py) }
    ctx.stroke()
  }
  if (showLegend) {
    const step = width > 100 ? 10 : 5
    ctx.fillStyle = '#66766b'
    ctx.font = `${Math.max(10, Math.min(13, Math.floor(cell * .4)))}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let x = 0; x < width; x += step) ctx.fillText(String(startX + x + 1), margin + (x + .5) * cell, margin - 12)
    ctx.textAlign = 'right'
    for (let y = 0; y < height; y += step) ctx.fillText(String(startY + y + 1), margin - 7, margin + (y + .5) * cell)
  }
  if (showLegend) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    const top = margin + height * cell + 32
    ctx.fillStyle = '#252b2b'; ctx.font = 'bold 15px sans-serif'
    ctx.fillText(options.spare ? `色号 / 符号 / 用量 / 含 ${options.spare}% 备品` : '色号 / 符号 / 用量', margin, top)
    legendIndices.forEach((i, position) => {
      const color = pattern.palette.colors[i]
      const col = position % legendColumns, row = Math.floor(position / legendColumns)
      const x = margin + col * ((canvas.width - margin * 2) / legendColumns)
      const y = top + 18 + row * 29
      ctx.fillStyle = color.hex; ctx.fillRect(x, y, 18, 18)
      ctx.strokeStyle = '#8c928d'; ctx.strokeRect(x, y, 18, 18)
      ctx.fillStyle = '#252b2b'; ctx.font = '12px sans-serif'
      ctx.fillText(`${labels[i]}  ${color.code}  ×${localCounts[i]}${options.spare ? ` / ${Math.ceil(localCounts[i] * (1 + options.spare / 100))}` : ''}`, x + 25, y + 14)
    })
  }
  return canvas
}

export async function exportPng(pattern: Pattern, symbols = false) {
  const canvas = drawChart(pattern, { cell: Math.max(16, Math.min(32, Math.floor(1600 / Math.max(pattern.width, pattern.height)))), showSymbols: symbols, showLegend: true })
  download(await canvasBlob(canvas), `${safeName(pattern.title)}.png`)
}

export function csvTextFor(pattern: Pattern, spare = 0) {
  const count = countsFor(pattern)
  const labels = symbolsFor(pattern)
  const lines = ['色号,名称,符号,颜色HEX,数量,含备品数量']
  pattern.palette.colors.forEach((c, i) => { if (count[i]) lines.push([c.code, c.name, labels[i], c.hex, count[i], Math.ceil(count[i] * (1 + spare / 100))].map(csvCell).join(',')) })
  lines.push('', `宽度,${pattern.width}`, `高度,${pattern.height}`, `总豆数,${count.reduce((a, b) => a + b, 0)}`)
  lines.push('', '逐格矩阵（空白=-）')
  for (let y = 0; y < pattern.height; y++) lines.push(pattern.cells.slice(y * pattern.width, (y + 1) * pattern.width).map(i => csvCell(i < 0 ? '-' : pattern.palette.colors[i]?.code || '?')).join(','))
  return '\uFEFF' + lines.join('\r\n')
}

export function exportCsv(pattern: Pattern, spare = 0) {
  download(new Blob([csvTextFor(pattern, spare)], { type: 'text/csv;charset=utf-8' }), `${safeName(pattern.title)}.csv`)
}

const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export function svgTextFor(pattern: Pattern, symbols = false) {
  const labels = symbolsFor(pattern)
  const counts = countsFor(pattern)
  const usedColors = pattern.palette.colors.map((color, index) => ({ color, index })).filter(({ index }) => counts[index] > 0)
  const cell = 20, margin = 36
  const legendColumns = Math.max(1, Math.min(4, Math.floor(pattern.width * cell / 180)))
  const width = pattern.width * cell + margin * 2, height = pattern.height * cell + margin * 2 + 60 + Math.ceil(usedColors.length / legendColumns) * 28
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, `<rect width="100%" height="100%" fill="#fffdf8"/>`, `<text x="${margin}" y="27" font-family="sans-serif" font-size="19" font-weight="bold">${esc(pattern.title)}</text>`]
  for (let y = 0; y < pattern.height; y++) for (let x = 0; x < pattern.width; x++) {
    const i = pattern.cells[y * pattern.width + x], px = margin + x * cell, py = margin + y * cell
    parts.push(`<rect x="${px}" y="${py}" width="${cell}" height="${cell}" fill="${i < 0 ? '#f3f0eb' : pattern.palette.colors[i]?.hex || '#ff00ff'}" stroke="#a7aba7" stroke-width=".5"/>`)
    if (symbols && i >= 0) parts.push(`<text x="${px + 10}" y="${py + 14}" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#202525" stroke="#fff" stroke-width="2" paint-order="stroke">${esc(labels[i])}</text>`)
  }
  usedColors.forEach(({ color, index }, position) => {
    const col = position % legendColumns, row = Math.floor(position / legendColumns), x = margin + col * ((width - margin * 2) / legendColumns), y = margin + pattern.height * cell + 28 + row * 28
    parts.push(`<rect x="${x}" y="${y - 14}" width="16" height="16" fill="${color.hex}" stroke="#666"/><text x="${x + 22}" y="${y}" font-family="sans-serif" font-size="12">${esc(labels[index])} ${esc(color.code)} ×${counts[index]}</text>`)
  })
  parts.push('</svg>')
  return parts.join('')
}

export function exportSvg(pattern: Pattern, symbols = false) {
  download(new Blob([svgTextFor(pattern, symbols)], { type: 'image/svg+xml;charset=utf-8' }), `${safeName(pattern.title)}.svg`)
}

export async function exportPdf(pattern: Pattern, spare = 0) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const cover = drawChart(pattern, { cell: Math.max(5, Math.floor(780 / Math.max(pattern.width, pattern.height))), showGrid: true, showSymbols: false, showLegend: true, spare })
  const coverRatio = cover.width / cover.height
  const coverW = Math.min(190, 275 * coverRatio), coverH = coverW / coverRatio
  pdf.addImage(cover.toDataURL('image/png'), 'PNG', (210 - coverW) / 2, 12, coverW, coverH)
  const boardSize = 29
  for (let by = 0; by < pattern.height; by += boardSize) for (let bx = 0; bx < pattern.width; bx += boardSize) {
    pdf.addPage()
    const boardWidth = Math.min(boardSize, pattern.width - bx), boardHeight = Math.min(boardSize, pattern.height - by)
    const board = drawChart({ ...pattern, title: `${pattern.title} · 分板 ${Math.floor(bx / boardSize) + 1}-${Math.floor(by / boardSize) + 1} · 列 ${bx + 1}–${bx + boardWidth} / 行 ${by + 1}–${by + boardHeight}` }, { startX: bx, startY: by, width: boardWidth, height: boardHeight, cell: 36, showGrid: true, showSymbols: true, showLegend: true })
    const ratio = board.width / board.height
    const w = Math.min(190, 275 * ratio), h = w / ratio
    pdf.addImage(board.toDataURL('image/png'), 'PNG', (210 - w) / 2, 10, w, h)
  }
  download(pdf.output('blob'), `${safeName(pattern.title)}.pdf`)
}
