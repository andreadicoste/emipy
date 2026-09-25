import type { Layout } from 'react-resizable-panels'

export type LayoutKey = 'shell' | 'workspace' | 'vertical'
export type LayoutPreferences = Partial<Record<LayoutKey, Layout>>

export const layoutCookieName = 'emipy-layout-v1'
const layoutKeys: LayoutKey[] = ['shell', 'workspace', 'vertical']

// Panel needs its own size for SSR: Group's initial fallback skips saved zero-size panels.
export function panelDefaultSize(layout: Layout | undefined, panelId: string, fallback: number) {
  return `${layout?.[panelId] ?? fallback}%`
}

export function readLayoutCookie(header: string): LayoutPreferences {
  const raw = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${layoutCookieName}=`))?.slice(layoutCookieName.length + 1)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (!parsed || typeof parsed !== 'object') return {}
    const layouts: LayoutPreferences = {}
    for (const key of layoutKeys) {
      const layout = (parsed as Record<string, unknown>)[key]
      if (layout && typeof layout === 'object' && !Array.isArray(layout) && Object.values(layout).every((size) => typeof size === 'number' && Number.isFinite(size) && size >= 0 && size <= 100)) layouts[key] = layout as Layout
    }
    return layouts
  } catch { return {} }
}
