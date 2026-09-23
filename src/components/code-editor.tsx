import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/languages/definitions/python/register.js'
import Editor, { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'

self.MonacoEnvironment = { getWorker: () => new editorWorker() }
loader.config({ monaco })

monaco.editor.defineTheme('emipy-light', {
  base: 'vs', inherit: true, rules: [],
  colors: { 'editor.background': '#ffffff', 'editorGutter.background': '#ffffff' },
})
monaco.editor.defineTheme('emipy-dark', {
  base: 'vs-dark', inherit: true, rules: [],
  colors: {
    'editor.background': '#1b1518',
    'editorGutter.background': '#1b1518',
    'editor.lineHighlightBackground': '#2d2226',
    'editor.selectionBackground': '#573540',
  },
})

export function CodeEditor({ value, onChange, dark }: { value: string; onChange: (code: string) => void; dark: boolean }) {
  return <Editor
    height="100%"
    language="python"
    path="main.py"
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
