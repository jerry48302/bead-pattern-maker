import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Check, ChevronDown, Download, Eraser, Eye, FileImage, FileSpreadsheet, FileText, Grid2X2, ImagePlus, LockKeyhole, PaintBucket, Paintbrush, Pipette, Redo2, RotateCw, Search, Sparkles, Undo2, WandSparkles, X, ZoomIn, ZoomOut } from 'lucide-react'
import { loadRecent, saveRecent } from './db'
import { countsFor, drawChart, exportCsv, exportPdf, exportPng, exportSvg, symbolsFor } from './export'
import { palettes, parsePaletteCsv, parsePaletteJson } from './palettes'
import type { BeadColor, GenerationResult, Mode, Palette, Pattern, Tool } from './types'
import './style.css'

const modes: { id: Mode; name: string; detail: string }[] = [
  { id: 'clear', name: '清晰', detail: '保留轮廓，适合插画' },
  { id: 'balanced', name: '均衡', detail: '干净自然，推荐使用' },
  { id: 'photo', name: '照片', detail: '更丰富的渐变纹理' },
]
const toolLabels: { id: Tool; name: string; Icon: typeof Paintbrush }[] = [
  { id: 'paint', name: '画笔', Icon: Paintbrush },
  { id: 'erase', name: '擦除', Icon: Eraser },
  { id: 'pick', name: '吸管', Icon: Pipette },
  { id: 'fill', name: '填充', Icon: PaintBucket },
  { id: 'replace', name: '换色', Icon: WandSparkles },
]
const today = () => new Date().toISOString()
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

