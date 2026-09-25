import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai'
import { HugeiconsIcon } from '@hugeicons/react'
import { AiChat02Icon, ArrowUp02Icon, Loading03Icon, PlayIcon } from '@hugeicons/core-free-icons'
import { Field, FieldGroup } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { runCurrentProgramInputSchema, type EvaluationResult, type ProgramSnapshot } from '@/lib/agent-contract'

type TutorTools = { run_current_program: { input: { stdin?: string[] }; output: EvaluationResult } }
type TutorMessage = UIMessage<unknown, Record<string, never>, TutorTools>
export type TutorContext = {
  programId: string | null
  courseId: string
  lessonId: string
  snapshot: ProgramSnapshot | null
  lastExecution: string
}

function MessageText({ text }: { text: string }) {
  return <div className="tutor-markdown"><ReactMarkdown>{text}</ReactMarkdown></div>
}

export function TutorPanel({ context, runCurrentProgram }: {
  context?: TutorContext | null
  runCurrentProgram?: (stdin: string[]) => Promise<EvaluationResult>
}) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)
  const contextRef = useRef(context)
  const runRef = useRef(runCurrentProgram)
  contextRef.current = context
  runRef.current = runCurrentProgram
  const transport = useMemo(() => new DefaultChatTransport<TutorMessage>({
    api: '/api/tutor',
    body: () => ({ context: contextRef.current }),
  }), [])
  const { messages, sendMessage, addToolOutput, status, error } = useChat<TutorMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic || toolCall.toolName !== 'run_current_program') return
      const stdin = runCurrentProgramInputSchema.parse(toolCall.input).stdin ?? []
      const execute = runRef.current
      const fallback: EvaluationResult = { stdout: '', stderr: 'Nessun programma corrente da eseguire.', timedOut: false, inputExhausted: false }
      void (execute ? execute(stdin) : Promise.resolve(fallback)).then((output) => addToolOutput({ tool: 'run_current_program', toolCallId: toolCall.toolCallId, output }))
    },
  })
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    const viewport = endRef.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages, status])

  function submit() {
    const text = input.trim()
    if (!text || busy || !context) return
    setInput('')
    void sendMessage({ text })
  }

  return <aside className="ide-files-panel flex h-full flex-col" aria-label="Tutor">
    {!context ? <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center"><div className="flex size-9 items-center justify-center rounded-full bg-accent"><HugeiconsIcon icon={AiChat02Icon} aria-hidden="true" /></div><p className="text-xs font-medium">Apri una lezione</p><p className="text-[11px] leading-4 text-muted-foreground">Tutor disponibile durante corso ed esercizi.</p></div> : <>
      <ScrollArea className="min-h-0 flex-1 px-2.5 py-3">
        <div className="flex flex-col gap-3" aria-live="polite">
          {messages.map((message) => <div key={message.id} className={`flex flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
            {message.parts.map((part, index) => {
              if (part.type === 'text' && part.text) return <div key={index} className={message.role === 'user' ? 'max-w-[92%] rounded-lg bg-primary px-2.5 py-2 text-xs text-primary-foreground' : 'max-w-full px-1 text-xs leading-5'}><MessageText text={part.text} /></div>
              if (part.type === 'tool-run_current_program') return <div key={index} className="flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-[10px] text-muted-foreground"><HugeiconsIcon icon={part.state === 'output-available' ? PlayIcon : Loading03Icon} className={part.state === 'output-available' ? undefined : 'animate-spin'} aria-hidden="true" />{part.state === 'output-available' ? 'Programma eseguito' : 'Eseguo programma…'}</div>
              return null
            })}
          </div>)}
          {busy && messages.at(-1)?.role !== 'assistant' && <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground"><HugeiconsIcon icon={Loading03Icon} className="animate-spin" aria-hidden="true" />Tutor pensa…</div>}
          {error && <p role="alert" className="px-1 text-[10px] text-destructive">Tutor non disponibile. Riprova.</p>}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <form onSubmit={(event) => { event.preventDefault(); submit() }} className="shrink-0 p-2">
        <FieldGroup className="gap-0"><Field className="gap-0"><InputGroup><InputGroupTextarea aria-label="Messaggio al Tutor" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }} placeholder="Chiedi al Tutor…" rows={1} className="max-h-24 min-h-9 py-2 text-xs" /><InputGroupAddon align="block-end" className="justify-end px-1.5 pb-1.5 pt-0"><InputGroupButton type="submit" variant="default" size="icon-xs" disabled={busy || !input.trim()} aria-label="Invia al Tutor"><HugeiconsIcon icon={busy ? Loading03Icon : ArrowUp02Icon} className={busy ? 'animate-spin' : undefined} aria-hidden="true" /></InputGroupButton></InputGroupAddon></InputGroup></Field></FieldGroup>
      </form>
    </>}
  </aside>
}
