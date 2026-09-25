import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import type { Layout } from 'react-resizable-panels'
import { layoutCookieName, type LayoutKey, type LayoutPreferences } from './layout-storage'

type LayoutContextValue = { layouts: LayoutPreferences; saveLayout: (key: LayoutKey, layout: Layout) => void }
const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutPreferencesProvider({ initial, children }: { initial: LayoutPreferences; children: ReactNode }) {
  const [layouts, setLayouts] = useState(initial)
  const current = useRef(initial)
  const saveLayout = useCallback((key: LayoutKey, layout: Layout) => {
    const next = { ...current.current, [key]: layout }
    current.current = next
    setLayouts(next)
    document.cookie = `${layoutCookieName}=${encodeURIComponent(JSON.stringify(next))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
  }, [])
  return <LayoutContext.Provider value={{ layouts, saveLayout }}>{children}</LayoutContext.Provider>
}

export function useLayoutPreferences() {
  const context = useContext(LayoutContext)
  if (!context) throw new Error('LayoutPreferencesProvider mancante')
  return context
}
