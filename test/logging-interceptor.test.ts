import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'

import { Controller } from '../src/decorators/controller'
import { Injectable } from '../src/decorators/injectable'
import { Get } from '../src/decorators/methods'
import { Dispatcher, REQUEST_ID_HEADER } from '../src/dispatcher'
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor'
import { LoggerService } from '../src/services/logger.service'

@Injectable()
@Controller('timed')
class TimedController {
  @Get()
  read(): { ok: true } {
    return { ok: true }
  }

  @Get('boom')
  fail(): never {
    throw new Error('boom')
  }
}

const captured: string[] = []
const originalLog = console.log

describe('LoggingInterceptor', () => {
  let server: Server
  let baseUrl: string

  before(async () => {
    console.log = (message: string) => void captured.push(message)

    server = new Dispatcher({
      controllers: [TimedController],
      interceptors: [new LoggingInterceptor(new LoggerService())],
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

  it('should log the route with the measured duration in milliseconds', async () => {
    captured.length = 0

    const response = await fetch(`${baseUrl}/timed`)
    const line = captured.at(-1) ?? ''

    assert.equal(response.status, 200)
    assert.match(line, /GET \/timed/)
    assert.match(line, /[0-9]+(\.[0-9]+)? ?ms/)
  })

  it('should prefix the log line with the request id of the same request', async () => {
    captured.length = 0

    const response = await fetch(`${baseUrl}/timed`, {
      headers: { [REQUEST_ID_HEADER]: 'req-logging' },
    })

    assert.equal(response.headers.get(REQUEST_ID_HEADER), 'req-logging')
    assert.match(captured.at(-1) ?? '', /^\[req-logging\] GET \/timed/)
  })

  it('should still log the duration when the handler throws', async () => {
    captured.length = 0

    const response = await fetch(`${baseUrl}/timed/boom`)

    assert.equal(response.status, 500)
    assert.match(captured.at(-1) ?? '', /GET \/timed\/boom .*[0-9]+(\.[0-9]+)? ?ms/)
  })
})
