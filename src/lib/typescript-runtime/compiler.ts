import ts from 'typescript'

type SourceFile = { name: string; code: string }
const consoleTypes = `
declare const console: {
  log(...values: unknown[]): void;
  info(...values: unknown[]): void;
  debug(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
};
declare function input(message?: unknown): string | null;
declare function prompt(message?: unknown): string | null;
declare function print(...values: unknown[]): void;
`

// The compiler receives a virtual filesystem: no ts.sys reads or network access.
// ES libraries describe QuickJS, without browser/Node globals.
export function compileTypeScript(code: string, files: SourceFile[], libraries: Record<string, string>) {
  const sources = new Map([
    ['/main.ts', code], ['/emipy-console.d.ts', consoleTypes],
    ...files.map((file) => [`/${file.name}`, file.code] as const),
    ...Object.entries(libraries).map(([name, content]) => [`/${name}`, content] as const),
  ])
  const output = new Map<string, string>()
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmitOnError: true,
    rewriteRelativeImportExtensions: true,
    lib: ['lib.es2022.d.ts'],
    types: [],
  }
  const host: ts.CompilerHost = {
    getSourceFile: (name, target) => {
      const source = sources.get(name)
      return source === undefined ? undefined : ts.createSourceFile(name, source, target, true)
    },
    getDefaultLibFileName: () => '/lib.es2022.d.ts',
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => sources.has(name),
    readFile: (name) => sources.get(name),
    directoryExists: (name) => name === '/',
    writeFile: (name, content) => output.set(name.slice(1), content),
  }
  const program = ts.createProgram(['/main.ts', '/emipy-console.d.ts', ...files.map((file) => `/${file.name}`)], options, host)
  const diagnostics = [...ts.getPreEmitDiagnostics(program)]
  if (!diagnostics.some((item) => item.category === ts.DiagnosticCategory.Error)) {
    const emitted = program.emit()
    diagnostics.push(...emitted.diagnostics)
  }
  const messages = diagnostics.map((item) => {
    const message = ts.flattenDiagnosticMessageText(item.messageText, '\n')
    if (!item.file || item.start === undefined) return `TS${item.code}: ${message}`
    const { line, character } = item.file.getLineAndCharacterOfPosition(item.start)
    return `${item.file.fileName.slice(1)}:${line + 1}:${character + 1} TS${item.code}: ${message}`
  })
  return {
    success: !diagnostics.some((item) => item.category === ts.DiagnosticCategory.Error) && output.has('main.js'),
    diagnostics: messages.join('\n'),
    code: output.get('main.js') ?? '',
    files: [...output].filter(([name]) => name !== 'main.js').map(([name, code]) => ({ name, code })),
  }
}
