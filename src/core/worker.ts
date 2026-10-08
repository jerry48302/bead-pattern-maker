import { generate } from './generate'
import type { GenerationRequest } from '../types'

self.onmessage = (event: MessageEvent<{ id: number; request: GenerationRequest }>) => {
  try {
    const result = generate(event.data.request)
    self.postMessage({ id: event.data.id, result })
  } catch (error) {
    self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : String(error) })
  }
}
