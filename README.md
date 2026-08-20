# mini-nest

A hand-written mini-Nest: an IoC container that reads constructor type metadata and assembles the dependency graph itself, decorator-based routing, and the full request lifecycle — middleware, guard, interceptor, pipe, handler, exception filter — on top of `node:http`.

No third-party HTTP framework: the routing is our own, straight on `node:http`. Two runtime dependencies, `reflect-metadata` and `zod`. Tests run on the built-in Node runner.

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

A global would be correct only while one request is in flight at a time. The moment a handler hits an `await`, the event loop is free to pick up the next request, and that request overwrites the global before the first one resumes. By the time the first request logs its id, the value in the global belongs to somebody else. Nothing crashes, the ids simply swap places, which is the worst kind of bug: the log lies and the tests pass.

`AsyncLocalStorage` gives every asynchronous chain its own store. `storage.run(store, callback)` wraps the whole request handling, and every `await` inside that callback keeps the same store, no matter how deep the call goes or how many other requests interleave. `LoggerService.log()` sits two levels below the handler, takes no id parameter and never receives one — it reads `getRequestId()` off the store. `test/request-context.test.ts` fires ten concurrent requests with ten different ids and checks that not one of them leaks into another response.

The one rule that matters: `run()` has to wrap the entire request, not a part of it. If the store is opened after the body is read, code that ran earlier sees nothing.

## How a parameter decorator knows where to substitute a value

A parameter decorator pulls nothing out of the request. By the time it runs there is no request yet — decorators fire once, while the controller module is being loaded. All `@Param('id')` does is write down that argument 0 of `findOne` has to come from the path parameter `id`. The key is `parameterIndex`, the third argument TypeScript hands to `(target, propertyKey, parameterIndex)`:

```ts
params[parameterIndex] = { type, name }
Reflect.defineMetadata(PARAMS_KEY, params, target.constructor, propertyKey)
```

`target` here is the class prototype, not the class itself, so the map lives on `target.constructor` and is split by `propertyKey` on top of that. Without the split two methods of the same controller would write into one shared map and overwrite each other. What comes out is `{ 0: { type: 'param', name: 'id' } }` for `findOne`, and the router picks it up together with the routes.

The dispatcher then builds an argument array as long as the method signature. An index missing from the map gets `undefined`; an index present in it is filled from its source — `param` from the parsed path, `query` from `url.searchParams`, `body` from the parsed JSON body after the validation pipe. Then `handler.apply(instance, args)`. Decorators execute parameters first, then the method, then the class; the code does not rely on that, but `test/router.test.ts` pins the order down anyway.

## API

### Container

- `@Injectable({ scope })` — marks a class as constructible by the container. `scope` is `singleton` by default, one instance per container, or `transient`, a new one on every `resolve`.
- `@Inject(token)` — a parameter decorator for dependencies that no class can stand for, such as interfaces and config objects. The token is a `Symbol` or a string.
- `container.register(token, value)` — registers a value under a token.
- `container.resolve(Class)` — builds an instance along with its whole dependency graph. A cycle `A -> B -> A` throws `CircularDependencyError` carrying the full chain.

### HTTP

- `@Controller(prefix)` — the base path of a controller.
- `@Get(path)`, `@Post(path)` — register a route. The full path is the prefix plus the method path.
- `@Body()`, `@Param(name)`, `@Query(name)` — the source of an argument.
- `new Dispatcher({ controllers, container })` — collects the router from metadata and creates an `http.Server` through `createServer()`.
- `@Param` and `@Query` values are coerced to the type declared in the signature. A parameter typed `number` arrives as a number, a non-numeric value answers `400`.
- On success: `201` for `POST`, `200` for `GET`. The result is serialised to JSON.
- `HttpException`, `NotFoundException`, `BadRequestException` and `ValidationException` map to their own status and JSON body. Anything else answers `500`.

### Lifecycle

- `new Dispatcher({ controllers, container, middlewares, guards, interceptors })` — every stage is an array, so a test can drop a recording stage into any of them.
- `Middleware` — `(context) => void | Promise<void>`, runs first, cannot change the response.
- `Guard` — `canActivate(context) => boolean | Promise<boolean>`; `false` answers `403` and the handler never runs. A guard decides whether to let the request in and nothing else.
- `Interceptor` — `intercept(context, next)`; it wraps the call, so it sees both the input and the output, and it can change the result. `LoggingInterceptor` measures the handler and logs `GET /users/1 — 12.3 ms`.
- `ExceptionFilter` — `catch(error) => { status, body }`, the last link in the chain.
- `runWithRequestContext(store, callback)` and `getRequestId()` — the `AsyncLocalStorage` wrapper.

### Validation

The DTO carries its schema as a static property, so `@Body()` keeps working off `design:paramtypes`: the pipe looks the argument type up, finds `CreateUserDto.schema` and runs `safeParse` on the raw body. Zod 4 reports through `error.issues`, which the pipe groups per field into `[{ field, constraints }]` — every field that failed, not just the first one. A type without a schema passes through untouched.
