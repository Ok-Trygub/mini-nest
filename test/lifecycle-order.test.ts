import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { z } from 'zod'

import { Controller } from '../src/decorators/controller'
import { Injectable } from '../src/decorators/injectable'
import { Post } from '../src/decorators/methods'
import { Body } from '../src/decorators/params'
import { Dispatcher } from '../src/dispatcher'
import type { ExecutionContext, Guard, Interceptor } from '../src/types'

const calls: string[] = []

class OrderDto {
  static readonly schema = z.object({}).transform((value) => {
    calls.push('pipe')

    return value
  })
}

@Injectable()
@Controller('order')
class OrderController {
  @Post()
  create(@Body() _dto: OrderDto): { ok: true } {
    calls.push('handler')

    return { ok: true }
  }
}

const recordingGuard: Guard = {
  canActivate: () => {
    calls.push('guard')

    return true
  },
}

const recordingInterceptor: Interceptor = {
  intercept: async (_context: ExecutionContext, next) => {
    calls.push('interceptor:before')

    const result = await next()

    calls.push('interceptor:after')

    return result
  },
}

describe('Lifecycle order', () => {
  let server: Server
  let baseUrl: string

  before(async () => {
    server = new Dispatcher({
      controllers: [OrderController],
      middlewares: [() => void calls.push('middleware')],
      guards: [recordingGuard],
      interceptors: [recordingInterceptor],
    }).createServer()

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  })

  it('should run the stages in the documented order', async () => {
    calls.length = 0

    const response = await fetch(`${baseUrl}/order`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(calls, [
      'middleware',
      'guard',
      'interceptor:before',
      'pipe',
      'handler',
      'interceptor:after',
    ])
  })
})
