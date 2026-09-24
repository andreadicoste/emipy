import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'
import { prisma } from './prisma'
import { findExerciseContext, loadRegistry, studentExercise } from './curriculum.server'
import { beginGradingSchema, finishGradingSchema, programSnapshotSchema } from './agent-contract'
import { judgeGraderResult, planGraderRun } from './agents.server'
import { courseIdSchema, lessonIdSchema, startExerciseSchema, workspaceSchema } from './validation'

async function ownerId() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new Error('Accesso richiesto')
  return session.user.id
}

async function publishedRegistry() {
  const registry = await loadRegistry()
  return {
    courses: registry.courses.filter((item) => item.status === 'published').sort((a, b) => a.order - b.order),
    lessons: registry.lessons.filter((item) => item.status === 'published').sort((a, b) => a.order - b.order),
    exercises: registry.exercises.filter((item) => item.status === 'published'),
  }
}

export const listCourses = createServerFn({ method: 'GET' }).handler(async () => {
  const owner = await ownerId()
  const [registry, progress] = await Promise.all([
    publishedRegistry(),
    prisma.lessonProgress.findMany({ where: { userId: owner }, select: { lessonId: true } }),
  ])
  const visited = new Set(progress.map((item) => item.lessonId))
  return registry.courses.map((course) => {
    const lessons = registry.lessons.filter((lesson) => lesson.courseId === course.externalId)
    return { ...course, lessonCount: lessons.length, visitedCount: lessons.filter((lesson) => visited.has(lesson.externalId)).length }
  })
})

export const getCourseDestination = createServerFn({ method: 'GET' }).validator(courseIdSchema).handler(async ({ data }) => {
  const owner = await ownerId()
  const registry = await publishedRegistry()
  const course = registry.courses.find((item) => item.externalId === data.courseId)
  if (!course) throw new Error('Corso non trovato')
  const lessons = registry.lessons.filter((item) => item.courseId === course.externalId)
  if (!lessons[0]) throw new Error('Corso senza lezioni')
  const ids = lessons.map((item) => item.externalId)
  const latest = await prisma.lessonProgress.findFirst({ where: { userId: owner, lessonId: { in: ids } }, orderBy: { lastOpenedAt: 'desc' } })
  return { lessonId: latest?.lessonId ?? lessons[0].externalId }
})

async function lessonView(owner: string, courseId: string, lessonId: string, touch: boolean) {
  const registry = await publishedRegistry()
  const course = registry.courses.find((item) => item.externalId === courseId)
  const lesson = registry.lessons.find((item) => item.externalId === lessonId && item.courseId === courseId)
  if (!course || !lesson) throw new Error('Lezione non trovata')
  if (touch) await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: owner, lessonId } },
    update: { lastOpenedAt: new Date() }, create: { userId: owner, lessonId },
  })
  const lessons = registry.lessons.filter((item) => item.courseId === courseId)
  const allExerciseIds = lessons.flatMap((item) => item.exerciseIds)
  const [lessonProgress, exerciseProgress, submissions] = await Promise.all([
    prisma.lessonProgress.findMany({ where: { userId: owner, lessonId: { in: lessons.map((item) => item.externalId) } }, select: { lessonId: true } }),
    prisma.exerciseProgress.findMany({ where: { userId: owner, exerciseId: { in: allExerciseIds } } }),
    prisma.exerciseSubmission.findMany({ where: { userId: owner, exerciseId: { in: lesson.exerciseIds } }, orderBy: { createdAt: 'desc' }, select: { exerciseId: true, status: true } }),
  ])
  const visited = new Set(lessonProgress.map((item) => item.lessonId))
  const progressByExercise = new Map(exerciseProgress.map((item) => [item.exerciseId, item]))
  const latestStatus = new Map<string, string>()
  for (const submission of submissions) if (!latestStatus.has(submission.exerciseId)) latestStatus.set(submission.exerciseId, submission.status)
  const exercises = lesson.exerciseIds.map((id) => registry.exercises.find((item) => item.externalId === id)).filter((item) => item !== undefined).map((exercise) => {
    const progress = progressByExercise.get(exercise.externalId)
    return { ...studentExercise(exercise), progress: progress ? { attempts: progress.attempts, completed: !!progress.completedAt, feedback: progress.lastFeedback, submissionStatus: latestStatus.get(exercise.externalId) ?? null } : null }
  })
  const lessonCompleted = (item: { externalId: string; exerciseIds: string[] }) => {
    if (!item.exerciseIds.length) return visited.has(item.externalId)
    return item.exerciseIds.every((id) => !!progressByExercise.get(id)?.completedAt)
  }
  return {
    course,
    lesson: { ...lesson, exercises },
    lessons: lessons.map(({ externalId, title, order, exerciseIds }) => ({ externalId, title, order, visited: visited.has(externalId), completed: lessonCompleted({ externalId, exerciseIds }) })),
  }
}

