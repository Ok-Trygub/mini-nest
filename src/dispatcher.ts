import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { Container } from './container'
import type { ParamMetadata } from './decorators/params'
import { BadRequestException, HttpException, NotFoundException } from './errors'
import { ValidationPipe } from './pipes/validation.pipe'
import { Router, type RouteMatch } from './router'
import type { Constructor } from './types'

export interface DispatcherOptions {
  controllers: Constructor[]
  container?: Container
}

export class Dispatcher {
  readonly container: Container
  readonly router = new Router()

  private readonly validationPipe = new ValidationPipe()

  constructor(options: DispatcherOptions) {
    this.container = options.container ?? new Container()

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
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const match = this.router.find(req.method ?? 'GET', url.pathname)

      if (!match) {
        throw new NotFoundException(`Cannot ${req.method} ${url.pathname}`)
      }

      const body = await this.readBody(req)
      const args = this.buildArguments(match, url, body)
      const instance = this.container.resolve(match.route.controller) as Record<
        string,
        (...params: unknown[]) => unknown
      >
      const result = await instance[match.route.handlerName]!.apply(instance, args)

      this.send(res, match.route.method === 'POST' ? 201 : 200, result)
    } catch (error) {
      this.sendError(res, error)
    }
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
      return this.validationPipe.transform(body, paramType)
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

  private sendError(res: ServerResponse, error: unknown): void {
    if (error instanceof HttpException) {
      this.send(res, error.status, error.toBody())

      return
    }

    const message = error instanceof Error ? error.message : 'Internal server error'

    this.send(res, 500, { statusCode: 500, message })
  }
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
