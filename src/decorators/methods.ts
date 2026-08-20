import { normalizePath } from '../path'
import { ROUTES_KEY } from '../tokens'

export type HttpMethod = 'GET' | 'POST'

export interface RouteMetadata {
  method: HttpMethod
  path: string
  handlerName: string
}

const createMethodDecorator = (method: HttpMethod) => {
  return (path = ''): MethodDecorator => {
    return (target, propertyKey) => {
      const owner = (target as object).constructor
      const routes = getRoutesMetadata(owner)

      routes.push({
        method,
        path: normalizePath(path),
        handlerName: String(propertyKey),
      })

      Reflect.defineMetadata(ROUTES_KEY, routes, owner)
    }
  }
}

export const getRoutesMetadata = (target: object): RouteMetadata[] => {
  return (Reflect.getOwnMetadata(ROUTES_KEY, target) ?? []) as RouteMetadata[]
}

export const Get = createMethodDecorator('GET')
export const Post = createMethodDecorator('POST')
