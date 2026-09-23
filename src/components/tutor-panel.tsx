import { HugeiconsIcon } from '@hugeicons/react'
import { AiChat02Icon } from '@hugeicons/core-free-icons'

export function TutorPanel() {
  return <aside className="ide-files-panel flex h-full flex-col" aria-label="Tutor">
    <div className="flex h-12 items-center gap-2 border-b border-border px-3"><HugeiconsIcon icon={AiChat02Icon} className="size-4" /><span className="text-xs font-semibold">Tutor</span></div>
    <div className="flex flex-1 flex-col items-center justify-center px-5 text-center"><div className="flex size-10 items-center justify-center rounded-full bg-accent"><HugeiconsIcon icon={AiChat02Icon} className="size-5" /></div><p className="mt-3 text-sm font-medium">Tutor in arrivo</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Qui potrai chiedere aiuto sulla lezione e sul codice.</p></div>
  </aside>
}
