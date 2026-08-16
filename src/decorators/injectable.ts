import { INJECTABLE_KEY } from '../tokens'

export type Scope = 'singleton' | 'transient'

export interface InjectableOptions {
  scope?: Scope
}

export interface InjectableMetadata {
  scope: Scope
}

export const Injectable = (options: InjectableOptions = {}): ClassDecorator => {
  return (target) => {
    const metadata: InjectableMetadata = { scope: options.scope ?? 'singleton' }

    Reflect.defineMetadata(INJECTABLE_KEY, metadata, target)
  }
}
