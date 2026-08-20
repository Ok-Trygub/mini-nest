import { getControllerMetadata } from './decorators/controller'
import type { HttpMethod } from './decorators/methods'
import { getRoutesMetadata } from './decorators/methods'
import type { ParamMap } from './decorators/params'
import { getParamsMetadata } from './decorators/params'
import { joinPaths } from './path'
import type { Constructor } from './types'

export interface Route {
  method: HttpMethod
  path: string
  segments: string[]
  controller: Constructor
  handlerName: string
  params: ParamMap
  paramTypes: unknown[]
}

export interface RouteMatch {
  route: Route
  pathParams: Record<string, string>
}

const toSegments = (path: string): string[] =>
  path.split('/').filter((segment) => segment !== '')

const isPlaceholder = (segment: string): boolean => segment.startsWith(':')

export class Router {
  private readonly routes: Route[] = []

  register(controller: Constructor): this {
    const metadata = getControllerMetadata(controller)

    if (!metadata) {
      throw new Error(
        `Class ${controller.name} is not marked with @Controller(), it cannot be registered as a route source`
      )
    }

    for (const route of getRoutesMetadata(controller)) {
      const path = joinPaths(metadata.prefix, route.path)

      this.routes.push({
        method: route.method,
        path,
        segments: toSegments(path),
        controller,
        handlerName: route.handlerName,
        params: getParamsMetadata(controller, route.handlerName),
        paramTypes: (Reflect.getMetadata(
          'design:paramtypes',
          controller.prototype,
          route.handlerName
        ) ?? []) as unknown[],
      })
    }

    return this
  }

  list(): readonly Route[] {
    return this.routes
  }

  find(method: string, pathname: string): RouteMatch | undefined {
    const requestSegments = toSegments(pathname)

    for (const route of this.routes) {
      if (route.method !== method) {
        continue
      }

      const pathParams = matchSegments(route.segments, requestSegments)

      if (pathParams) {
        return { route, pathParams }
      }
    }

    return undefined
  }
}

const matchSegments = (
  routeSegments: string[],
  requestSegments: string[]
): Record<string, string> | undefined => {
  if (routeSegments.length !== requestSegments.length) {
    return undefined
  }

  const pathParams: Record<string, string> = {}

  for (const [index, segment] of routeSegments.entries()) {
    const value = requestSegments[index] as string

    if (isPlaceholder(segment)) {
      pathParams[segment.slice(1)] = decodeURIComponent(value)

      continue
    }

    if (segment !== value) {
      return undefined
    }
  }

  return pathParams
}
