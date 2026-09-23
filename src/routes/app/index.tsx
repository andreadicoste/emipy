import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { createProgram, listPrograms } from '@/lib/programs.functions'

export const Route = createFileRoute('/app/')({
  loader: async () => {
    const programs = await listPrograms()
    if (programs[0]) throw redirect({ to: '/app/$programId', params: { programId: programs[0].id } })
    return null
  },
  component: Empty,
})

function Empty() {
  const navigate = useNavigate()
  return <main className="flex min-h-dvh flex-col items-center justify-center bg-secondary px-5 text-center">
    <img src="/assets/emipy-symbol.svg" alt="" className="brand-symbol size-14" />
    <h1 className="mt-6 text-2xl font-semibold">Il tuo spazio Python, pronto.</h1>
    <p className="mt-2 max-w-sm text-sm text-muted-foreground">Crea un programma, scrivi in main.py e premi START.</p>
    <Button className="mt-7" onClick={async () => { const p = await createProgram({ data: {} }); await navigate({ to: '/app/$programId', params: { programId: p.id } }) }}>Nuovo programma</Button>
  </main>
}
