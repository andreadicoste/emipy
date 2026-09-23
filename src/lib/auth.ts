import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { prisma } from './prisma'

const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? origin,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [origin],
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: { sameSite: 'lax' },
  },
  plugins: [admin(), tanstackStartCookies()],
})
