import { z } from 'zod'

export const idSchema = z.object({ id: z.string().min(1) })
export const nameSchema = z.string().trim().min(1).max(80)
export const createSchema = z.object({ name: nameSchema.optional() })
export const renameSchema = idSchema.extend({ name: nameSchema })
export const codeSchema = z.string().refine(
  (code) => new TextEncoder().encode(code).byteLength <= 512 * 1024,
  'Il codice supera 512 KiB',
)
export const saveSchema = idSchema.extend({ code: codeSchema })
export const fileNameSchema = z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]{0,74}\.py$/, 'Usa un nome Python valido, per esempio modulo.py').refine((name) => name !== 'main.py', 'main.py esiste già')
export const createFileSchema = z.object({ programId: z.string().min(1), name: fileNameSchema })
export const saveFileSchema = z.object({ programId: z.string().min(1), id: z.string().min(1), code: codeSchema })
export const courseIdSchema = z.object({ courseId: z.string().min(1) })
export const lessonIdSchema = courseIdSchema.extend({ lessonId: z.string().min(1) })
export const startExerciseSchema = lessonIdSchema.extend({ exerciseId: z.string().min(1) })
export const workspaceSchema = lessonIdSchema.extend({ programId: z.string().min(1) })
export const submitExerciseSchema = z.object({ programId: z.string().min(1), idempotencyKey: z.string().uuid() })
