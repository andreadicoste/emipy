import { createFileRoute } from '@tanstack/react-router'
import { Ide } from '@/components/ide'
import { getExerciseWorkspace, listLibrary } from '@/lib/curriculum.functions'

export const Route = createFileRoute('/app/courses/$courseId/$lessonId/$programId')({
  loader: async ({ params }) => {
    const [workspace, programs] = await Promise.all([getExerciseWorkspace({ data: params }), listLibrary()])
    return { workspace, programs }
  }, component: ExerciseWorkspace,
})

function ExerciseWorkspace() {
  const { workspace, programs } = Route.useLoaderData()
  return <Ide key={workspace.program.id} program={workspace.program} programs={programs} learning={{ course: workspace.course, lesson: workspace.lesson, lessons: workspace.lessons, exercise: workspace.exercise }} />
}
