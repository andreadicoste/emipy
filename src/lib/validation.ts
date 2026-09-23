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