export const getLessonView = createServerFn({ method: 'GET' }).validator(lessonIdSchema).handler(async ({ data }) => {
  const owner = await ownerId()
  return lessonView(owner, data.courseId, data.lessonId, true)
})

export const startExercise = createServerFn({ method: 'POST' }).validator(startExerciseSchema).handler(async ({ data }) => {
  const owner = await ownerId()
  const registry = await publishedRegistry()
  const lesson = registry.lessons.find((item) => item.externalId === data.lessonId && item.courseId === data.courseId && item.exerciseIds.includes(data.exerciseId))
  const exercise = registry.exercises.find((item) => item.externalId === data.exerciseId)
  if (!lesson || !exercise) throw new Error('Esercizio non disponibile')
  return prisma.$transaction(async (tx) => {
    const program = await tx.program.upsert({
      where: { userId_exerciseId: { userId: owner, exerciseId: exercise.externalId } },
      update: {},
      create: {
        userId: owner, name: exercise.title, code: exercise.starterCode, exerciseId: exercise.externalId,
        files: { create: exercise.starterFiles },
      },
    })
    await tx.exerciseProgress.upsert({ where: { userId_exerciseId: { userId: owner, exerciseId: exercise.externalId } }, update: {}, create: { userId: owner, exerciseId: exercise.externalId } })
    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId: owner, lessonId: lesson.externalId } },
      update: { currentExerciseId: exercise.externalId, lastOpenedAt: new Date() },
      create: { userId: owner, lessonId: lesson.externalId, currentExerciseId: exercise.externalId },
    })
    return { programId: program.id }
  })
})

export const getExerciseWorkspace = createServerFn({ method: 'GET' }).validator(workspaceSchema).handler(async ({ data }) => {
  const owner = await ownerId()
  const [view, program] = await Promise.all([
    lessonView(owner, data.courseId, data.lessonId, true),
    prisma.program.findFirst({ where: { id: data.programId, userId: owner }, include: { files: { orderBy: { createdAt: 'asc' } } } }),
  ])
  if (!program?.exerciseId || !view.lesson.exerciseIds.includes(program.exerciseId)) throw new Error('Workspace non trovato')
  const exercise = view.lesson.exercises.find((item) => item.externalId === program.exerciseId)
  if (!exercise) throw new Error('Esercizio non trovato')
  return { ...view, program, exercise }
})

export const beginExerciseGrading = createServerFn({ method: 'POST' }).validator(beginGradingSchema).handler(async ({ data }) => {
  const owner = await ownerId()
  const registry = await publishedRegistry()
  const program = await prisma.program.findFirst({ where: { id: data.programId, userId: owner }, select: { id: true, exerciseId: true } })
  if (!program?.exerciseId) throw new Error('Questo programma non è un esercizio')
  const exercise = registry.exercises.find((item) => item.externalId === program.exerciseId)
  if (!exercise || !findExerciseContext(registry, exercise.externalId)) throw new Error('Esercizio non disponibile')
  const snapshot = programSnapshotSchema.parse(data.snapshot)
  const submission = await prisma.$transaction(async (tx) => {
    const existing = await tx.exerciseSubmission.findUnique({ where: { userId_idempotencyKey: { userId: owner, idempotencyKey: data.idempotencyKey } } })
    if (existing) return existing
    const created = await tx.exerciseSubmission.create({ data: {
      userId: owner, programId: program.id, exerciseId: exercise.externalId, idempotencyKey: data.idempotencyKey,
      code: snapshot.mainCode, filesJson: JSON.stringify(snapshot.files),
    } })
    await tx.exerciseProgress.upsert({
      where: { userId_exerciseId: { userId: owner, exerciseId: exercise.externalId } },
      update: { attempts: { increment: 1 } },
      create: { userId: owner, exerciseId: exercise.externalId, attempts: 1 },
    })
    return created
  })
  if (submission.status !== 'PENDING') throw new Error('Consegna già elaborata')
  try {
    const plan = await planGraderRun({ exercise, snapshot: { mainCode: submission.code, files: JSON.parse(submission.filesJson) }, userId: owner })
    return { submissionId: submission.id, stdin: plan.runs.map((run) => run.stdin ?? []) }
  } catch (error) {
    await prisma.exerciseSubmission.updateMany({ where: { id: submission.id, userId: owner, status: 'PENDING' }, data: { status: 'ERROR', feedback: 'Grader temporaneamente non disponibile.' } })
    throw error
  }
})

