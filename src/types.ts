import type { IncomingMessage, ServerResponse } from 'node:http'

export type Constructor<T = unknown> = new (...args: any[]) => T

export interface ExecutionContext {
  req: IncomingMessage
  res: ServerResponse
  method: string
  path: string
}

export type Middleware = (context: ExecutionContext) => void | Promise<void>

export interface Guard {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>
}

export interface Interceptor {
  intercept(
    context: ExecutionContext,
    next: () => Promise<unknown>
  ): Promise<unknown>
}
