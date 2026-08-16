import type { InjectionToken } from './decorators/inject'
import type { InjectableMetadata } from './decorators/injectable'
import { INJECT_TOKENS_KEY, INJECTABLE_KEY } from './tokens'

type Constructor<T = unknown> = new (...args: any[]) => T

export class CircularDependencyError extends Error {
  constructor(chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' -> ')}`)
    this.name = 'CircularDependencyError'
  }
}

export class Container {
  private readonly singletons = new Map<Constructor, unknown>()
  private readonly tokenValues = new Map<InjectionToken, unknown>()

  register(token: InjectionToken, value: unknown): void {
    this.tokenValues.set(token, value)
  }

  resolve<T>(target: Constructor<T>): T {
    return this.resolveClass(target, [])
  }

  private resolveClass<T>(target: Constructor<T>, path: Constructor[]): T {
    const metadata = Reflect.getMetadata(INJECTABLE_KEY, target) as
      | InjectableMetadata
      | undefined

    if (!metadata) {
      throw new Error(
        `Class ${target.name} is not marked with @Injectable(), the container cannot construct it`
      )
    }

    if (metadata.scope === 'singleton' && this.singletons.has(target)) {
      return this.singletons.get(target) as T
    }

    if (path.includes(target)) {
      const chain = [...path, target].map((item) => item.name)

      throw new CircularDependencyError(chain)
    }

    const paramTypes = (Reflect.getMetadata('design:paramtypes', target) ??
      []) as Constructor[]
    const injectTokens = (Reflect.getOwnMetadata(INJECT_TOKENS_KEY, target) ??
      {}) as Record<number, InjectionToken>

    const dependencies = paramTypes.map((paramType, index) => {
      const token = injectTokens[index]

      if (token !== undefined) {
        return this.resolveToken(token, target, index)
      }

      if (paramType === (Object as unknown as Constructor)) {
        throw new Error(
          `Cannot resolve parameter #${index} of ${target.name}: ` +
            `its type is erased to Object at runtime (interface or primitive), use @Inject(token)`
        )
      }

      return this.resolveClass(paramType, [...path, target])
    })

    const instance = new target(...dependencies)

    if (metadata.scope === 'singleton') {
      this.singletons.set(target, instance)
    }

    return instance
  }

  private resolveToken(
    token: InjectionToken,
    owner: Constructor,
    index: number
  ): unknown {
    if (!this.tokenValues.has(token)) {
      throw new Error(
        `No value registered for token ${String(token)} (parameter #${index} of ${owner.name})`
      )
    }

    return this.tokenValues.get(token)
  }
}
