import { INJECT_TOKENS_KEY } from '../tokens'

export type InjectionToken = string | symbol

export const Inject = (token: InjectionToken): ParameterDecorator => {
  return (target, _propertyKey, parameterIndex) => {
    const tokens: Record<number, InjectionToken> =
      Reflect.getOwnMetadata(INJECT_TOKENS_KEY, target) ?? {}

    tokens[parameterIndex] = token

    Reflect.defineMetadata(INJECT_TOKENS_KEY, tokens, target)
  }
}
