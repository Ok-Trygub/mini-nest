import 'reflect-metadata'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Controller } from '../src/decorators/controller'
import { Injectable } from '../src/decorators/injectable'
import { Get, Post } from '../src/decorators/methods'
import { Body, Param, Query, getParamsMetadata } from '../src/decorators/params'
import { Router } from '../src/router'

@Injectable()
@Controller('users')
class UsersRoutes {
  @Get()
  findAll(@Query('limit') _limit?: number): void {}

  @Get(':id')
  findOne(@Param('id') _id?: string): void {}

  @Post()
  create(@Body() _dto?: object): void {}
}

describe('Router', () => {
  it('builds a full path from the controller prefix and the method path', () => {
    const router = new Router().register(UsersRoutes)
    const paths = router.list().map((route) => `${route.method} ${route.path}`)

    assert.deepEqual(paths, [
      'GET /users',
      'GET /users/:id',
      'POST /users',
    ])
  })

  it('finds a route and extracts path parameters', () => {
    const router = new Router().register(UsersRoutes)
    const match = router.find('GET', '/users/42')

    assert.ok(match)
    assert.equal(match.route.handlerName, 'findOne')
    assert.deepEqual(match.pathParams, { id: '42' })
  })

  it('does not match a different method or an unknown path', () => {
    const router = new Router().register(UsersRoutes)

    assert.equal(router.find('POST', '/users/42'), undefined)
    assert.equal(router.find('GET', '/users/42/orders'), undefined)
    assert.equal(router.find('GET', '/accounts'), undefined)
  })

  it('reads routes from metadata, not from a hardcoded list', () => {
    const routes = Reflect.getOwnMetadata(
      Symbol.for('nothing'),
      UsersRoutes
    ) as unknown

    assert.equal(routes, undefined)
    assert.equal(new Router().register(UsersRoutes).list().length, 3)
  })

  it('stores the parameter source per argument index', () => {
    assert.deepEqual(getParamsMetadata(UsersRoutes, 'findOne'), {
      0: { type: 'param', name: 'id' },
    })
    assert.deepEqual(getParamsMetadata(UsersRoutes, 'findAll'), {
      0: { type: 'query', name: 'limit' },
    })
    assert.deepEqual(getParamsMetadata(UsersRoutes, 'create'), {
      0: { type: 'body', name: undefined },
    })
  })

  it('runs parameter decorators before the method decorator', () => {
    const order: string[] = []

    const TrackParam = (): ParameterDecorator => () => {
      order.push('param')
    }
    const TrackMethod = (): MethodDecorator => () => {
      order.push('method')
    }
    const TrackClass = (): ClassDecorator => () => {
      order.push('class')
    }

    @TrackClass()
    class Tracked {
      @TrackMethod()
      handle(@TrackParam() _value?: string): void {}
    }

    assert.ok(Tracked)
    assert.deepEqual(order, ['param', 'method', 'class'])
  })

  it('refuses to register a class without @Controller', () => {
    class Plain {}

    assert.throws(() => new Router().register(Plain), /not marked with @Controller/)
  })
})
