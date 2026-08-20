import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'

import { Controller } from '../src/decorators/controller'
import { Injectable } from '../src/decorators/injectable'
import { Get } from '../src/decorators/methods'
import { Dispatcher } from '../src/dispatcher'
import { AuthGuard } from '../src/guards/auth.guard'

let handlerCalls = 0

@Injectable()
@Controller('secret')
class SecretController {
  @Get()
  read(): { ok: true } {
    handlerCalls += 1

    return { ok: true }
  }
}

describe('AuthGuard', () => {
  let server: Server
  let baseUrl: string

  before(async () => {
    server = new Dispatcher({
      controllers: [SecretController],
      guards: [new AuthGuard()],
    }).createServer()

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  })

  it('should answer 403 without reaching the handler when Authorization is missing', async () => {
    handlerCalls = 0

    const response = await fetch(`${baseUrl}/secret`)

    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), {
      statusCode: 403,
      message: 'Access denied',
    })
    assert.equal(handlerCalls, 0)
  })

  it('should answer 403 for an Authorization header of the wrong scheme', async () => {
    handlerCalls = 0

    const response = await fetch(`${baseUrl}/secret`, {
      headers: { authorization: 'Basic abc' },
    })

    assert.equal(response.status, 403)
    assert.equal(handlerCalls, 0)
  })

  it('should reach the handler with a bearer token', async () => {
    handlerCalls = 0

    const response = await fetch(`${baseUrl}/secret`, {
      headers: { authorization: 'Bearer token' },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(handlerCalls, 1)
  })
})
