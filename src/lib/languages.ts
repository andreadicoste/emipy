import { z } from 'zod'

export const languageSchema = z.enum(['python', 'c'])
export type Language = z.infer<typeof languageSchema>
export const languages = {
  python: { label: 'Python', mainFile: 'main.py', extension: '.py', exampleFile: 'modulo.py', starterCode: 'print("Ciao, Emipy!")\n' },
  c: { label: 'C', mainFile: 'main.c', extension: '.c', exampleFile: 'funzioni.c', starterCode: '#include <stdio.h>\n\nint main(void) {\n    printf("Ciao, Emipy!\\n");\n    return 0;\n}\n' },
} as const

export function validFileName(name: string, language: Language) {
  const pattern = language === 'python' ? /^[A-Za-z_][A-Za-z0-9_]{0,74}\.py$/ : /^[A-Za-z_][A-Za-z0-9_]{0,74}\.(c|h)$/
  return pattern.test(name) && name !== languages[language].mainFile && !name.startsWith('__emipy_')
}

export const projectFileNameSchema = z.string().trim().max(78).refine((name) => validFileName(name, 'python') || validFileName(name, 'c'), 'Nome file non valido')
