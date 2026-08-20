import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { Container } from './container'
import { runWithRequestContext } from './context/request-context'
import type { ParamMetadata } from './decorators/params'
import { BadRequestException, ForbiddenException, NotFoundException } from './errors'
import { ExceptionFilter } from './filters/exception.filter'
import { ZodValidationPipe } from './pipes/zod-validation.pipe'
import { Router, type RouteMatch } from './router'
import type {
  Constructor,
  ExecutionContext,
  Guard,
  Interceptor,
  Middleware,
} from './types'

export const REQUEST_ID_HEADER = 'x-request-id'

export interface DispatcherOptions {
  controllers: Constructor[]
  container?: Container
  middlewares?: Middleware[]
  guards?: Guard[]
  interceptors?: Interceptor[]
}

export class Dispatcher {
  readonly container: Container
  readonly router = new Router()

  private readonly middlewares: Middleware[]
  private readonly guards: Guard[]
  private readonly interceptors: Interceptor[]
  private readonly pipe = new ZodValidationPipe()
  private readonly filter = new ExceptionFilter()

  constructor(options: DispatcherOptions) {
    this.container = options.container ?? new Container()
    this.middlewares = options.middlewares ?? []
    this.guards = options.guards ?? []
    this.interceptors = options.interceptors ?? []

    for (const controller of options.controllers) {
      this.router.register(controller)
    }
  }

  createServer(): Server {
    return createServer((req, res) => {
      void this.handle(req, res)
    })
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = readRequestId(req)

    await runWithRequestContext({ requestId }, async () => {
      res.setHeader(REQUEST_ID_HEADER, requestId)

      const url = new URL(req.url ?? '/', 'http://localhost')
      const context: ExecutionContext = {
        req,
        res,
        method: req.method ?? 'GET',
        path: url.pathname,
      }

      try {
        for (const middleware of this.middlewares) {
          await middleware(context)
        }

        const match = this.router.find(context.method, url.pathname)

        if (!match) {
          throw new NotFoundException(`Cannot ${context.method} ${url.pathname}`)
        }

        for (const guard of this.guards) {
          if (!(await guard.canActivate(context))) {
            throw new ForbiddenException('Access denied')
          }
        }

        const result = await this.runInterceptors(context, async () => {
          const body = await this.readBody(req)
          const args = this.buildArguments(match, url, body)
          const instance = this.container.resolve(match.route.controller) as Record<
            string,
            (...params: unknown[]) => unknown
          >

          return instance[match.route.handlerName]!.apply(instance, args)
        })

        this.send(res, match.route.method === 'POST' ? 201 : 200, result)
      } catch (error) {
        const { status, body } = this.filter.catch(error)

        this.send(res, status, body)
      }
    })
  }

  private runInterceptors(
    context: ExecutionContext,
    handler: () => Promise<unknown>
  ): Promise<unknown> {
    return this.interceptors.reduceRight<() => Promise<unknown>>(
      (next, interceptor) => () => interceptor.intercept(context, next),
      handler
    )()
  }

  private buildArguments(
    match: RouteMatch,
    url: URL,
    body: unknown
  ): unknown[] {
    const { params, paramTypes } = match.route
    const size = Math.max(
      paramTypes.length,
      ...Object.keys(params).map((index) => Number(index) + 1),
      0
    )

    return Array.from({ length: size }, (_, index) => {
      const metadata = params[index]

      if (!metadata) {
        return undefined
      }

      return this.resolveArgument(metadata, paramTypes[index], match, url, body)
    })
  }

  private resolveArgument(
    metadata: ParamMetadata,
    paramType: unknown,
    match: RouteMatch,
    url: URL,
    body: unknown
  ): unknown {
    if (metadata.type === 'body') {
      return this.pipe.transform(body, paramType)
    }

    const raw =
      metadata.type === 'param'
        ? match.pathParams[metadata.name as string]
        : (url.searchParams.get(metadata.name as string) ?? undefined)

    return coerce(raw, paramType)
  }

  private async readBody(req: IncomingMessage): Promise<unknown> {
    if (req.method !== 'POST') {
      return undefined
    }

    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []

      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })

    if (raw.trim() === '') {
      return undefined
    }

    try {
      return JSON.parse(raw)
    } catch {
      throw new BadRequestException('Request body is not valid JSON')
    }
  }

  private send(res: ServerResponse, status: number, payload: unknown): void {
    const json = JSON.stringify(payload ?? null)

    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(json),
    })
    res.end(json)
  }
}

const readRequestId = (req: IncomingMessage): string => {
  const header = req.headers[REQUEST_ID_HEADER]
  const value = Array.isArray(header) ? header[0] : header

  return value !== undefined && value.trim() !== '' ? value : randomUUID()
}

const coerce = (raw: string | undefined, paramType: unknown): unknown => {
  if (raw === undefined) {
    return undefined
  }

  if (paramType === Number) {
    const value = Number(raw)

    if (Number.isNaN(value)) {
      throw new BadRequestException(`Expected a numeric value, received "${raw}"`)
    }

    return value
  }

  return raw
}
