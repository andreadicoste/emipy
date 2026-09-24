import { useCallback, useEffect, useRef, useState } from 'react'
import { saveProgramCode, saveProgramFile } from '@/lib/programs.functions'

export const MAIN_FILE_ID = 'main'
export type EditableFile = { id: string; name: string; code: string }
type SaveStatus = 'saved' | 'saving' | 'error'

export function useAutosave(programId: string | null, initialFiles: EditableFile[]) {
  const [files, setFiles] = useState(initialFiles)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const filesRef = useRef(initialFiles)
  const savedRef = useRef(new Map(initialFiles.map((file) => [file.id, file.code])))
  const inFlight = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (inFlight.current) await inFlight.current
    const changed = filesRef.current.filter((file) => file.code !== savedRef.current.get(file.id))
    if (!programId || !changed.length) { setStatus('saved'); return }
    setStatus('saving')
    const request = Promise.all(changed.map(async (file) => {
      if (file.id === MAIN_FILE_ID) await saveProgramCode({ data: { id: programId, code: file.code } })
      else await saveProgramFile({ data: { programId, id: file.id, code: file.code } })
      savedRef.current.set(file.id, file.code)
    })).then(() => {
      setStatus(filesRef.current.some((file) => file.code !== savedRef.current.get(file.id)) ? 'saving' : 'saved')
    }).catch((error: unknown) => {
      setStatus('error')
      throw error
    })
    inFlight.current = request
    try { await request } finally { if (inFlight.current === request) inFlight.current = null }
    if (filesRef.current.some((file) => file.code !== savedRef.current.get(file.id))) await flush()
  }, [programId])

  const update = useCallback((id: string, code: string) => {
    filesRef.current = filesRef.current.map((file) => file.id === id ? { ...file, code } : file)
    setFiles(filesRef.current)
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush().catch(() => {}) }, 700)
  }, [flush])

  const add = useCallback((file: EditableFile) => {
    filesRef.current = [...filesRef.current, file]
    savedRef.current.set(file.id, file.code)
    setFiles(filesRef.current)
  }, [])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (filesRef.current.some((file) => file.code !== savedRef.current.get(file.id))) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      if (timer.current) clearTimeout(timer.current)
      void flush().catch(() => {})
    }
  }, [flush])

  return { files, status, update, add, flush }
}
