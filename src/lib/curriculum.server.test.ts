import { expect, test } from 'bun:test'
import { buildLearningState, loadRegistry, validateRegistry, type Registry } from './curriculum.server'
import { courseSchema, exerciseSchema, lessonSchema } from './curriculum-schema'
import type { Language } from './languages'

function course(language: Language, order: number) {
  return courseSchema.parse({ externalId: `course_${language}_${order}`, language, order, slug: `${language}-${order}`, title: `${language} ${order}`, description: 'Corso', status: 'published' })
}
function fixture(): Registry {
  const courses = [course('python', 1), course('c', 1), course('python', 2), course('c', 2)]
  const exercises = courses.map((item) => exerciseSchema.parse({
    externalId: `ex_${item.externalId}`, language: item.language, title: 'Esercizio', instructions: 'Scrivi codice', starterCode: '',
    learningObjectives: ['Basi'], expectedBehavior: 'Output', graderInstructions: 'Verifica', status: 'published',
  }))
  const lessons = courses.map((item) => lessonSchema.parse({
    externalId: `lesson_${item.externalId}`, courseId: item.externalId, slug: 'introduzione', title: 'Introduzione', description: 'Lezione', order: 1, status: 'published',
    blocks: [{ type: 'markdown', body: 'Impara' }], exerciseIds: [`ex_${item.externalId}`],
  }))
  return { courses, lessons, exercises }
}

test('first courses unlock independently; completion only unlocks the same language', () => {
  const registry = fixture()
  validateRegistry(registry)
  const initial = buildLearningState(registry, new Set(), new Set(), new Set())
  expect(initial.courses.get('course_python_1')?.unlocked).toBe(true)
  expect(initial.courses.get('course_c_1')?.unlocked).toBe(true)
  expect(initial.courses.get('course_python_2')?.unlocked).toBe(false)
  expect(initial.courses.get('course_c_2')?.unlocked).toBe(false)
  const progress = buildLearningState(registry, new Set(), new Set(), new Set(['ex_course_python_1']))
  expect(progress.courses.get('course_python_2')?.unlocked).toBe(true)
  expect(progress.courses.get('course_c_1')?.unlocked).toBe(true)
  expect(progress.courses.get('course_c_2')?.unlocked).toBe(false)
  expect(progress.lessons.get('lesson_course_c_1')?.unlocked).toBe(true)
  expect(progress.exercises.get('ex_course_c_2')?.unlocked).toBe(false)
})

test('course order is unique per language and exercises match their parent course', () => {
  const duplicate = fixture()
  duplicate.courses[2].order = 1
  expect(() => validateRegistry(duplicate)).toThrow('python: course order')
  const mismatch = fixture()
  mismatch.exercises[0].language = 'c'
  expect(() => validateRegistry(mismatch)).toThrow('linguaggio diverso dal corso')
  expect(courseSchema.safeParse({ ...course('python', 1), language: undefined }).success).toBe(false)
})

test('legacy Python courses retain their identifiers and language', async () => {
  const registry = await loadRegistry()
  const byId = new Map(registry.courses.map((item) => [item.externalId, item]))
  for (const id of ['base', 'collections', 'data', 'functions', 'intermediate', 'projects']) {
    expect(byId.get(`course_python_${id}`)?.language).toBe('python')
  }
})

test('published curriculum covers every supported language', async () => {
  const registry = await loadRegistry()
  const supported: Language[] = ['python', 'c', 'cpp', 'javascript', 'typescript']
  for (const language of supported) {
    const courses = registry.courses.filter((item) => item.status === 'published' && item.language === language)
    expect(courses.length).toBeGreaterThanOrEqual(3)
    for (const course of courses) {
      expect(registry.lessons.some((lesson) => lesson.status === 'published' && lesson.courseId === course.externalId)).toBe(true)
    }
  }
})
