import { createFileRoute } from '@tanstack/react-router'
import { Ide } from '@/components/ide'
import { getProgram, listPrograms } from '@/lib/programs.functions'

export const Route = createFileRoute('/app/playground/$programId')({
  loader: async ({ params }) => {
    const [program, programs] = await Promise.all([getProgram({ data: { id: params.programId } }), listPrograms()])
    if (program.exerciseId) throw new Error('Workspace esercizio non valido nel Playground')
    return { program, programs }
  }, component: Playground,
})

function Playground() {
  const { program, programs } = Route.useLoaderData()
  return <Ide key={program.id} program={program} programs={programs} />
}
