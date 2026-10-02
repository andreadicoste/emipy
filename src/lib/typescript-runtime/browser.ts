import { compileTypeScript } from './compiler'

// Raw declarations become part of this lazily loaded, same-origin compiler chunk.
const declarations = import.meta.glob('/node_modules/typescript/lib/lib*.d.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const libraries = Object.fromEntries(Object.entries(declarations).map(([path, content]) => [path.slice(path.lastIndexOf('/') + 1), content]))
export const compile = (code: string, files: { name: string; code: string }[]) => compileTypeScript(code, files, libraries)