function App() {
  const [allPalettes, setAllPalettes] = useState(palettes)
  const [paletteId, setPaletteId] = useState(palettes[0].id)
  const palette = allPalettes.find(p => p.id === paletteId) || allPalettes[0]
  const [enabled, setEnabled] = useState<string[]>(palette.colors.filter(c => !c.finish || c.finish === 'solid').map(c => c.code))
  const [search, setSearch] = useState('')
  const [showPalette, setShowPalette] = useState(false)
  const [width, setWidth] = useState(58)
  const [height, setHeight] = useState(58)
  const [linked, setLinked] = useState(true)
  const [maxColors, setMaxColors] = useState(16)
  const [background, setBackground] = useState<'white' | 'transparent'>('white')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [sourceName, setSourceName] = useState('')
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [variants, setVariants] = useState<Record<Mode, number[]> | null>(null)
  const [pattern, setPattern] = useState<Pattern | null>(null)
  const [activeMode, setActiveMode] = useState<Mode>('balanced')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [tool, setTool] = useState<Tool>('paint')
  const [paintCode, setPaintCode] = useState<string | null>(null)
  const [focusColor, setFocusColor] = useState<number | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showSymbols, setShowSymbols] = useState(false)
  const [previewScale, setPreviewScale] = useState(1)
  const [spare, setSpare] = useState(5)
  const [exporting, setExporting] = useState(false)
  const [undo, setUndo] = useState<number[][]>([])
  const [redo, setRedo] = useState<number[][]>([])
  const cropCanvas = useRef<HTMLCanvasElement>(null)
  const patternCanvas = useRef<HTMLCanvasElement>(null)
  const sourceInput = useRef<HTMLInputElement>(null)
  const paletteInput = useRef<HTMLInputElement>(null)
  const sourceUrl = useRef<string | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const drawing = useRef(false)
  const worker = useRef<Worker | null>(null)
  const jobId = useRef(0)

  const allowed = useMemo(() => palette.colors.filter(c => enabled.includes(c.code)), [palette, enabled])
  const counts = useMemo(() => pattern ? countsFor(pattern) : [], [pattern])
  const labels = useMemo(() => pattern ? symbolsFor(pattern) : [], [pattern])
  const total = counts.reduce((a, b) => a + b, 0)
  const used = counts.filter(Boolean).length
  const rotatedImage = useMemo(() => {
    if (!image) return null
    const canvas = document.createElement('canvas')
    canvas.width = rotation % 180 ? image.height : image.width
    canvas.height = rotation % 180 ? image.width : image.height
    const ctx = canvas.getContext('2d')!
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(rotation * Math.PI / 180)
    ctx.drawImage(image, -image.width / 2, -image.height / 2)
    return canvas
  }, [image, rotation])

  useEffect(() => {
    loadRecent().then(saved => {
      if (saved?.schema === 1 && saved.cells?.length === saved.width * saved.height) {
        setPattern(saved)
        setWidth(saved.width); setHeight(saved.height); setActiveMode(saved.mode)
        setNotice('已恢复上次编辑的图纸')
      }
    }).catch(() => {})
    return () => { if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current); worker.current?.terminate() }
  }, [])
  useEffect(() => {
    if (!pattern) return
    const timer = setTimeout(() => { saveRecent(pattern).catch(() => {}) }, 450)
    return () => clearTimeout(timer)
  }, [pattern])
  useEffect(() => { if (image) setDirty(true) }, [width, height, maxColors, enabled, paletteId, background, zoom, pan, rotation, image])

  const frame = useCallback((canvas: HTMLCanvasElement, w: number, h: number) => {
    if (!rotatedImage) return
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.clearRect(0, 0, w, h)
    if (background === 'white') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h) }
    const scale = Math.max(w / rotatedImage.width, h / rotatedImage.height) * zoom
    const dw = rotatedImage.width * scale, dh = rotatedImage.height * scale
    ctx.drawImage(rotatedImage, clamp((w - dw) / 2 + pan.x * w, w - dw, 0), clamp((h - dh) / 2 + pan.y * h, h - dh, 0), dw, dh)
  }, [rotatedImage, background, zoom, pan])
  useEffect(() => {
    const canvas = cropCanvas.current
    if (canvas && image && width >= 12 && height >= 12 && width <= 200 && height <= 200) frame(canvas, 460, Math.round(460 * height / width))
  }, [frame, image, width, height])
  useEffect(() => {
    const canvas = patternCanvas.current
    if (!canvas || !pattern) return
    const rendered = drawChart(pattern, { showGrid, showSymbols, focusColor })
    canvas.width = rendered.width; canvas.height = rendered.height
    canvas.getContext('2d')!.drawImage(rendered, 0, 0)
  }, [pattern, showGrid, showSymbols, focusColor])

  async function uploadImage(file?: File) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) { setError('请选择 JPG、PNG 或 WebP 图片'); return }
    if (file.size > 35 * 1024 * 1024) { setError('图片超过 35 MB，请先压缩'); return }
    try {
      const url = URL.createObjectURL(file)
      const original = new Image()
      original.src = url
      await original.decode()
      const scale = Math.min(1, 2048 / Math.max(original.naturalWidth, original.naturalHeight))
      const small = document.createElement('canvas')
      small.width = Math.round(original.naturalWidth * scale)
      small.height = Math.round(original.naturalHeight * scale)
      small.getContext('2d')!.drawImage(original, 0, 0, small.width, small.height)
      const thumb = new Image()
      thumb.src = small.toDataURL('image/png')
      await thumb.decode()
      URL.revokeObjectURL(url)
      setImage(thumb); setSourceName(file.name.replace(/\.[^.]+$/, ''))
      setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0)
      if (linked) setHeight(clamp(Math.round(width * thumb.height / thumb.width), 12, 200))
      setNotice('图片已在本机打开，可以调整裁剪区域')
    } catch {
      setError('无法打开这张图片。iPhone HEIC 若不受浏览器支持，请先转为 JPG。')
    }
  }

  function changePalette(id: string) {
    const next = allPalettes.find(p => p.id === id)!
    setPaletteId(id); setEnabled(next.colors.filter(c => !c.finish || c.finish === 'solid').map(c => c.code)); setPaintCode(null)
    setMaxColors(v => Math.min(v, next.colors.length))
  }
  async function importPalette(file?: File) {
    if (!file) return
    try {
      const content = await file.text()
      const custom = file.name.toLowerCase().endsWith('.json') ? parsePaletteJson(content, file.name) : parsePaletteCsv(content, file.name)
      setAllPalettes(v => [...v, custom]); setPaletteId(custom.id)
      setEnabled(custom.colors.map(c => c.code)); setMaxColors(v => Math.min(v, custom.colors.length))
      setShowPalette(true); setNotice(`已导入 ${custom.colors.length} 色`); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : '色卡导入失败') }
  }

  async function generatePattern() {
    if (!image) { sourceInput.current?.click(); return }
    if (width < 12 || height < 12 || width > 200 || height > 200) { setError('宽和高需在 12–200 格之间'); return }
    if (allowed.length < 2) { setError('请至少选择两种可用颜色'); return }
    setBusy(true); setError(''); setNotice('')
    const canvas = document.createElement('canvas')
    frame(canvas, width, height)
    const rgba = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data
    if (!worker.current) worker.current = new Worker(new URL('./core/worker.ts', import.meta.url), { type: 'module' })
    const id = ++jobId.current
    worker.current.onmessage = (event: MessageEvent<{ id: number; result?: GenerationResult; error?: string }>) => {
      if (event.data.id !== jobId.current) return
      setBusy(false)
      if (event.data.error || !event.data.result) { setError(event.data.error || '生成失败'); return }
      const result = event.data.result
      const selectedPalette: Palette = { ...palette, colors: result.colors }
      const next: Pattern = { schema: 1, width, height, cells: result.variants.balanced, palette: selectedPalette, title: sourceName || '我的拼豆图纸', mode: 'balanced', createdAt: today(), maxColors: clamp(maxColors, 2, allowed.length) }
      setVariants(result.variants); setPattern(next); setActiveMode('balanced')
      setPaintCode(result.colors[0]?.code || null)
      setUndo([]); setRedo([]); setDirty(false)
      setNotice('三种方案已生成，选喜欢的版本后可逐格调整')
    }
    worker.current.postMessage({ id, request: { width, height, rgba, palette: { ...palette, colors: allowed }, maxColors: clamp(maxColors, 2, allowed.length), transparent: background === 'transparent' } }, [rgba.buffer])
  }

  function selectMode(mode: Mode) {
    if (!pattern) return
    if (!variants) { setNotice('已恢复上次图纸；重新上传原图并生成后可比较三种方案'); return }
    setPattern({ ...pattern, cells: variants[mode].slice(), mode })
    setActiveMode(mode); setUndo([]); setRedo([])
  }
  function editCell(index: number) {
    if (!pattern || index < 0 || index >= pattern.cells.length) return
    const current = pattern.cells[index]
    if (tool === 'pick') { if (current >= 0) setPaintCode(pattern.palette.colors[current].code); setTool('paint'); return }
    const colorIndex = tool === 'erase' ? -1 : pattern.palette.colors.findIndex(c => c.code === paintCode)
    if (tool !== 'erase' && colorIndex < 0) return
    const cells = pattern.cells.slice()
    if (tool === 'fill') {
      if (current === colorIndex) return
      const queue = [index]; cells[index] = colorIndex
      for (let k = 0; k < queue.length; k++) {
        const at = queue[k], x = at % pattern.width
        const neighbors = [x > 0 ? at - 1 : -1, x < pattern.width - 1 ? at + 1 : -1, at >= pattern.width ? at - pattern.width : -1, at < cells.length - pattern.width ? at + pattern.width : -1]
        neighbors.forEach(n => { if (n >= 0 && cells[n] === current) { cells[n] = colorIndex; queue.push(n) } })
      }
    } else if (tool === 'replace') {
      if (current === colorIndex) return
      for (let i = 0; i < cells.length; i++) if (cells[i] === current) cells[i] = colorIndex
    } else { if (current === colorIndex) return; cells[index] = colorIndex }
    if (new Set(cells.filter(n => n >= 0)).size > (pattern.maxColors || 64)) { setError(`这张图最多使用 ${pattern.maxColors} 色；请先替换已有颜色或重新设置上限`); return }
    setUndo(v => [...v.slice(-24), pattern.cells]); setRedo([])
    setPattern({ ...pattern, cells })
    setVariants(v => v ? { ...v, [activeMode]: cells } : v)
  }
  function canvasCell(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!pattern) return -1
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / rect.width * pattern.width)
    const y = Math.floor((event.clientY - rect.top) / rect.height * pattern.height)
    return x < 0 || x >= pattern.width || y < 0 || y >= pattern.height ? -1 : y * pattern.width + x
  }
  function history(direction: 'undo' | 'redo') {
    if (!pattern) return
    const stack = direction === 'undo' ? undo : redo
    if (!stack.length) return
    const next = stack[stack.length - 1]
    if (direction === 'undo') { setUndo(stack.slice(0, -1)); setRedo(v => [...v, pattern.cells]) }
    else { setRedo(stack.slice(0, -1)); setUndo(v => [...v, pattern.cells]) }
    setPattern({ ...pattern, cells: next })
    setVariants(v => v ? { ...v, [activeMode]: next } : v)
  }
  async function doExport(kind: 'png' | 'svg' | 'csv' | 'pdf') {
    if (!pattern) return
    setExporting(true); setError('')
    try {
      if (kind === 'png') await exportPng(pattern, showSymbols)
      if (kind === 'svg') exportSvg(pattern, showSymbols)
      if (kind === 'csv') exportCsv(pattern, spare)
      if (kind === 'pdf') await exportPdf(pattern, spare)
    } catch (e) { setError(e instanceof Error ? e.message : '导出失败') }
    finally { setExporting(false) }
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><i/><i/><i/><i/></span><div><strong>小豆图纸</strong><small>把喜欢的画面，拼成真的</small></div></div>
      <div className="topbar-right"><span className="privacy"><LockKeyhole size={15}/> 图片仅在本机处理</span><a href="#how" className="top-link">使用说明 <ChevronDown size={14}/></a></div>
    </header>
    <main>
      <section className="hero"><div><div className="eyebrow"><Sparkles size={15}/> 好看，也好拼</div><h1>把照片变成<br/><em>真正能拼的图纸</em></h1><p>选好尺寸和颜色，三种效果一键比较。逐格修好细节，下载带色号的完整图纸。</p></div><div className="hero-art" aria-hidden="true"><span className="bead b1"/><span className="bead b2"/><span className="bead b3"/><span className="bead b4"/><span className="bead b5"/><span className="bead b6"/><span className="bead b7"/><span className="bead b8"/><span className="bead b9"/></div></section>
      <div className="workspace">
        <aside className="settings panel">
          <div className="panel-heading"><span className="step">01</span><div><h2>准备图片</h2><p>上传后拖动照片调整构图</p></div></div>
          <input ref={sourceInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={e => { uploadImage(e.target.files?.[0]); e.target.value = '' }}/>
          {!image ? <button className="upload-zone" onClick={() => sourceInput.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); uploadImage(e.dataTransfer.files[0]) }}><span className="upload-icon"><ImagePlus size={29}/></span><strong>点击上传图片</strong><small>或将 JPG / PNG / WebP 拖到这里</small><span className="upload-tag">照片 · 插画 · 像素画</span></button> : <div className="crop-wrap"><canvas ref={cropCanvas} className="crop-canvas" onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => { if (!drag.current) return; const rect = e.currentTarget.getBoundingClientRect(); const dx = (e.clientX - drag.current.x) / rect.width, dy = (e.clientY - drag.current.y) / rect.height; setPan(v => ({ x: v.x + dx, y: v.y + dy })); drag.current = { x: e.clientX, y: e.clientY } }} onPointerUp={() => drag.current = null}/><div className="crop-actions"><button onClick={() => sourceInput.current?.click()}><ImagePlus size={15}/> 换图</button><button onClick={() => setRotation(v => (v + 90) % 360)}><RotateCw size={15}/> 旋转</button></div><label className="zoom-row">缩放 <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))}/><span>{Math.round(zoom * 100)}%</span></label></div>}
          <div className="divider"/>
          <div className="panel-heading"><span className="step">02</span><div><h2>图纸设置</h2><p>格数就是需要拼的豆子数</p></div></div>
          <div className="field-title">图纸尺寸 <span>单位：格</span></div>
          <div className="dimension-row"><label>宽<input type="number" min="12" max="200" value={width || ''} onChange={e => { const v = Number(e.target.value); setWidth(v); if (linked) setHeight(v) }} onBlur={() => { const v = clamp(width || 12, 12, 200); setWidth(v); if (linked) setHeight(v) }}/></label><button className={`link-btn ${linked ? 'active' : ''}`} title="锁定宽高相同" onClick={() => { setLinked(v => !v); if (!linked) setHeight(width) }}>{linked ? '1:1' : '自由'}</button><label>高<input type="number" min="12" max="200" value={height || ''} onChange={e => { const v = Number(e.target.value); setHeight(v); if (linked) setWidth(v) }} onBlur={() => { const v = clamp(height || 12, 12, 200); setHeight(v); if (linked) setWidth(v) }}/></label></div>
          <div className="chips presets">{[29, 50, 58, 87, 100].map(n => <button key={n} className={width === n && height === n ? 'selected' : ''} onClick={() => { setWidth(n); setHeight(n) }}>{n} × {n}</button>)}</div>
          <div className="estimate">预计约 {((width * (palette.pitchMm || 5)) / 10).toFixed(0)} × {((height * (palette.pitchMm || 5)) / 10).toFixed(0)} cm · {width * height} 格</div>
          <div className="field-title">最多使用 <strong>{maxColors} 色</strong></div>
          <input className="full-range" type="range" min="2" max={Math.max(2, Math.min(64, allowed.length))} value={Math.min(maxColors, Math.max(2, allowed.length))} onChange={e => setMaxColors(Number(e.target.value))}/>
          <div className="range-ends"><span>简单易拼</span><span>细节丰富</span></div>
          <div className="field-title">色卡与色号范围</div>
          <select className="select" value={paletteId} onChange={e => changePalette(e.target.value)}>{allPalettes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <small className="hint" style={{ marginTop: 6 }}>社区色卡有真实系列色号，屏幕 RGB 并非品牌官方实测。特殊材质默认不选。</small>
          <button className="text-action" onClick={() => setShowPalette(v => !v)}><span>{enabled.length} / {palette.colors.length} 色可用 · 管理色号</span><ChevronDown size={16} className={showPalette ? 'flipped' : ''}/></button>
          {showPalette && <div className="palette-manager"><div className="palette-note">{palette.source}（{palette.version}）</div><div className="palette-top"><label><Search size={14}/><input placeholder="搜索色号或名称" value={search} onChange={e => setSearch(e.target.value)}/></label><button onClick={() => setEnabled(palette.colors.map(c => c.code))}>全选</button></div><div className="color-grid">{palette.colors.filter(c => `${c.code} ${c.name}`.toLowerCase().includes(search.toLowerCase())).map(c => <button key={c.code} className={enabled.includes(c.code) ? 'active' : ''} title={`${c.code} ${c.name}${c.finish && c.finish !== 'solid' ? ' · 特殊材质' : ''}`} onClick={() => setEnabled(v => v.includes(c.code) ? v.filter(x => x !== c.code) : [...v, c.code])}><span style={{ background: c.hex }}/><small>{c.code}</small>{enabled.includes(c.code) && <Check size={12}/>}</button>)}</div><input ref={paletteInput} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={e => { importPalette(e.target.files?.[0]); e.target.value = '' }}/><button className="import-btn" onClick={() => paletteInput.current?.click()}>导入自己的色卡 CSV / JSON</button><small className="hint">CSV 表头：code,name,hex；JSON：colors 数组。品牌色卡为社区 RGB 参考，正式拼制建议校对。</small></div>}
          <div className="field-title">透明区域</div><div className="segmented"><button className={background === 'white' ? 'active' : ''} onClick={() => setBackground('white')}>铺白色背景</button><button className={background === 'transparent' ? 'active' : ''} onClick={() => setBackground('transparent')}>留空</button></div><small className="hint">“留空”仅保留 PNG 等图片原有透明区域，不会自动抠图。白豆需在编辑器中明确填色。</small>
          <button className="primary generate-btn" onClick={generatePattern} disabled={busy}>{busy ? '正在精心配色…' : <><Sparkles size={18}/> 生成三种图纸</>}</button>
          {dirty && pattern && <small className="dirty">参数有变化，请重新生成以应用</small>}
        </aside>
        <section className="result panel" id="result"><div className="result-head"><div><span className="section-kicker">YOUR PATTERN</span><h2>图纸预览 <span className="result-dot"/></h2></div>{pattern && <span className="pattern-meta">{pattern.width} × {pattern.height} · {used} 色 · {total} 颗</span>}</div>
          {error && <div className="message error" role="alert">{error}<button onClick={() => setError('')}><X size={16}/></button></div>}
          {notice && <div className="message success">{notice}<button onClick={() => setNotice('')}><X size={16}/></button></div>}
          {!pattern ? <div className="empty-result"><div className="empty-mosaic" aria-hidden="true">{Array.from({ length: 49 }, (_, i) => <span key={i} style={{ background: ['#f7d694', '#f3a995', '#a9cbb4', '#9bbfce', '#e9c7a8', '#e9dfce'][(i * 7 + Math.floor(i / 7) * 3) % 6], opacity: [0.35, .65, 1][(i * 5 + Math.floor(i / 7)) % 3] }}/>)}</div><h3>你的作品，从这里开始</h3><p>上传图片、设置尺寸和颜色，<br/>即可得到三种可比较的拼豆方案。</p><button onClick={() => sourceInput.current?.click()}><ImagePlus size={17}/> 选择图片</button></div> : <><div className="variant-row">{modes.map(m => <button key={m.id} className={`variant ${activeMode === m.id ? 'active' : ''}`} onClick={() => selectMode(m.id)}><span className="variant-icon">{m.id === 'clear' ? '✦' : m.id === 'balanced' ? '◈' : '▦'}</span><strong>{m.name}</strong><small>{m.detail}</small></button>)}</div><div className="canvas-tools"><div><button className={showGrid ? 'active' : ''} onClick={() => setShowGrid(v => !v)} title="显示网格"><Grid2X2 size={16}/> 网格</button><button className={showSymbols ? 'active' : ''} onClick={() => setShowSymbols(v => !v)} title="显示符号"><Eye size={16}/> 符号</button></div><div className="zoom-tools"><button onClick={() => setPreviewScale(v => Math.max(1, v - 1))} disabled={previewScale === 1} title="缩小图纸"><ZoomOut size={15}/></button><span>{previewScale}×</span><button onClick={() => setPreviewScale(v => Math.min(4, v + 1))} disabled={previewScale === 4} title="放大图纸"><ZoomIn size={15}/></button></div></div><div className="pattern-scroll"><canvas ref={patternCanvas} className="pattern-canvas" style={{ width: `${previewScale * 100}%` }} onPointerDown={e => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); editCell(canvasCell(e)) }} onPointerMove={e => { if (drawing.current && (tool === 'paint' || tool === 'erase')) editCell(canvasCell(e)) }} onPointerUp={() => drawing.current = false}/></div><div className="edit-tools"><div className="edit-heading"><strong>逐格修一修</strong><span>修改会自动保存</span></div><div className="tool-row">{toolLabels.map(t => <button key={t.id} className={tool === t.id ? 'active' : ''} onClick={() => setTool(t.id)} title={t.name}><t.Icon size={17}/><span>{t.name}</span></button>)}<span className="tool-separator"/><button onClick={() => history('undo')} disabled={!undo.length} title="撤销"><Undo2 size={17}/></button><button onClick={() => history('redo')} disabled={!redo.length} title="重做"><Redo2 size={17}/></button></div><div className="edit-colors">{pattern.palette.colors.map((c, i) => <button key={i} className={paintCode === c.code ? 'active' : ''} title={`${c.code} ${c.name}`} onClick={() => { setPaintCode(c.code); setTool('paint') }}><span style={{ background: c.hex }}/><small>{c.code}</small></button>)}</div></div></>}
        </section>
        <aside className="summary panel"><div className="panel-heading"><span className="step">03</span><div><h2>材料与下载</h2><p>每一颗豆，都算得清楚</p></div></div>{!pattern ? <div className="summary-empty"><FileText size={34}/><p>生成后，这里会显示色号用量与下载选项。</p></div> : <><div className="stat-grid"><div><strong>{total}</strong><span>需要豆子</span></div><div><strong>{used}</strong><span>使用颜色</span></div><div><strong>{Math.ceil(pattern.width / 29) * Math.ceil(pattern.height / 29)}</strong><span>29 格分板</span></div></div><div className="material-head"><h3>色号清单</h3><button onClick={() => setFocusColor(null)}>{focusColor == null ? '全部显示' : '清除高亮'}</button></div><div className="material-list">{pattern.palette.colors.map((c, i) => ({ c, i, n: counts[i] })).filter(item => item.n).sort((a, b) => b.n - a.n).map(({ c, i, n }) => <button key={i} className={focusColor === i ? 'focused' : ''} onClick={() => setFocusColor(focusColor === i ? null : i)} title="仅高亮此色"><span className="material-swatch" style={{ background: c.hex }}/><span className="material-name"><strong>{c.code} <small>{labels[i]}</small></strong><em>{c.name}</em></span><span className="material-count">{n}<small>颗</small></span></button>)}</div><div className="spare-row">备品量 <div className="chips">{[0, 5, 10].map(n => <button key={n} className={spare === n ? 'selected' : ''} onClick={() => setSpare(n)}>{n}%</button>)}</div></div><small className="hint">点击色号可在图纸中高亮。色卡显示值与实体豆颜色可能有差异。</small><div className="download-area"><h3>下载图纸</h3><button className="primary" onClick={() => doExport('pdf')} disabled={exporting}><Download size={17}/> {exporting ? '正在整理文件…' : '下载可打印 PDF'}</button><div className="export-grid"><button onClick={() => doExport('png')} disabled={exporting}><FileImage size={18}/> PNG 图片</button><button onClick={() => doExport('svg')} disabled={exporting}><Grid2X2 size={18}/> SVG 矢量</button><button onClick={() => doExport('csv')} disabled={exporting}><FileSpreadsheet size={18}/> CSV 清单</button></div></div></>}</aside>
      </div>
      <section className="how" id="how"><div><span className="section-kicker">HOW IT WORKS</span><h2>从照片到拼豆，只需三步</h2></div><div className="how-grid"><article><span>01</span><h3>挑一张喜欢的图</h3><p>照片在你的设备上处理。拖动、缩放、旋转，先把主角放到画面中。</p></article><article><span>02</span><h3>选尺寸与颜色</h3><p>限定格数、颜色数量与可用色号，比较清晰、均衡、照片三种效果。</p></article><article><span>03</span><h3>修细节，下载开拼</h3><p>逐格改色或擦除，查看用量，再下载 PDF、PNG、SVG 或 CSV。</p></article></div></section>
    </main><footer><div><strong>小豆图纸</strong><span>用一点耐心，把画面拼成礼物。</span></div><span>本地处理 · 无需登录 · 可离线使用</span></footer>
  </div>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}))
}
