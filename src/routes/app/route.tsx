import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '@/lib/session.functions'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
    return { user: session.user }
  },
  component: Outlet,
})
