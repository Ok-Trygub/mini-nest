import 'reflect-metadata'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CircularDependencyError, Container } from '../src/container'
import { Inject } from '../src/decorators/inject'
import { Injectable } from '../src/decorators/injectable'
import { CONFIG } from '../src/tokens'

describe('Container', () => {
  it('resolves a simple graph recursively (A -> B -> C)', () => {
    @Injectable()
    class C {
      readonly value = 'from-C'
    }

    @Injectable()
    class B {
      constructor(public readonly c: C) {}
    }

    @Injectable()
    class A {
      constructor(public readonly b: B) {}
    }

    const container = new Container()
    const a = container.resolve(A)

    assert.ok(a instanceof A)
    assert.ok(a.b instanceof B)
    assert.ok(a.b.c instanceof C)
    assert.equal(a.b.c.value, 'from-C')
  })

  it('returns the same instance for singleton scope (default)', () => {
    @Injectable()
    class Service {}

    const container = new Container()

    assert.equal(container.resolve(Service), container.resolve(Service))
  })

  it('returns a new instance on every resolve for transient scope', () => {
    @Injectable({ scope: 'transient' })
    class Service {}

    const container = new Container()

    assert.notEqual(container.resolve(Service), container.resolve(Service))
  })

  it('resolves a dependency by explicit token via @Inject', () => {
    interface AppConfig {
      url: string
    }

    @Injectable()
    class NeedsConfig {
      constructor(@Inject(CONFIG) public readonly config: AppConfig) {}
    }

    const container = new Container()
    const configValue: AppConfig = { url: 'http://localhost' }
    container.register(CONFIG, configValue)

    const instance = container.resolve(NeedsConfig)

    assert.equal(instance.config, configValue)
  })

  it('throws a descriptive error (not RangeError) for a circular graph A -> B -> A', () => {
    @Injectable()
    class A {}

    @Injectable()
    class B {}

    Reflect.defineMetadata('design:paramtypes', [B], A)
    Reflect.defineMetadata('design:paramtypes', [A], B)

    const container = new Container()

    assert.throws(
      () => container.resolve(A),
      (error: unknown) => {
        assert.ok(error instanceof CircularDependencyError)
        assert.ok(!(error instanceof RangeError))
        assert.match((error as Error).message, /A -> B -> A/)

        return true
      }
    )
  })
})
