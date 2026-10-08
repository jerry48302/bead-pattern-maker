export type RGB = [number, number, number]
export type Lab = [number, number, number]
export type Mode = 'clear' | 'balanced' | 'photo'
export type Tool = 'paint' | 'erase' | 'pick' | 'fill' | 'replace'

export interface BeadColor {
  code: string
  name: string
  hex: string
  finish?: 'solid' | 'transparent' | 'glitter' | 'glow' | 'other'
}

export interface Palette {
  id: string
  name: string
  version: string
  sourceDate: string
  source: string
  confidence: 'verified' | 'reference' | 'custom'
  pitchMm?: number
  colors: BeadColor[]
}

export interface Pattern {
  schema: 1
  width: number
  height: number
  cells: number[]
  palette: Palette
  title: string
  mode: Mode
  createdAt: string
  maxColors?: number
}

export interface GenerationRequest {
  width: number
  height: number
  rgba: Uint8ClampedArray
  palette: Palette
  maxColors: number
  transparent: boolean
}

export interface GenerationResult {
  variants: Record<Mode, number[]>
  colors: BeadColor[]
}
