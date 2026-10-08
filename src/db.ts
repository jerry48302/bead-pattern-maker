import type { Pattern } from './types'

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('xiaodou-patterns', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('projects')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

export async function saveRecent(pattern: Pattern) {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite')
    tx.objectStore('projects').put(pattern, 'recent')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadRecent(): Promise<Pattern | null> {
  const db = await open()
  const result = await new Promise<Pattern | null>((resolve, reject) => {
    const request = db.transaction('projects').objectStore('projects').get('recent')
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return result
}
