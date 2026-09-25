import { createFileRoute } from '@tanstack/react-router'
import { createAgentUIStreamResponse } from 'ai'
import { auth } from '@/lib/auth'
import { createTutorAgent } from '@/lib/agents.server'
import { tutorRequestSchema } from '@/lib/agent-contract'
import { prisma } from '@/lib/prisma'
import { buildLearningState, findExerciseContext, loadRegistry, studentExercise } from '@/lib/curriculum.server'

export const Route = createFileRoute('/api/tutor')({
  server: { handlers: {
    POST: async ({ request }) => {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return Response.json({ error: 'Accesso richiesto' }, { status: 401 })
      const parsed = tutorRequestSchema.safeParse(await request.json())
      if (!parsed.success) return Response.json({ error: 'Richiesta non valida' }, { status: 400 })
      const { context, messages } = parsed.data
      const registry = await loadRegistry()
      const courses = registry.courses.filter((item) => item.status === 'published')
      const lessons = registry.lessons.filter((item) => item.status === 'published')
      const exercises = registry.exercises.filter((item) => item.status === 'published')
      let courseId = context.courseId, lessonId = context.lessonId, exerciseId: string | null = null
      if (context.programId) {
        const program = await prisma.program.findFirst({ where: { id: context.programId, userId: session.user.id }, select: { exerciseId: true } })
        if (!program?.exerciseId) return Response.json({ error: 'Workspace non trovato' }, { status: 404 })
        const found = findExerciseContext({ courses, lessons, exercises }, program.exerciseId)
        if (!found) return Response.json({ error: 'Contesto non trovato' }, { status: 404 })
        courseId = found.course.externalId; lessonId = found.lesson.externalId; exerciseId = program.exerciseId
      }
      const course = courses.find((item) => item.externalId === courseId)
      const lesson = lessons.find((item) => item.externalId === lessonId && item.courseId === courseId)
      if (!course || !lesson) return Response.json({ error: 'Lezione non trovata' }, { status: 404 })
      const [lessonProgress, exerciseProgress] = await Promise.all([
        prisma.lessonProgress.findMany({ where: { userId: session.user.id }, select: { lessonId: true } }),
        prisma.exerciseProgress.findMany({ where: { userId: session.user.id }, select: { exerciseId: true, completedAt: true } }),
      ])
      const state = buildLearningState({ courses, lessons, exercises }, new Set(lessonProgress.map((item) => item.lessonId)), new Set(exerciseProgress.map((item) => item.exerciseId)), new Set(exerciseProgress.filter((item) => item.completedAt).map((item) => item.exerciseId)))
      if (!state.lessons.get(lessonId)?.unlocked || (exerciseId && !state.exercises.get(exerciseId)?.unlocked)) return Response.json({ error: 'Completa prima il contenuto precedente.' }, { status: 403 })
      const lessonExercises = lesson.exerciseIds.map((id) => exercises.find((item) => item.externalId === id)).filter((item) => item !== undefined)
      const lessonDto = { ...lesson, exercises: lessonExercises.map((item) => ({ ...studentExercise(item), progress: null, ...state.exercises.get(item.externalId)! })) }
      const exercise = exerciseId ? lessonExercises.find((item) => item.externalId === exerciseId) ?? null : null
      const agent = createTutorAgent({ lesson: lessonDto, exercise: exercise ? studentExercise(exercise) : null, snapshot: context.snapshot, lastExecution: context.lastExecution, userId: session.user.id })
      return createAgentUIStreamResponse({ agent, uiMessages: messages, abortSignal: request.signal, timeout: 45_000 })
    },
  } },
})
