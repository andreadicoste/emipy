import path from 'node:path'
import { pathToFileURL } from 'node:url'

const host = process.env.HOST ?? '0.0.0.0'
const port = Number(process.env.PORT ?? 3000)
const clientDirectory = path.resolve('dist/client')
const serverEntryPoint = path.resolve('dist/server/server.js')

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const

type StartHandler = {
  fetch(request: Request): Response | Promise<Response>
}

async function loadStartHandler(): Promise<StartHandler> {
  const module = await import(pathToFileURL(serverEntryPoint).href) as { default?: StartHandler }
  if (!module.default?.fetch) throw new Error(`TanStack Start handler non trovato in ${serverEntryPoint}`)
  return module.default
}

async function indexStaticFiles() {
  const files = new Map<string, string>()
  const glob = new Bun.Glob('**/*')

  for await (const relativePath of glob.scan({ cwd: clientDirectory })) {
    const absolutePath = path.join(clientDirectory, relativePath)
    const file = Bun.file(absolutePath)
    if (!(await file.exists()) || file.size === 0) continue
    const route = `/${relativePath.split(path.sep).join(path.posix.sep)}`
    files.set(route, absolutePath)
  }

  return files
}

function staticHeaders(file: Bun.BunFile, pathname: string) {
  return {
    ...isolationHeaders,
    'Content-Type': file.type || 'application/octet-stream',
    'Cache-Control': /^\/c-runtime\/[a-f0-9]{40}\//.test(pathname) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  }
}

const handler = await loadStartHandler()
const staticFiles = await indexStaticFiles()

const server = Bun.serve({
  hostname: host,
  port,
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'GET' || request.method === 'HEAD') {
      let pathname = url.pathname
      try { pathname = decodeURIComponent(pathname) } catch { /* use encoded path */ }
      const filePath = staticFiles.get(pathname)

      if (filePath) {
        const file = Bun.file(filePath)
        const headers = staticHeaders(file, pathname)
        if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
        return new Response(file, { status: 200, headers })
      }
    }

    try {
      return await handler.fetch(request)
    } catch (error) {
      console.error('[server] request failed', error)
      return new Response('Internal Server Error', {
        status: 500,
        headers: { ...isolationHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  },
  error(error) {
    console.error('[server] uncaught error', error)
    return new Response('Internal Server Error', {
      status: 500,
      headers: { ...isolationHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  },
})

console.log(`Emipy listening on http://${server.hostname}:${server.port}`)
