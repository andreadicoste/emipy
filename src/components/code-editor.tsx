import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/languages/definitions/python/register.js'
import 'monaco-editor/languages/definitions/javascript/register.js'
import 'monaco-editor/languages/definitions/typescript/register.js'
import 'monaco-editor/languages/definitions/cpp/register.js'
import Editor, { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import type { Language } from '@/lib/languages'

self.MonacoEnvironment = { getWorker: () => new editorWorker() }
loader.config({ monaco })

monaco.editor.defineTheme('emipy-light', {
  base: 'vs', inherit: true, rules: [],
  colors: {
    'editor.background': '#f1f1ef',
    'editorGutter.background': '#f1f1ef',
    'editor.lineHighlightBackground': '#e8e8e6',
    'editor.selectionBackground': '#d9e6f7',
  },
})
monaco.editor.defineTheme('emipy-dark', {
  base: 'vs-dark', inherit: true, rules: [],
  colors: {
    'editor.background': '#222223',
    'editorGutter.background': '#222223',
    'editor.lineHighlightBackground': '#29292b',
    'editor.selectionBackground': '#33445c',
  },
})

export function CodeEditor({ path, value, onChange, dark, language }: { path: string; value: string; onChange: (code: string) => void; dark: boolean; language: Language }) {
  return <Editor
    height="100%"
    language={language}
    path={path}
    value={value}
    theme={dark ? 'emipy-dark' : 'emipy-light'}
    onChange={(next) => onChange(next ?? '')}
    options={{
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 4,
      insertSpaces: true,
      wordWrap: 'on',
      padding: { top: 20, bottom: 20 },
      lineNumbersMinChars: 3,
      renderLineHighlight: 'line',
      overviewRulerBorder: false,
    }}
  />
}
