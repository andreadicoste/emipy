import { createFileRoute, redirect } from '@tanstack/react-router'
import { getProgramLocation } from '@/lib/curriculum.functions'

export const Route = createFileRoute('/app/$programId')({
  loader: async ({ params }) => {
    const location = await getProgramLocation({ data: { programId: params.programId } })
    if (location.kind === 'playground') throw redirect({ to: '/app/playground/$programId', params: { programId: location.programId } })
    throw redirect({ to: '/app/courses/$courseId/$lessonId/$programId', params: location })
  },
})
