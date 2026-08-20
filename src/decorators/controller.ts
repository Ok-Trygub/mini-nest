import { normalizePath } from '../path'
import { CONTROLLER_KEY } from '../tokens'

export interface ControllerMetadata {
  prefix: string
}

export const Controller = (prefix = ''): ClassDecorator => {
  return (target) => {
    const metadata: ControllerMetadata = { prefix: normalizePath(prefix) }

    Reflect.defineMetadata(CONTROLLER_KEY, metadata, target)
  }
}

export const getControllerMetadata = (
  target: object
): ControllerMetadata | undefined => {
  return Reflect.getOwnMetadata(CONTROLLER_KEY, target) as
    | ControllerMetadata
    | undefined
}
