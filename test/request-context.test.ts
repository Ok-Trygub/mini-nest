import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { after, before, describe, it } from 'node:test'

import { Container } from '../src/container'
import { getRequestId } from '../src/context/request-context'
import { Controller } from '../src/decorators/controller'
import { Injectable } from '../src/decorators/injectable'
import { Get } from '../src/decorators/methods'
import { Param, Query } from '../src/decorators/params'
import { Dispatcher, REQUEST_ID_HEADER } from '../src/dispatcher'
import { LoggerService } from '../src/services/logger.service'
import { UsersController } from '../src/users/users.controller'
import { UsersService } from '../src/users/users.service'

@Injectable()
@Controller('slow')
class SlowController {
  @Get(':name')
  async read(
    @Param('name') _name?: string,
    @Query('delay') ms?: number
  ): Promise<{ requestId?: string }> {
    await delay(ms ?? 0)

    return { requestId: getRequestId() }
  }
}

const captured: string[] = []
const originalLog = console.log

describe('Request context', () => {
  let server: Server
  let baseUrl: string
  let container: Container

  before(async () => {
    console.log = (message: string) => void captured.push(message)

    container = new Container()

    server = new Dispatcher({
      controllers: [SlowController, UsersController],
      container,
    }).createServer()

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    console.log = originalLog

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  })

  it('should echo back the request id sent by the client', async () => {
    const response = await fetch(`${baseUrl}/slow/a`, {
      headers: { [REQUEST_ID_HEADER]: 'client-supplied' },
    })

    assert.equal(response.headers.get(REQUEST_ID_HEADER), 'client-supplied')
    assert.equal((await response.json()).requestId, 'client-supplied')
  })

  it('should generate a request id when the client sent none', async () => {
    const response = await fetch(`${baseUrl}/slow/a`)
    const header = response.headers.get(REQUEST_ID_HEADER)

    assert.ok(header)
    assert.equal((await response.json()).requestId, header)
  })

  it('should reach a service two levels below the handler without passing the id', async () => {
    captured.length = 0

    const response = await fetch(`${baseUrl}/users/1`, {
      headers: { [REQUEST_ID_HEADER]: 'deep-call' },
    })

    assert.equal(response.status, 404)
    assert.ok(
      captured.includes('[deep-call] looking up user 1'),
      `logger never saw the request id, captured: ${JSON.stringify(captured)}`
    )
  })

  it('should keep the singleton service free of any request id parameter', () => {
    const service = container.resolve(UsersService)
    const logger = container.resolve(LoggerService)

    assert.equal(service.findOne.length, 1)
    assert.equal(logger.log.length, 1)
  })

  it('should not leak a request id between ten concurrent requests', async () => {
    const ids = Array.from({ length: 10 }, (_, index) => `parallel-${index}`)

    const responses = await Promise.all(
      ids.map((id, index) =>
        fetch(`${baseUrl}/slow/${id}?delay=${(10 - index) * 3}`, {
          headers: { [REQUEST_ID_HEADER]: id },
        })
      )
    )

    const seen = await Promise.all(
      responses.map(async (response) => ({
        header: response.headers.get(REQUEST_ID_HEADER),
        body: (await response.json()).requestId as string,
      }))
    )

    assert.deepEqual(
      seen.map((item) => item.header),
      ids
    )
    assert.deepEqual(
      seen.map((item) => item.body),
      ids
    )
  })
})
