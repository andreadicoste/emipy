import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '@/lib/session.functions'
import { getLayoutPreferences } from '@/lib/layout-preferences.functions'
import { LayoutPreferencesProvider } from '@/lib/layout-preferences'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const [session, layouts] = await Promise.all([getSession(), getLayoutPreferences()])
    if (!session) throw redirect({ to: '/login' })
    return { user: session.user, layouts }
  },
  component: AppLayout,
})

function AppLayout() {
  const { layouts } = Route.useRouteContext()
  return <LayoutPreferencesProvider initial={layouts}><Outlet /></LayoutPreferencesProvider>
}
