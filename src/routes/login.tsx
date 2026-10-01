import { useEffect, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { getSession } from '@/lib/session.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => { if (await getSession()) throw redirect({ to: '/app' }) },
  component: Login,
})

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await authClient.signIn.email({ email, password })
      if (result.error) { setError('Email o password non validi.'); return }
      await navigate({ to: '/app' })
    } catch { setError('Accesso non riuscito. Riprova.') }
    finally { setBusy(false) }
  }

  return <main className="flex min-h-dvh items-center justify-center bg-brand-soft px-4 py-8">
    <div className="w-full max-w-[360px] rounded-xl border border-border bg-background p-6 shadow-sm sm:p-7">
      <img src="/assets/emipy-wordmark.svg" alt="Emipy" className="brand-wordmark h-10 w-auto" />
      <h1 className="mt-7 text-xl font-semibold tracking-tight">Bentornato.</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">I tuoi programmi sono qui.</p>
      <form onSubmit={submit} className="mt-6">
        <FieldGroup>
          <Field><FieldLabel htmlFor="email">Email</FieldLabel><Input id="email" type="email" autoComplete="username" required disabled={!hydrated} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field><FieldLabel htmlFor="password">Password</FieldLabel><Input id="password" type="password" autoComplete="current-password" required disabled={!hydrated} value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        </FieldGroup>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy || !hydrated} className="mt-5 w-full">{busy ? 'Accesso…' : 'Accedi'}</Button>
      </form>
    </div>
  </main>
}
