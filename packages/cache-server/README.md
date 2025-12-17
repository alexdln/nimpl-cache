# @nimpl/cache-server

A standalone HTTP server that exposes a `CacheHandler` instance via HTTP API. Designed to work with `FetchLayer` from `@nimpl/cache` to enable distributed caching across multiple application instances.

## Installation

```bash
npm install @nimpl/cache-server @nimpl/cache
# or
pnpm add @nimpl/cache-server @nimpl/cache
```

## Overview

`@nimpl/cache-server` provides an HTTP server that wraps any `CacheHandler` instance and exposes it through a standardized HTTP API. This enables you to:

- Share cache across multiple application instances in distributed deployments
- Run cache as a separate service for better scalability
- Use `FetchLayer` in your applications to access the cache remotely

The server implements the HTTP API expected by `FetchLayer`, making it easy to set up distributed caching solutions.

## Usage

### Basic Setup

Create a cache handler and start the server:

```ts
import { run } from "@nimpl/cache-server";
import { CacheHandler, LruLayer, FsLayer } from "@nimpl/cache";

const cacheHandler = new CacheHandler({
  ephemeralLayer: new LruLayer(),
  persistentLayer: new FsLayer(),
});

run(cacheHandler);
```

The server will start on `http://localhost:4000` by default.

### Custom Configuration

```ts
import { run } from "@nimpl/cache-server";
import { CacheHandler, LruLayer, RedisLayer } from "@nimpl/cache";

const cacheHandler = new CacheHandler({
  ephemeralLayer: new LruLayer(),
  persistentLayer: new RedisLayer(),
});

run(cacheHandler, {
  port: 8080,
  host: "0.0.0.0",
  verifyRequest: async (req) => {
    // Add authentication/authorization logic
    const authHeader = req.headers.authorization;
    return authHeader === `Bearer ${process.env.CACHE_TOKEN}`;
  },
});
```

### Using with FetchLayer

In your application instances, use `FetchLayer` to connect to the cache server:

```ts
// cache-handler.js
import { CacheHandler, LruLayer, FetchLayer } from "@nimpl/cache";

export default new CacheHandler({
  ephemeralLayer: new LruLayer(),
  persistentLayer: new FetchLayer({
    baseUrl: process.env.CACHE_SERVER_URL || "http://cache-server:4000",
  }),
});
```

## API

### `init(cacheHandler, options?)`

Creates an HTTP server instance without starting it. Useful when you need to control when the server starts or integrate it with other server frameworks.

**Parameters:**

- `cacheHandler` (`CacheHandlerRoot`): The cache handler instance to expose via HTTP
- `options` (`CacheServerOptions`): Optional configuration
  - `verifyRequest` (`(req: IncomingMessage) => Promise<boolean>`): Optional callback to verify/authenticate requests. Return `false` to reject the request with 403 status.

**Returns:** `http.Server` - The HTTP server instance

**Example:**

```ts
import { init } from "@nimpl/cache-server";
import { CacheHandler, LruLayer, RedisLayer } from "@nimpl/cache";

const cacheHandler = new CacheHandler({
  ephemeralLayer: new LruLayer(),
  persistentLayer: new RedisLayer(),
});

const server = init(cacheHandler, {
  verifyRequest: async (req) => {
    // Custom authentication logic
    return true;
  },
});

// Start the server manually
server.listen(4000, "0.0.0.0", () => {
  console.log("Cache server running on port 4000");
});
```

### `run(cacheHandler, options?)`

Creates and starts an HTTP server that exposes the cache handler.

**Parameters:**

- `cacheHandler` (`CacheHandlerRoot`): The cache handler instance to expose via HTTP
- `options` (`CacheServerOptions`): Optional configuration
  - `port` (`number`): Port to run the server on. Default: `4000`
  - `host` (`string`): Host to bind the server to. Default: `"localhost"`
  - `verifyRequest` (`(req: IncomingMessage) => Promise<boolean>`): Optional callback to verify/authenticate requests. Return `false` to reject the request with 403 status.

**Returns:** `http.Server` - The HTTP server instance

**Example:**

```ts
import { run } from "@nimpl/cache-server";
import { CacheHandler, LruLayer, FsLayer } from "@nimpl/cache";

const cacheHandler = new CacheHandler({
  ephemeralLayer: new LruLayer(),
  persistentLayer: new FsLayer(),
});

run(cacheHandler, {
  port: 4000,
  host: "0.0.0.0",
});
```

## HTTP API

The server implements the following HTTP endpoints expected by `FetchLayer`:

### `GET /?key=<key>`

Retrieves a cache entry.

- **Query Parameters:**
  - `key` (required): The cache key
- **Response:**
  - `200 OK`: Returns the cache entry as a stream with `x-cache-metadata` header
  - `404 Not Found`: Cache entry not found
  - `400 Bad Request`: Missing key parameter
  - `500 Internal Server Error`: Server error

### `POST /?key=<key>`

Stores a cache entry.

- **Query Parameters:**
  - `key` (required): The cache key
- **Headers:**
  - `x-cache-metadata` (required): JSON string containing cache metadata (tags, timestamp, stale, expire, revalidate)
  - `Content-Type`: `application/octet-stream`
- **Body:** Stream containing the cache value
- **Response:**
  - `200 OK`: Entry stored successfully
  - `400 Bad Request`: Missing key or metadata
  - `500 Internal Server Error`: Server error

### `PUT /`

Updates tags for cache entries.

- **Body:** JSON object with `tags` (array) and optional `durations` object
- **Response:**
  - `200 OK`: Tags updated successfully
  - `400 Bad Request`: Invalid request body
  - `500 Internal Server Error`: Server error

### `DELETE /?key=<key>`

Deletes a cache entry.

- **Query Parameters:**
  - `key` (required): The cache key
- **Response:**
  - `200 OK`: Entry deleted successfully
  - `400 Bad Request`: Missing key parameter
  - `500 Internal Server Error`: Server error

### `GET /keys`

Returns all cache keys.

- **Response:**
  - `200 OK`: JSON array of cache keys
  - `500 Internal Server Error`: Server error

### `GET /readiness`

Health check endpoint.

- **Response:**
  - `200 OK`: JSON object with `ready` boolean indicating cache handler readiness

## Security

The server does not include built-in authentication. For production deployments, you should implement request verification using the `verifyRequest` option:

```ts
run(cacheHandler, {
  verifyRequest: async (req) => {
    // Example: Verify API token
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.CACHE_SERVER_TOKEN;

    if (!authHeader || !expectedToken) {
      return false;
    }

    return authHeader === `Bearer ${expectedToken}`;
  },
});
```

For additional security, consider:

- Running the server behind a reverse proxy with authentication (e.g., nginx, Traefik)
- Using network policies to restrict access to the cache server
- Implementing rate limiting
- Using TLS/HTTPS for encrypted communication

## Deployment

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

CMD ["node", "server.js"]
```

### Kubernetes

The cache server can be deployed as a separate service in Kubernetes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cache-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cache-server
  template:
    metadata:
      labels:
        app: cache-server
    spec:
      containers:
        - name: cache-server
          image: your-registry/cache-server:latest
          ports:
            - containerPort: 4000
          env:
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: cache-secrets
                  key: redis-url
```

## Examples

See the [external-store-server example](https://github.com/alexdln/nimpl-cache/tree/main/examples/external-store-server) for a complete setup demonstrating cache server with filesystem storage.

## License

[MIT](https://github.com/alexdln/nimpl-cache/blob/main/LICENSE)
