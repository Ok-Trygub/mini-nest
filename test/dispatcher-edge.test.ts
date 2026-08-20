import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'

import { Controller } from '../src/decorators/controller'
import { Injectable } from '../src/decorators/injectable'
import { Get, Post } from '../src/decorators/methods'
import { Body, Param, Query } from '../src/decorators/params'
import { Dispatcher } from '../src/dispatcher'
import { Router } from '../src/router'

@Injectable()
@Controller('shop')
class ShopController {
  @Get(':category/items/:id')
  findItem(
    @Param('category') category?: string,
    @Param('id') id?: number
  ): { category?: string; id?: number } {
    return { category, id }
  }

  @Get('mixed/:id')
  mixed(
    @Param('id') id?: number,
    @Query('q') q?: string
  ): { id?: number; q?: string } {
    return { id, q }
  }

  @Post('echo')
  echo(@Body() body?: unknown): { body?: unknown } {
    return { body }
  }
}

describe('Dispatcher edge cases', () => {
  let server: Server
  let baseUrl: string

  before(async () => {
    server = new Dispatcher({ controllers: [ShopController] }).createServer()

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  })

  it('keeps the declared order of routes on one controller', () => {
    const paths = new Router()
      .register(ShopController)
      .list()
      .map((route) => route.path)

    assert.deepEqual(paths, [
      '/shop/:category/items/:id',
      '/shop/mixed/:id',
      '/shop/echo',
    ])
  })

  it('fills several path parameters from one path', async () => {
    const response = await fetch(`${baseUrl}/shop/books/items/7`)

    assert.deepEqual(await response.json(), { category: 'books', id: 7 })
  })

  it('decodes a percent-encoded path segment', async () => {
    const response = await fetch(`${baseUrl}/shop/a%20b/items/1`)

    assert.deepEqual(await response.json(), { category: 'a b', id: 1 })
  })

  it('mixes path and query sources in one signature', async () => {
    const response = await fetch(`${baseUrl}/shop/mixed/3?q=hi`)

    assert.deepEqual(await response.json(), { id: 3, q: 'hi' })
  })

  it('leaves every absent query argument undefined', async () => {
    const response = await fetch(`${baseUrl}/shop/mixed/3`)

    assert.deepEqual(await response.json(), { id: 3 })
  })

  it('passes the body through untouched when the argument has no DTO type', async () => {
    const response = await fetch(`${baseUrl}/shop/echo`, {
      method: 'POST',
      body: JSON.stringify({ raw: true }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), { body: { raw: true } })
  })

  it('treats an empty POST body as undefined instead of failing to parse', async () => {
    const response = await fetch(`${baseUrl}/shop/echo`, { method: 'POST' })

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), {})
  })
})
