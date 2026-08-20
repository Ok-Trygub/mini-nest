# mini-nest

A hand-written mini-Nest on top of `node:http`: an IoC container that reads constructor type metadata and assembles the dependency graph itself, decorator-based routing, and the full request lifecycle — middleware, guard, interceptor, pipe, handler, exception filter. No third-party HTTP framework. Two runtime dependencies, `reflect-metadata` and `zod`.

## Getting started

```sh
npm ci
npm test
```

```sh
npm start
```

```sh
docker compose run --rm api npm test
```

## Routes

| Method and path | What it does |
| --- | --- |
| `GET /health` | `{"status":"ok"}`, used by the Docker healthcheck |
| `GET /users?limit=n` | the list; `limit` reaches the handler as a number |
| `GET /users/:id` | one user by id, or `404` |
| `POST /users` | creates a user and answers `201`; an invalid body answers `400` with the failing fields |

Every route sits behind `AuthGuard`, so a request without `Authorization: Bearer <token>` answers `403`.

## Why AsyncLocalStorage and not a global variable

A global would be correct only while one request is in flight at a time. The moment a handler hits an `await`, the event loop is free to pick up the next request, and that request overwrites the global before the first one resumes. By the time the first request logs its id, the value belongs to somebody else. Nothing crashes, the ids simply swap places — the worst kind of bug, because the log lies and the tests pass.

`AsyncLocalStorage` gives every asynchronous chain its own store. `storage.run(store, callback)` wraps the whole request, and every `await` inside keeps the same store, however deep the call goes and however many requests interleave. `LoggerService.log()` sits two levels below the handler, takes no id parameter and never receives one — it reads `getRequestId()` off the store. The one rule that matters: `run()` has to wrap the entire request, or code that ran before it opened sees nothing.

## How a parameter decorator knows where to substitute a value

A parameter decorator pulls nothing out of the request — by the time it runs there is no request yet. All `@Param('id')` does is write down that argument 0 of `findOne` comes from the path parameter `id`, keyed by `parameterIndex`, the third argument TypeScript hands to `(target, propertyKey, parameterIndex)`:

```ts
params[parameterIndex] = { type, name }
Reflect.defineMetadata(PARAMS_KEY, params, target.constructor, propertyKey)
```

`target` is the class prototype, not the class, so the map lives on `target.constructor` and is split by `propertyKey` — without the split two methods of one controller would overwrite each other. The dispatcher then builds an argument array as long as the method signature: an index missing from the map gets `undefined`, an index present is filled from its source — path, `url.searchParams`, or the parsed body after the pipe.
