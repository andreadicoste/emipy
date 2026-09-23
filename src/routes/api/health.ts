import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/lib/prisma'

export const Route = createFileRoute('/api/health')({
  server: { handlers: {
    GET: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`
        return Response.json({ ok: true })
      } catch {
        return Response.json({ ok: false }, { status: 503 })
      }
    },
  } },
})
