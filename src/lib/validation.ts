import { z } from 'zod'
import { languageSchema, projectFileNameSchema } from './languages'

export const idSchema = z.object({ id: z.string().min(1) })
export const nameSchema = z.string().trim().min(1).max(80)
export const createSchema = z.object({ name: nameSchema.optional(), language: languageSchema.optional() })
export const renameSchema = idSchema.extend({ name: nameSchema })
export const codeSchema = z.string().refine(
  (code) => new TextEncoder().encode(code).byteLength <= 512 * 1024,
  'Il codice supera 512 KiB',
)
export const saveSchema = idSchema.extend({ code: codeSchema })
export const fileNameSchema = projectFileNameSchema
export const createFileSchema = z.object({ programId: z.string().min(1), name: fileNameSchema })
export const saveFileSchema = z.object({ programId: z.string().min(1), id: z.string().min(1), code: codeSchema })
export const courseIdSchema = z.object({ courseId: z.string().min(1) })
export const lessonIdSchema = courseIdSchema.extend({ lessonId: z.string().min(1) })
export const startExerciseSchema = lessonIdSchema.extend({ exerciseId: z.string().min(1) })
export const workspaceSchema = lessonIdSchema.extend({ programId: z.string().min(1) })
export const submitExerciseSchema = z.object({ programId: z.string().min(1), idempotencyKey: z.string().uuid() })
