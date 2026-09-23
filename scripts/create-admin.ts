import { auth } from '../src/lib/auth'

if (!process.stdin.isTTY) throw new Error('Esegui questo script in un terminale interattivo.')

async function ask(label: string, secret = false): Promise<string> {
  process.stdout.write(label)
  if (!secret) {
    const reader = await import('node:readline/promises')
    const prompt = reader.createInterface({ input: process.stdin, terminal: false })
    const answer = await prompt.question('')
    prompt.close()
    return answer.trim()
  }
  process.stdin.setRawMode(true)
  process.stdin.resume()
  return new Promise((resolve, reject) => {
    let value = ''
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString()) {
        if (char === '\r' || char === '\n') {
          process.stdin.off('data', onData)
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdout.write('\n')
          resolve(value)
          return
        } else if (char === '\u0003') {
          process.stdin.off('data', onData)
          process.stdin.setRawMode(false)
          process.stdin.pause()
          reject(new Error('Annullato'))
          return
        } else if (char === '\u007f') {
          value = value.slice(0, -1)
        } else {
          value += char
        }
      }
    }
    process.stdin.on('data', onData)
  })
}

const name = await ask('Nome admin: ')
const email = await ask('Email admin: ')
const password = await ask('Password admin (nascosta): ', true)
if (!name || !email.includes('@') || password.length < 8) throw new Error('Nome, email o password non validi.')
await auth.api.createUser({ body: { name, email, password, role: 'admin' } })
process.stdout.write('Admin creato.\n')
process.exit(0)
