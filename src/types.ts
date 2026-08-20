export type Constructor<T = unknown> = new (...args: any[]) => T

export type Instantiable<T = unknown> = new () => T