export const finishExerciseGrading = createServerFn({ method: 'POST' }).validator(finishGradingSchema).handler(async ({ data }) => {
  const owner = await ownerId()
  const submission = await prisma.exerciseSubmission.findFirst({ where: { id: data.submissionId, userId: owner } })
  if (!submission) throw new Error('Consegna non trovata')
  if (submission.status !== 'PENDING') return { completed: submission.status === 'COMPLETED', feedback: submission.feedback ?? '', status: submission.status }
  const exercise = (await publishedRegistry()).exercises.find((item) => item.externalId === submission.exerciseId)
  if (!exercise) throw new Error('Esercizio non disponibile')
  const snapshot = programSnapshotSchema.parse({ mainCode: submission.code, files: JSON.parse(submission.filesJson) })
  try {
    const result = await judgeGraderResult({ exercise, snapshot, evaluation: data.evaluation, userId: owner })
    const status = result.completed ? 'COMPLETED' : 'NEEDS_WORK'
    await prisma.$transaction(async (tx) => {
      const updated = await tx.exerciseSubmission.updateMany({ where: { id: submission.id, userId: owner, status: 'PENDING' }, data: { status, feedback: result.feedback, gradedAt: new Date() } })
      if (!updated.count) return
      await tx.exerciseProgress.update({
        where: { userId_exerciseId: { userId: owner, exerciseId: submission.exerciseId } },
        data: { lastFeedback: result.feedback, ...(result.completed ? { completedAt: new Date() } : {}) },
      })
    })
    return { ...result, status }
  } catch (error) {
    await prisma.exerciseSubmission.updateMany({ where: { id: submission.id, userId: owner, status: 'PENDING' }, data: { status: 'ERROR', feedback: 'Valutazione non riuscita.' } })
    throw error
  }
})

export const listLibrary = createServerFn({ method: 'GET' }).handler(async () => {
  const owner = await ownerId()
  const [registry, programs] = await Promise.all([
    publishedRegistry(),
    prisma.program.findMany({ where: { userId: owner }, select: { id: true, name: true, exerciseId: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
  ])
  return programs.map((program) => {
    const context = program.exerciseId ? findExerciseContext(registry, program.exerciseId) : null
    return { ...program, courseId: context?.course.externalId ?? null, courseTitle: context?.course.title ?? null, lessonId: context?.lesson.externalId ?? null, lessonTitle: context?.lesson.title ?? null }
  })
})

export const getProgramLocation = createServerFn({ method: 'GET' }).validator(workspaceSchema.pick({ programId: true })).handler(async ({ data }) => {
  const owner = await ownerId()
  const program = await prisma.program.findFirst({ where: { id: data.programId, userId: owner }, select: { id: true, exerciseId: true } })
  if (!program) throw new Error('Programma non trovato')
  if (!program.exerciseId) return { kind: 'playground' as const, programId: program.id }
  const context = findExerciseContext(await publishedRegistry(), program.exerciseId)
  if (!context) throw new Error('Contesto esercizio non trovato')
  return { kind: 'exercise' as const, programId: program.id, courseId: context.course.externalId, lessonId: context.lesson.externalId }
})
