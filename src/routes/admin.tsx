import { useEffect, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, Search01Icon, UserAdd01Icon } from '@hugeicons/core-free-icons'
import { getSession } from '@/lib/session.functions'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
    if (!session.user.role?.split(',').includes('admin')) throw redirect({ to: '/app' })
    return { user: session.user }
  },
  component: Admin,
})

type User = { id: string; name: string; email: string; role?: string | null; banned?: boolean | null; createdAt: Date }

function Admin() {
  const navigate = useNavigate()
  const { user: currentUser } = Route.useRouteContext()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function refresh() {
    const result = await authClient.admin.listUsers({ query: { limit: 100, searchValue: search || undefined, searchField: 'email', searchOperator: 'contains' } })
    if (result.error) toast.error('Impossibile caricare utenti.')
    else setUsers(result.data?.users ?? [])
  }

  useEffect(() => { void refresh() }, [search])

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    const result = await authClient.admin.createUser({ name, email, password, role: 'user' })
    if (result.error) toast.error(result.error.message ?? 'Creazione non riuscita.')
    else { toast.success('Utente creato.'); setCreateOpen(false); setName(''); setEmail(''); setPassword(''); await refresh() }
    setBusy(false)
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault()
    if (!resetUser) return
    setBusy(true)
    const result = await authClient.admin.setUserPassword({ userId: resetUser.id, newPassword: password })
    if (result.error) toast.error(result.error.message ?? 'Reset non riuscito.')
    else { toast.success('Password aggiornata.'); setResetUser(null); setPassword('') }
    setBusy(false)
  }

  async function toggleBan(user: User) {
    setBusy(true)
    const result = user.banned ? await authClient.admin.unbanUser({ userId: user.id }) : await authClient.admin.banUser({ userId: user.id })
    if (result.error) toast.error(result.error.message ?? 'Operazione non riuscita.')
    else { toast.success(user.banned ? 'Utente riattivato.' : 'Utente sospeso.'); await refresh() }
    setBusy(false)
  }

  async function remove() {
    if (!deleteUser) return
    setBusy(true)
    const result = await authClient.admin.removeUser({ userId: deleteUser.id })
    if (result.error) toast.error(result.error.message ?? 'Eliminazione non riuscita.')
    else { toast.success('Utente eliminato.'); setDeleteUser(null); await refresh() }
    setBusy(false)
  }

  return <main className="min-h-dvh bg-secondary">
    <header className="flex h-12 items-center gap-2.5 border-b border-border bg-background px-3 sm:px-6">
      <Button variant="ghost" size="icon-sm" aria-label="Torna all'editor" onClick={() => void navigate({ to: '/app' })}><HugeiconsIcon icon={ArrowLeft01Icon} /></Button>
      <span aria-hidden="true" className="brand-symbol size-6" />
      <span className="text-sm font-semibold">Utenti Emipy</span>
      <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{currentUser.email}</span>
    </header>
    <section className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-semibold">Utenti</h1><p className="mt-0.5 text-sm text-muted-foreground">Accesso solo su invito dell'amministratore.</p></div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><HugeiconsIcon icon={UserAdd01Icon} /> Nuovo utente</Button>
      </div>
      <div className="relative mt-5 max-w-sm"><HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Cerca utenti" placeholder="Cerca per email…" className="h-8 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-border bg-card text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-semibold">Nome</th><th className="px-3 py-2 font-semibold">Email</th><th className="px-3 py-2 font-semibold">Stato</th><th className="px-3 py-2 font-semibold">Creato</th><th className="px-3 py-2 text-right font-semibold">Azioni</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-border last:border-0"><td className="px-3 py-2 font-medium">{user.name}{user.role?.split(',').includes('admin') && <span className="ml-2 text-xs text-muted-foreground">Admin</span>}</td><td className="px-3 py-2">{user.email}</td><td className="px-3 py-2">{user.banned ? 'Sospeso' : 'Attivo'}</td><td className="px-3 py-2 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString('it-IT')}</td><td className="flex justify-end gap-1 px-3 py-1.5"><Button variant="ghost" size="xs" onClick={() => { setPassword(''); setResetUser(user) }}>Password</Button><Button variant="ghost" size="xs" disabled={busy || user.id === currentUser.id} onClick={() => void toggleBan(user)}>{user.banned ? 'Riattiva' : 'Sospendi'}</Button><Button variant="ghost" size="xs" disabled={busy || user.id === currentUser.id} onClick={() => setDeleteUser(user)}>Elimina</Button></td></tr>)}</tbody></table>
        {users.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nessun utente trovato.</p>}
      </div>
    </section>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Nuovo utente</DialogTitle><DialogDescription>Condividi le credenziali con utente in modo sicuro.</DialogDescription></DialogHeader><form onSubmit={(event) => void create(event)}><FieldGroup><Field><FieldLabel htmlFor="name">Nome</FieldLabel><Input id="name" required value={name} onChange={(event) => setName(event.target.value)} /></Field><Field><FieldLabel htmlFor="new-email">Email</FieldLabel><Input id="new-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field><FieldLabel htmlFor="new-password">Password iniziale</FieldLabel><Input id="new-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></Field></FieldGroup><DialogFooter className="mt-5"><Button type="submit" disabled={busy}>Crea utente</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={!!resetUser} onOpenChange={(open) => { if (!open) setResetUser(null) }}><DialogContent><DialogHeader><DialogTitle>Nuova password</DialogTitle><DialogDescription>Per {resetUser?.email}.</DialogDescription></DialogHeader><form onSubmit={(event) => void resetPassword(event)}><Input type="password" minLength={8} required aria-label="Nuova password" value={password} onChange={(event) => setPassword(event.target.value)} /><DialogFooter className="mt-5"><Button type="submit" disabled={busy}>Aggiorna password</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminare {deleteUser?.name}?</AlertDialogTitle><AlertDialogDescription>Utente e tutti i suoi programmi saranno eliminati definitivamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void remove() }}>Elimina</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>
}
