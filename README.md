# nimpl-cache

Repository for implementing caching solutions in next.js.

Visit [https://nimpl.dev](https://nimpl.dev/docs/cache-adapter) to view the full documentation.

## Advantages

- Shared cache between different instances (replicas, copies) of the application;
- Three caching options: local, remote and isomorphic;
- Same cacheHandler on the client and on the created server;
- Caching without server restart;
- Clearing of outdated cache.

[Read more about @nimpl/cache-adapter](https://github.com/alexdln/nimpl-cache/tree/main/packages/cache-adapter).

## Cache handlers

@nimpl/cache-in-memory — base cacheHandler, which cache data in-memory. [Read more](https://github.com/alexdln/nimpl-cache/tree/main/packages/cache-in-memory)

## License

[MIT](https://github.com/alexdln/nimpl-cache/blob/main/LICENSE)
