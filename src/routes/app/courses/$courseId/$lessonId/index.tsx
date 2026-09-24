import { createFileRoute } from '@tanstack/react-router'
import { Ide } from '@/components/ide'
import { getLessonView } from '@/lib/curriculum.functions'

export const Route = createFileRoute('/app/courses/$courseId/$lessonId/')({
  loader: ({ params }) => getLessonView({ data: params }), component: Lesson,
})

function Lesson() {
  const data = Route.useLoaderData()
  return <Ide key={data.lesson.externalId} program={null} programs={[]} learning={{ course: data.course, lesson: data.lesson, lessons: data.lessons }} />
}
