import { PARAMS_KEY } from '../tokens'

export type ParamType = 'body' | 'param' | 'query'

export interface ParamMetadata {
  type: ParamType
  name?: string
}

export type ParamMap = Record<number, ParamMetadata>

const createParamDecorator = (
  type: ParamType,
  name?: string
): ParameterDecorator => {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      throw new Error(
        `@${type} is a method-parameter decorator, it cannot be used on a constructor`
      )
    }

    const owner = (target as object).constructor
    const params = getParamsMetadata(owner, propertyKey)

    params[parameterIndex] = { type, name }

    Reflect.defineMetadata(PARAMS_KEY, params, owner, propertyKey)
  }
}

export const getParamsMetadata = (
  target: object,
  propertyKey: string | symbol
): ParamMap => {
  return { ...((Reflect.getOwnMetadata(PARAMS_KEY, target, propertyKey) ??
    {}) as ParamMap) }
}

export const Body = (): ParameterDecorator => createParamDecorator('body')

export const Param = (name: string): ParameterDecorator =>
  createParamDecorator('param', name)

export const Query = (name: string): ParameterDecorator =>
  createParamDecorator('query', name)
