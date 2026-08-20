export const normalizePath = (path: string): string => {
  const trimmed = path.trim().replace(/^\/+|\/+$/g, '')

  return trimmed === '' ? '' : `/${trimmed}`
}

export const joinPaths = (prefix: string, path: string): string => {
  const joined = `${normalizePath(prefix)}${normalizePath(path)}`

  return joined === '' ? '/' : joined
}
