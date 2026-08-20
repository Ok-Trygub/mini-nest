# mini-nest

A hand-written mini-Nest: an IoC container that reads constructor type metadata and assembles the dependency graph itself, plus decorator-based routing and request validation on top of `node:http`.

- Part 1 of 3 — lecture 6, the IoC container.
- Part 2 of 3 — lecture 7, the HTTP layer.

No third-party HTTP framework: the routing is our own, straight on `node:http`. Exactly one runtime dependency, `reflect-metadata`. Tests run on the built-in Node runner.

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

## How a parameter decorator knows where to substitute a value

A parameter decorator pulls nothing out of the request. By the time it runs there is no request yet — decorators fire once, while the controller module is being loaded. All `@Param('id')` does is write down in metadata that argument 0 of `findOne` has to come from the path parameter `id`.

The key is `parameterIndex`, the third argument TypeScript hands to `(target, propertyKey, parameterIndex)`. The decorator takes the map already accumulated in the class metadata under the method key, adds its own index to it and puts it back:

```ts
params[parameterIndex] = { type, name }
Reflect.defineMetadata(PARAMS_KEY, params, target.constructor, propertyKey)
```

One detail matters here. For a parameter decorator on a method `target` is the class prototype, not the class itself, so the map lives on `target.constructor` and is split by `propertyKey` on top of that. Without the split two methods of the same controller would write into one shared map and overwrite each other.

What comes out is `{ 0: { type: 'param', name: 'id' } }` for `findOne` and `{ 0: { type: 'query', name: 'limit' } }` for `findAll`. The router reads that map together with the routes when it registers the controller.

The dispatcher takes it from there. It matches the route, then builds an argument array as long as the method signature. An index missing from the map gets `undefined`; an index present in it is filled from its source — `param` from the parsed path, `query` from `url.searchParams`, `body` from the parsed JSON body after the validation pipe. Then `handler.apply(instance, args)`.

Decorators execute parameters first, then the method, then the class. The code does not rely on that order, since the maps accumulate independently and the router collects everything after the module has loaded, but `test/router.test.ts` pins the order down anyway.

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

### Validation

`IsString`, `IsEmail`, `IsInt`, `Min`, `IsOptional`. A field without `@IsOptional()` is required. Errors come back as `[{ field, constraints }]` for every field that failed, not just the first one.
