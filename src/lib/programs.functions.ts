import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'
import { prisma } from './prisma'
import { createFileSchema, createSchema, idSchema, renameSchema, saveFileSchema, saveSchema } from './validation'
import { languages, languageSchema, validFileName } from './languages'

async function userId() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new Error('Accesso richiesto')
  return session.user.id
}

const summary = { id: true, name: true, language: true, exerciseId: true, createdAt: true, updatedAt: true } as const

export const listPrograms = createServerFn({ method: 'GET' }).handler(async () => {
  const owner = await userId()
  return prisma.program.findMany({ where: { userId: owner }, select: summary, orderBy: { updatedAt: 'desc' } })
})

export const getProgram = createServerFn({ method: 'GET' }).validator(idSchema).handler(async ({ data }) => {
  const owner = await userId()
  const program = await prisma.program.findFirst({ where: { id: data.id, userId: owner }, include: { files: { orderBy: { createdAt: 'asc' } } } })
  if (!program) throw new Error('Programma non trovato')
  return program
})

export const createProgram = createServerFn({ method: 'POST' }).validator(createSchema).handler(async ({ data }) => {
  const owner = await userId()
  const language = data.language ?? 'python'
  return prisma.program.create({ data: { userId: owner, name: data.name ?? 'Senza titolo', language, code: languages[language].starterCode } })
})

export const renameProgram = createServerFn({ method: 'POST' }).validator(renameSchema).handler(async ({ data }) => {
  const owner = await userId()
  const result = await prisma.program.updateMany({ where: { id: data.id, userId: owner, exerciseId: null }, data: { name: data.name } })
  if (!result.count) throw new Error('Programma non trovato')
  return prisma.program.findFirstOrThrow({ where: { id: data.id, userId: owner }, select: summary })
})

export const saveProgramCode = createServerFn({ method: 'POST' }).validator(saveSchema).handler(async ({ data }) => {
  const owner = await userId()
  const result = await prisma.program.updateMany({ where: { id: data.id, userId: owner }, data: { code: data.code } })
  if (!result.count) throw new Error('Programma non trovato')
  return prisma.program.findFirstOrThrow({ where: { id: data.id, userId: owner }, select: { updatedAt: true } })
})

export const createProgramFile = createServerFn({ method: 'POST' }).validator(createFileSchema).handler(async ({ data }) => {
  const owner = await userId()
  const program = await prisma.program.findFirst({ where: { id: data.programId, userId: owner }, select: { id: true, language: true, _count: { select: { files: true } } } })
  if (!program) throw new Error('Programma non trovato')
  if (!validFileName(data.name, languageSchema.parse(program.language))) throw new Error('Estensione non valida per il linguaggio del programma')
  if (program._count.files >= 24) throw new Error('Massimo 24 file aggiuntivi')
  const existing = await prisma.programFile.findUnique({ where: { programId_name: { programId: data.programId, name: data.name } }, select: { id: true } })
  if (existing) throw new Error('File già presente')
  return prisma.programFile.create({ data: { programId: data.programId, name: data.name } })
})

export const saveProgramFile = createServerFn({ method: 'POST' }).validator(saveFileSchema).handler(async ({ data }) => {
  const owner = await userId()
  const program = await prisma.program.findFirst({ where: { id: data.programId, userId: owner }, select: { id: true } })
  if (!program) throw new Error('Programma non trovato')
  const result = await prisma.programFile.updateMany({ where: { id: data.id, programId: data.programId }, data: { code: data.code } })
  if (!result.count) throw new Error('File non trovato')
  await prisma.program.update({ where: { id: data.programId }, data: { updatedAt: new Date() } })
})

export const deleteProgram = createServerFn({ method: 'POST' }).validator(idSchema).handler(async ({ data }) => {
  const owner = await userId()
  const result = await prisma.program.deleteMany({ where: { id: data.id, userId: owner, exerciseId: null } })
  if (!result.count) throw new Error('Programma non trovato')
})
