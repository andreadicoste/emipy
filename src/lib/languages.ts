import { z } from 'zod'

export const languageSchema = z.enum(['python', 'c', 'cpp'])
export type Language = z.infer<typeof languageSchema>
export type CompiledLanguage = 'c' | 'cpp'
export function isCompiledLanguage(language: Language): language is CompiledLanguage {
  return language === 'c' || language === 'cpp'
}
export const languages = {
  python: { label: 'Python', mainFile: 'main.py', extension: '.py', exampleFile: 'modulo.py', starterCode: 'print("Ciao, Emipy!")\n' },
  c: { label: 'C', mainFile: 'main.c', extension: '.c', exampleFile: 'funzioni.c', starterCode: '#include <stdio.h>\n\nint main(void) {\n    printf("Ciao, Emipy!\\n");\n    return 0;\n}\n' },
  cpp: { label: 'C++', mainFile: 'main.cpp', extension: '.cpp', exampleFile: 'funzioni.cpp', starterCode: '#include <iostream>\n\nint main() {\n    std::cout << "Ciao, Emipy!" << std::endl;\n    return 0;\n}\n' },
} as const

export function validFileName(name: string, language: Language) {
  const patterns = {
    python: /^[A-Za-z_][A-Za-z0-9_]{0,74}\.py$/,
    c: /^[A-Za-z_][A-Za-z0-9_]{0,74}\.(c|h)$/,
    cpp: /^[A-Za-z_][A-Za-z0-9_]{0,74}\.(c|cpp|cc|cxx|h|hpp|hh|hxx)$/,
  }
  const pattern = patterns[language]
  return pattern.test(name) && name !== languages[language].mainFile && !name.startsWith('__emipy_')
}

export const projectFileNameSchema = z.string().trim().max(78).refine((name) => languageSchema.options.some((language) => validFileName(name, language)), 'Nome file non valido')
