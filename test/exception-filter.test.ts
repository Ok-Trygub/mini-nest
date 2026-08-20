import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'

import { Controller } from '../src/decorators/controller'
import { Injectable } from '../src/decorators/injectable'
import { Get } from '../src/decorators/methods'
import { Dispatcher } from '../src/dispatcher'
import { NotFoundException } from '../src/errors'
import type { Interceptor } from '../src/types'

@Injectable()
@Controller('broken')
class BrokenController {
  @Get('unexpected')
  unexpected(): never {
    throw new Error('boom')
  }

  @Get('missing')
  missing(): never {
    throw new NotFoundException('Widget 7 not found')
  }

  @Get('from-interceptor')
  fine(): { ok: true } {
    return { ok: true }
  }
}

const throwingInterceptor: Interceptor = {
  intercept: async (context, next) => {
    if (context.path.endsWith('/from-interceptor')) {
      throw new Error('boom')
    }

    return next()
  },
}

describe('ExceptionFilter', () => {
  let server: Server
  let baseUrl: string

  before(async () => {
    server = new Dispatcher({
      controllers: [BrokenController],
      interceptors: [throwingInterceptor],
    }).createServer()

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  })

  it('should answer 500 without leaking the message or the stack trace', async () => {
    const response = await fetch(`${baseUrl}/broken/unexpected`)
    const text = await response.text()

    assert.equal(response.status, 500)
    assert.doesNotMatch(text, /boom|at .*\.ts:/)
    assert.deepEqual(JSON.parse(text), {
      statusCode: 500,
      message: 'Internal server error',
    })
  })

  it('should map a domain NotFoundException to 404 with its message', async () => {
    const response = await fetch(`${baseUrl}/broken/missing`)

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      statusCode: 404,
      message: 'Widget 7 not found',
    })
  })

  it('should catch what an interceptor throws', async () => {
    const response = await fetch(`${baseUrl}/broken/from-interceptor`)
    const text = await response.text()

    assert.equal(response.status, 500)
    assert.doesNotMatch(text, /boom|at .*\.ts:/)
  })

  it('should answer 404 for an unknown route', async () => {
    const response = await fetch(`${baseUrl}/nothing-here`)

    assert.equal(response.status, 404)
    assert.equal((await response.json()).message, 'Cannot GET /nothing-here')
  })
})
