import { z } from 'zod'
import { languageSchema, projectFileNameSchema, validFileName } from './languages'

const agentCodeSchema = z.string().max(512 * 1024)

export const agentFileSchema = z.object({
  name: projectFileNameSchema,
  code: agentCodeSchema,
})

export const programSnapshotSchema = z.object({
  language: languageSchema.default('python'),
  mainCode: agentCodeSchema,
  files: z.array(agentFileSchema).max(24),
}).superRefine((snapshot, context) => {
  const names = new Set<string>()
  for (const [index, file] of snapshot.files.entries()) {
    if (!validFileName(file.name, snapshot.language) || names.has(file.name)) context.addIssue({ code: 'custom', path: ['files', index, 'name'], message: 'Nome file duplicato o non valido per il linguaggio' })
    names.add(file.name)
  }
})

export const runCurrentProgramInputSchema = z.object({
  stdin: z.array(z.string().max(4096)).max(12).optional(),
})

export const evaluationResultSchema = z.object({
  exitCode: z.number().int().optional(),
  compileFailed: z.boolean().optional(),
  stdin: z.array(z.string().max(4096)).max(12).optional(),
  stdout: z.string().max(128 * 1024),
  stderr: z.string().max(128 * 1024),
  transcript: z.string().max(256 * 1024).optional(),
  timedOut: z.boolean(),
  inputExhausted: z.boolean(),
})

export const graderRunPlanSchema = z.object({
  runs: z.array(z.object({
    stdin: z.array(z.string().max(4096)).max(12),
  })).min(1).max(5),
})

export const gradingEvaluationSchema = z.object({
  runs: z.array(evaluationResultSchema).min(1).max(5),
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
  evaluation: gradingEvaluationSchema,
})

export const graderResultSchema = z.object({
  completed: z.boolean(),
  feedback: z.string().min(1).max(2000),
})

export type EvaluationResult = z.infer<typeof evaluationResultSchema>
export type GradingEvaluation = z.infer<typeof gradingEvaluationSchema>
export type ProgramSnapshot = z.infer<typeof programSnapshotSchema>
