import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { File01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { LearningShell } from '@/components/learning-shell'
import { LessonDocument } from '@/components/lesson-document'
import { getLessonView, startExercise } from '@/lib/curriculum.functions'

export const Route = createFileRoute('/app/courses/$courseId/$lessonId/')({
  loader: ({ params }) => getLessonView({ data: params }), component: Lesson,
})

function Lesson() {
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  async function start(exerciseId: string) {
    setBusy(exerciseId)
    try {
      const result = await startExercise({ data: { courseId: data.course.externalId, lessonId: data.lesson.externalId, exerciseId } })
      await navigate({ to: '/app/courses/$courseId/$lessonId/$programId', params: { courseId: data.course.externalId, lessonId: data.lesson.externalId, programId: result.programId } })
    } catch { toast.error('Impossibile aprire esercizio.') }
    finally { setBusy(null) }
  }
  return <LearningShell active="courses" course={data.course} lessons={data.lessons} currentLessonId={data.lesson.externalId} showTutor tutorContext={{ programId: null, courseId: data.course.externalId, lessonId: data.lesson.externalId, snapshot: null, lastExecution: '' }}>
    <div className="flex h-full flex-col"><header className="ide-toolbar flex h-12 shrink-0 items-center border-b px-3"><div className="ide-file-tab ide-file-tab-active flex h-8 items-center gap-2 rounded px-3 text-xs"><HugeiconsIcon icon={File01Icon} className="size-3.5" /> lezione.md</div></header><div className="min-h-0 flex-1 overflow-y-auto"><LessonDocument lesson={data.lesson} onStart={(id) => void start(id)} busyExercise={busy} /></div></div>
  </LearningShell>
}
