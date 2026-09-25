import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { readLayoutCookie } from './layout-storage'

export const getLayoutPreferences = createServerFn({ method: 'GET' }).handler(() =>
  readLayoutCookie(getRequestHeaders().get('cookie') ?? ''),
)
