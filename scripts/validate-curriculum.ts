import { loadRegistry } from '../src/lib/curriculum.server'

const registry = await loadRegistry()
console.log(`Curriculum valido: ${registry.courses.length} corsi, ${registry.lessons.length} lezioni, ${registry.exercises.length} esercizi.`)
