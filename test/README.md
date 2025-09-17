# Domain Mask Worker Tests

This directory contains comprehensive tests for the Domain Mask Cloudflare Worker using `@cloudflare/vitest-pool-workers`.

## Test Structure

### Unit Tests (`test/unit/`)

- **`transform-url.test.ts`** - Tests for URL transformation logic
- **`middleware.test.ts`** - Tests for middleware functions (pre, post, headers)
- **`rewriter.test.ts`** - Tests for HTML content rewriting

### Integration Tests (`test/integration/`)

- **`worker.test.ts`** - Integration tests using SELF fetcher
- **`unit-worker.test.ts`** - Unit tests for the worker using direct function calls

## Running Tests

```bash
# Run all tests
bun test

# Run tests once (CI mode)
bun test:run

# Run tests with coverage
bun test:coverage

# Run tests in watch mode
bun test:watch
```

## Test Configuration

The tests are configured in `vitest.config.ts` to use the Workers pool, which provides:

- Cloudflare Workers runtime environment
- Access to Workers APIs (fetch, HTMLRewriter, etc.)
- Environment variables from `wrangler.jsonc`
- Proper TypeScript support

## Test Environment

Tests run with the following environment variables:

- `ALIAS_DOMAIN`: "test.example.com"
- `TARGET_DOMAIN`: "httpbin.org"
- `ENVIRONMENT`: "test"

## Writing Tests

### Unit Tests

Test individual functions and components in isolation:

```typescript
import { describe, it, expect } from "vitest";
import { convertToMaskedURL } from "../../src/transform-url";

describe("convertToMaskedURL", () => {
  it("should transform URLs correctly", () => {
    // Test implementation
  });
});
```

### Integration Tests

Test the complete worker functionality:

```typescript
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Worker Integration", () => {
  it("should handle requests correctly", async () => {
    const response = await SELF.fetch("https://test.example.com/test");
    expect(response.status).toBe(200);
  });
});
```

### Unit Worker Tests

Test the worker's fetch handler directly:

```typescript
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../../src/index";

describe("Worker Unit Tests", () => {
  it("should process requests", async () => {
    const request = new Request("https://test.example.com/test");
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
  });
});
```

## Mocking

Tests use `vi.fn()` to mock external dependencies like `fetch`:

```typescript
global.fetch = vi.fn().mockResolvedValue(
  new Response("Mock response", {
    status: 200,
    headers: { "content-type": "text/html" },
  })
);
```

## Test Coverage

The test suite covers:

- ✅ URL transformation logic
- ✅ Middleware functionality
- ✅ HTML content rewriting
- ✅ Content type handling (HTML, JSON, CSS, JS, images)
- ✅ HTTP method support (GET, POST, PUT, PATCH)
- ✅ Error handling
- ✅ Headers processing
- ✅ Domain validation
- ✅ robots.txt endpoint

## Debugging Tests

To debug tests, you can:

1. Use `console.log()` statements in tests
2. Run tests in watch mode: `bun test:watch`
3. Use VS Code debugger with the Vitest extension
4. Check test output for detailed error messages
