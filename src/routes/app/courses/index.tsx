import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/courses/')({
  loader: () => { throw redirect({ to: '/app/languages' }) },
})
