import type { ExecutionContext, Guard } from '../types'

export class AuthGuard implements Guard {
  canActivate(context: ExecutionContext): boolean {
    const header = context.req.headers.authorization

    return typeof header === 'string' && header.startsWith('Bearer ')
  }
}
