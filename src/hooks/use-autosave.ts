import { useCallback, useEffect, useRef, useState } from 'react'
import { saveProgramCode } from '@/lib/programs.functions'

type SaveStatus = 'saved' | 'saving' | 'error'

export function useAutosave(id: string, initialCode: string) {
  const [code, setCode] = useState(initialCode)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const codeRef = useRef(initialCode)
  const savedRef = useRef(initialCode)
  const inFlight = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (inFlight.current) await inFlight.current
    if (codeRef.current === savedRef.current) return
    const snapshot = codeRef.current
    setStatus('saving')
    const request = saveProgramCode({ data: { id, code: snapshot } }).then(() => {
      savedRef.current = snapshot
      setStatus(codeRef.current === snapshot ? 'saved' : 'saving')
    }).catch((error: unknown) => {
      setStatus('error')
      throw error
    })
    inFlight.current = request
    try { await request } finally { if (inFlight.current === request) inFlight.current = null }
    if (codeRef.current !== savedRef.current) await flush()
  }, [id])

  const update = useCallback((next: string) => {
    codeRef.current = next
    setCode(next)
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush().catch(() => {}) }, 700)
  }, [flush])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (codeRef.current !== savedRef.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      if (timer.current) clearTimeout(timer.current)
      void flush().catch(() => {})
    }
  }, [flush])

  return { code, status, update, flush, dirty: code !== savedRef.current }
}
