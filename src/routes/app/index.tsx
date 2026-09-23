import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({
  loader: async () => {
    throw redirect({ to: '/app/courses' })
  },
})
