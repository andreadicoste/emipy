import { defineConfig } from 'tinacms'

const statusField = {
  type: 'string' as const,
  name: 'status',
  label: 'Stato',
  required: true,
  options: ['draft', 'published', 'archived'],
}

export default defineConfig({
  client: { skip: true },
  build: { publicFolder: 'public', outputFolder: 'content-admin' },
  media: { tina: { publicFolder: 'public', mediaRoot: 'uploads', static: true } },
  schema: {
    collections: [
      {
        name: 'course', label: 'Corsi', path: 'content/courses', format: 'json',
        fields: [
          { type: 'string', name: 'externalId', label: 'External ID', required: true, isTitle: true },
          { type: 'string', name: 'slug', label: 'Slug', required: true },
          { type: 'string', name: 'title', label: 'Titolo', required: true },
          { type: 'string', name: 'description', label: 'Descrizione', required: true, ui: { component: 'textarea' } },
          { type: 'number', name: 'order', label: 'Ordine', required: true }, statusField,
        ],
      },
      {
        name: 'lesson', label: 'Lezioni', path: 'content/lessons', format: 'json',
        fields: [
          { type: 'string', name: 'externalId', label: 'External ID', required: true, isTitle: true },
          { type: 'string', name: 'courseId', label: 'Course ID', required: true },
          { type: 'string', name: 'slug', label: 'Slug', required: true },
          { type: 'string', name: 'title', label: 'Titolo', required: true },
          { type: 'string', name: 'description', label: 'Descrizione', required: true, ui: { component: 'textarea' } },
          { type: 'number', name: 'order', label: 'Ordine', required: true }, statusField,
          {
            type: 'object', name: 'blocks', label: 'Contenuto', list: true,
            fields: [
              { type: 'string', name: 'type', label: 'Tipo', required: true, options: ['markdown', 'code', 'callout'] },
              { type: 'string', name: 'body', label: 'Markdown', ui: { component: 'textarea' } },
              { type: 'string', name: 'language', label: 'Linguaggio' },
              { type: 'string', name: 'code', label: 'Codice', ui: { component: 'textarea' } },
              { type: 'string', name: 'filename', label: 'Nome file' },
              { type: 'string', name: 'caption', label: 'Didascalia' },
              { type: 'string', name: 'variant', label: 'Callout', options: ['info', 'tip', 'warning'] },
              { type: 'string', name: 'title', label: 'Titolo callout' },
            ],
          },
          { type: 'string', name: 'exerciseIds', label: 'Exercise ID', list: true },
        ],
      },
      {
        name: 'exercise', label: 'Esercizi', path: 'content/exercises', format: 'json',
        fields: [
          { type: 'string', name: 'externalId', label: 'External ID', required: true, isTitle: true },
          { type: 'string', name: 'title', label: 'Titolo', required: true },
          { type: 'string', name: 'instructions', label: 'Consegna', required: true, ui: { component: 'textarea' } },
          { type: 'string', name: 'language', label: 'Linguaggio', required: true, options: ['python', 'c'] },
          { type: 'string', name: 'starterCode', label: 'Codice del file principale', required: true, ui: { component: 'textarea' } },
          { type: 'object', name: 'starterFiles', label: 'Starter file', list: true, fields: [
            { type: 'string', name: 'name', label: 'Nome', required: true },
            { type: 'string', name: 'code', label: 'Codice', required: true, ui: { component: 'textarea' } },
          ] },
          { type: 'string', name: 'learningObjectives', label: 'Obiettivi', list: true, required: true },
          { type: 'string', name: 'expectedBehavior', label: 'Comportamento atteso', required: true, ui: { component: 'textarea' } },
          { type: 'string', name: 'graderInstructions', label: 'Istruzioni grader', required: true, ui: { component: 'textarea' } },
          statusField,
        ],
      },
    ],
  },
})
