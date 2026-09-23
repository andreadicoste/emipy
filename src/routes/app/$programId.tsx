import { createFileRoute } from '@tanstack/react-router'
import { getProgram, listPrograms } from '@/lib/programs.functions'
import { Ide } from '@/components/ide'

export const Route = createFileRoute('/app/$programId')({
  loader: async ({ params }) => {
    const [program, programs] = await Promise.all([
      getProgram({ data: { id: params.programId } }),
      listPrograms(),
    ])
    return { program, programs }
  },
  component: ProgramRoute,
})

function ProgramRoute() {
  const { program, programs } = Route.useLoaderData()
  return <Ide key={program.id} program={program} programs={programs} />
}
