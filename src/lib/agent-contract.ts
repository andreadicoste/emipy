import { z } from 'zod'

const agentCodeSchema = z.string().max(512 * 1024)

export const agentFileSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,74}\.py$/).refine((name) => name !== 'main.py'),
  code: agentCodeSchema,
})

export const programSnapshotSchema = z.object({
  mainCode: agentCodeSchema,
  files: z.array(agentFileSchema).max(24),
})

export const runCurrentProgramInputSchema = z.object({
  stdin: z.array(z.string().max(4096)).max(12).optional(),
})

export const evaluationResultSchema = z.object({
  stdout: z.string().max(128 * 1024),
  stderr: z.string().max(128 * 1024),
  timedOut: z.boolean(),
  inputExhausted: z.boolean(),
})

export const tutorRequestSchema = z.object({
  messages: z.array(z.unknown()).max(60),
  context: z.object({
    programId: z.string().min(1).nullable(),
    courseId: z.string().min(1),
    lessonId: z.string().min(1),
    snapshot: programSnapshotSchema.nullable(),
    lastExecution: z.string().max(128 * 1024),
  }),
})

export const beginGradingSchema = z.object({
  programId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  snapshot: programSnapshotSchema,
})

export const finishGradingSchema = z.object({
  submissionId: z.string().min(1),
  evaluation: evaluationResultSchema,
})

export const graderResultSchema = z.object({
  completed: z.boolean(),
  feedback: z.string().min(1).max(2000),
})

export type EvaluationResult = z.infer<typeof evaluationResultSchema>
export type ProgramSnapshot = z.infer<typeof programSnapshotSchema>
