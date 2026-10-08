import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('dist')
async function files(dir = root) {
  const entries = await readdir(dir, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) result.push(...await files(absolute))
    else if (entry.name !== 'sw.js') result.push(path.relative(root, absolute).replaceAll('\\', '/'))
  }
  return result
}
const assets = await files()
const cacheId = `xiaodou-${Date.now()}`
const script = `const CACHE=${JSON.stringify(cacheId)};const ASSETS=${JSON.stringify(assets)};self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(file=>new URL(file,self.registration.scope).href))).then(()=>self.skipWaiting()))});self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})))})`
await writeFile(path.join(root, 'sw.js'), script)
