import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCourseDestination } from '@/lib/curriculum.functions'

export const Route = createFileRoute('/app/courses/$courseId/')({
  loader: async ({ params }) => {
    const destination = await getCourseDestination({ data: { courseId: params.courseId } })
    throw redirect({ to: '/app/courses/$courseId/$lessonId', params: { courseId: params.courseId, lessonId: destination.lessonId } })
  },
})
