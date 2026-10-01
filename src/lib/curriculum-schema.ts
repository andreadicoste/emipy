import { z } from 'zod'
import { languageSchema, projectFileNameSchema, validFileName } from './languages'

export const externalIdSchema = z.string().regex(/^[a-z][a-z0-9_]+$/)
const statusSchema = z.enum(['draft', 'published', 'archived'])
const codeSize = z.string().refine((value) => new TextEncoder().encode(value).byteLength <= 512 * 1024, 'Codice oltre 512 KiB')
const starterFile = z.object({
  name: projectFileNameSchema,
  code: codeSize,
})

export const courseSchema = z.object({
  externalId: externalIdSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().nonnegative(),
  status: statusSchema,
})

const lessonBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('markdown'), body: z.string().min(1) }),
  z.object({ type: z.literal('code'), language: z.string().min(1), code: codeSize, filename: z.string().optional(), caption: z.string().optional() }),
  z.object({ type: z.literal('callout'), variant: z.enum(['info', 'tip', 'warning']), title: z.string().optional(), body: z.string().min(1) }),
])

export const lessonSchema = z.object({
  externalId: externalIdSchema,
  courseId: externalIdSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().nonnegative(),
  status: statusSchema,
  blocks: z.array(lessonBlockSchema).min(1),
  exerciseIds: z.array(externalIdSchema),
})

export const exerciseSchema = z.object({
  externalId: externalIdSchema,
  title: z.string().min(1),
  instructions: z.string().min(1),
  language: languageSchema,
  starterCode: codeSize,
  starterFiles: z.array(starterFile).max(24).default([]),
  learningObjectives: z.array(z.string().min(1)).min(1),
  expectedBehavior: z.string().min(1),
  graderInstructions: z.string().min(1),
  status: statusSchema,
}).superRefine((exercise, context) => {
  const names = new Set<string>()
  for (const [index, file] of exercise.starterFiles.entries()) {
    if (!validFileName(file.name, exercise.language) || names.has(file.name)) context.addIssue({ code: 'custom', path: ['starterFiles', index, 'name'], message: 'Nome file duplicato o non valido per il linguaggio' })
    names.add(file.name)
  }
})

export type Course = z.infer<typeof courseSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type Exercise = z.infer<typeof exerciseSchema>
export type LessonBlock = Lesson['blocks'][number]

export type CourseSummary = Course & { lessonCount: number; completedCount: number; unlocked: boolean; completed: boolean; learningStatus: 'locked' | 'available' | 'in_progress' | 'completed' }
export type StudentExerciseDTO = Pick<Exercise, 'externalId' | 'title' | 'instructions' | 'language' | 'learningObjectives'>
export type StudentExerciseView = StudentExerciseDTO & { progress: null | {
  attempts: number
  completed: boolean
  feedback: string | null
  submissionStatus: string | null
}; unlocked: boolean; completed: boolean }
export type StudentLessonDTO = Lesson & { exercises: StudentExerciseView[] }
export type GraderExerciseSpec = Exercise
