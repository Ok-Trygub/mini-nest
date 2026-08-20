import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestStore {
  requestId: string
}

const storage = new AsyncLocalStorage<RequestStore>()

export const runWithRequestContext = <T>(
  store: RequestStore,
  callback: () => T
): T => storage.run(store, callback)

export const getRequestId = (): string | undefined =>
  storage.getStore()?.requestId
