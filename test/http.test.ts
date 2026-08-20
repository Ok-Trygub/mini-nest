import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { after, before, describe, it } from 'node:test'

import { Container } from '../src/container'
import { Dispatcher } from '../src/dispatcher'
import { CreateUserDto } from '../src/dto/create-user.dto'
import { HealthController } from '../src/health/health.controller'
import { UsersController } from '../src/users/users.controller'
import { UsersService } from '../src/users/users.service'

const received: { body?: unknown } = {}
const originalCreate = UsersService.prototype.create

describe('HTTP dispatcher', () => {
  let server: Server
  let baseUrl: string
  let dispatcher: Dispatcher

  before(async () => {
    UsersService.prototype.create = function patched(dto: CreateUserDto) {
      received.body = dto

      return originalCreate.call(this, dto)
    }

    dispatcher = new Dispatcher({
      controllers: [HealthController, UsersController],
      container: new Container(),
    })
    server = dispatcher.createServer()

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    UsersService.prototype.create = originalCreate

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  })

  it('answers on a path built from the controller prefix and the method path', async () => {
    const response = await fetch(`${baseUrl}/health`)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })
  })

  it('returns 404 with a JSON body for an unknown route', async () => {
    const response = await fetch(`${baseUrl}/nothing-here`)

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      statusCode: 404,
      message: 'Cannot GET /nothing-here',
    })
  })

  it('rejects an invalid body with 400 and names the failing field', async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'not-an-email' }),
    })
    const text = await response.text()

    assert.equal(response.status, 400)
    assert.match(text, /email/)
    assert.deepEqual(JSON.parse(text), {
      statusCode: 400,
      message: 'Validation failed',
      errors: [{ field: 'email', constraints: ['Invalid email address'] }],
    })
  })

  it('passes a valid body to the handler already parsed by the schema', async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', age: 36 }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), {
      id: 1,
      name: 'Ada',
      email: 'ada@example.com',
      age: 36,
    })
    assert.deepEqual(received.body, {
      name: 'Ada',
      email: 'ada@example.com',
      age: 36,
    })
  })

  it('substitutes @Param into the handler argument', async () => {
    const response = await fetch(`${baseUrl}/users/1`)
    const text = await response.text()

    assert.equal(response.status, 200)
    assert.match(text, /"id":1/)
    assert.equal(JSON.parse(text).email, 'ada@example.com')
  })

  it('substitutes @Query into the handler argument, coerced to the declared type', async () => {
    const response = await fetch(`${baseUrl}/users?limit=5`)
    const payload = (await response.json()) as { limit: number; items: unknown[] }

    assert.equal(response.status, 200)
    assert.equal(payload.limit, 5)
    assert.equal(payload.items.length, 1)
  })

  it('leaves an absent @Query as undefined', async () => {
    const payload = (await (await fetch(`${baseUrl}/users`)).json()) as {
      limit?: number
    }

    assert.equal(payload.limit, undefined)
  })

  it('answers 400 when the body is not valid JSON', async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ broken',
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      statusCode: 400,
      message: 'Request body is not valid JSON',
    })
  })

  it('maps a domain NotFoundException to 404 and echoes the path parameter', async () => {
    const response = await fetch(`${baseUrl}/users/42`)
    const text = await response.text()

    assert.equal(response.status, 404)
    assert.match(text, /42/)
    assert.equal(JSON.parse(text).message, 'User 42 not found')
  })

  it('builds the controller through the container and shares one service singleton', async () => {
    const service = dispatcher.container.resolve(UsersService)
    const controller = dispatcher.container.resolve(UsersController)

    assert.equal(dispatcher.container.resolve(UsersController), controller)
    assert.equal(
      (controller as unknown as { usersService: UsersService }).usersService,
      service
    )
    assert.equal(service.findAll().length, 1)
    assert.equal(service.findOne(1).email, 'ada@example.com')
  })
})
