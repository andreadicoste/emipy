import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'

const security = createMiddleware().server(async ({ next }) => {
  setResponseHeader('Cross-Origin-Opener-Policy', 'same-origin')
  setResponseHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  setResponseHeader('Cross-Origin-Resource-Policy', 'same-origin')
  setResponseHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader('X-Content-Type-Options', 'nosniff')
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [security, createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })],
}))
