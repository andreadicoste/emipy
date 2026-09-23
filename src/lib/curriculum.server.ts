import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { courseSchema, exerciseSchema, lessonSchema, type Course, type Exercise, type Lesson, type StudentExerciseDTO } from './curriculum-schema'

type Registry = { courses: Course[]; lessons: Lesson[]; exercises: Exercise[] }

async function readCollection<T>(folder: string, parse: (value: unknown) => T): Promise<T[]> {
  const root = path.join(process.cwd(), 'content', folder)
  const files = (await readdir(root)).filter((name) => name.endsWith('.json')).sort()
  return Promise.all(files.map(async (name) => {
    const value = parse(JSON.parse(await readFile(path.join(root, name), 'utf8')))
    const externalId = (value as { externalId: string }).externalId
    if (name !== `${externalId}.json`) throw new Error(`${folder}/${name}: filename diverso da externalId`)
    return value
  }))
}

export async function loadRegistry(): Promise<Registry> {
  const [courses, lessons, exercises] = await Promise.all([
    readCollection('courses', (value) => courseSchema.parse(value)),
    readCollection('lessons', (value) => lessonSchema.parse(value)),
    readCollection('exercises', (value) => exerciseSchema.parse(value)),
  ])
  validateRegistry({ courses, lessons, exercises })
  return { courses, lessons, exercises }
}

export function validateRegistry(registry: Registry) {
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`${label}: ID duplicato`)
  }
  unique(registry.courses.map((item) => item.externalId), 'courses')
  unique(registry.lessons.map((item) => item.externalId), 'lessons')
  unique(registry.exercises.map((item) => item.externalId), 'exercises')
  unique([...registry.courses, ...registry.lessons, ...registry.exercises].map((item) => item.externalId), 'curriculum')
  unique(registry.courses.map((item) => item.slug), 'course slug')
  const courses = new Map(registry.courses.map((item) => [item.externalId, item]))
  const exercises = new Map(registry.exercises.map((item) => [item.externalId, item]))
  const references = new Map<string, number>()
  const publishedReferences = new Map<string, number>()
  for (const course of registry.courses) {
    const lessons = registry.lessons.filter((item) => item.courseId === course.externalId)
    unique(lessons.map((item) => item.slug), `${course.externalId}: lesson slug`)
    unique(lessons.map((item) => String(item.order)), `${course.externalId}: lesson order`)
  }
  for (const lesson of registry.lessons) {
    const course = courses.get(lesson.courseId)
    if (!course) throw new Error(`${lesson.externalId}: corso inesistente`)
    if (lesson.status === 'published' && course.status !== 'published') throw new Error(`${lesson.externalId}: corso non pubblicato`)
    for (const id of lesson.exerciseIds) {
      const exercise = exercises.get(id)
      if (!exercise) throw new Error(`${lesson.externalId}: esercizio ${id} inesistente`)
      if (lesson.status === 'published' && exercise.status !== 'published') throw new Error(`${lesson.externalId}: esercizio ${id} non pubblicato`)
      references.set(id, (references.get(id) ?? 0) + 1)
      if (lesson.status === 'published') publishedReferences.set(id, (publishedReferences.get(id) ?? 0) + 1)
    }
  }
  for (const [id, count] of references) if (count > 1) throw new Error(`${id}: referenziato da più lezioni`)
  for (const exercise of registry.exercises) {
    if (exercise.status === 'published' && publishedReferences.get(exercise.externalId) !== 1) throw new Error(`${exercise.externalId}: deve appartenere a una lezione pubblicata`)
  }
}

export function studentExercise(exercise: Exercise): StudentExerciseDTO {
  const { externalId, title, instructions, language, learningObjectives } = exercise
  return { externalId, title, instructions, language, learningObjectives }
}

export function findExerciseContext(registry: Registry, exerciseId: string) {
  const lesson = registry.lessons.find((item) => item.exerciseIds.includes(exerciseId))
  const course = lesson && registry.courses.find((item) => item.externalId === lesson.courseId)
  return lesson && course ? { course, lesson } : null
}
