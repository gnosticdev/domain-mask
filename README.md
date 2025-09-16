# Cloudflare Domain Masking Proxy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](<https://deploy.workers.cloudflare.com/?url=https://github.com/gnosticdev/domain-mask>)

This is a simple way to mask a domain by proxying requests to a different domain, without changing the URL.

The main goal is to be able to use a separate domain for email addresses, or a bunch of different domains, but still have those point to the main site. However, with redirects, if the email domain were to be blacklisted, it could hurt the main site in both email and SEO. By using a masking proxy, you go to `https;//my-masked-domain.com` and it would show all the same content as `https;//my-main-domain.com` but the URL would remain `https;//my-masked-domain.com`, and there would be no trace of the main domain in the request headers or source code.

Features:

- Swaps out all ocurrences of the masked domain with the target domain
- Maintains site functionality
- Keeps the same URL structure
- Keeps the same content
- Keeps the same SEO
- Keeps the same email links
- Keeps the same social links
- Keeps the same tracking links

## WordPress-specific handling

This worker includes WordPress-aware rewriting that covers common WP patterns so the masked site behaves correctly without leaking the origin domain. The logic lives primarily in `src/rewriter.ts` and is applied from the main request handler in `src/index.ts`.

What it handles:

- Links and attributes: Rewrites `href` and relevant `content` attributes that include the masked hostname.
- Images: Rewrites `img` attributes including `src`, `srcset`, `data-src`, and `data-srcset`, decoding and transforming each URL while preserving sizes.
- Meta tags: Normalizes protocol-relative and relative values; rewrites hostnames; forces correct canonical-like values for `og:url` and `twitter:url`.
- Script tags:
  - Removes Google Analytics and GTM references (`google-analytics.com`, `googletagmanager.com`).
  - Rewrites external `src`/`srcset` attributes pointing to the masked host.
  - Rewrites inline script text for both plain and escaped URL forms, covering full URLs and bare hostnames.
- Link tags: Removes analytics prefetch/link tags; sets `<link rel="canonical" ...>` to the request URL; rewrites `href` values containing the masked host.
- Text nodes and `<noscript>`: Rewrites masked host occurrences to the request host.
- Comments: Removes HTML comments.
- Non-HTML responses common in WordPress:
  - JSON: Rewrites host occurrences in JSON payloads (useful for `wp-json` endpoints and plugin AJAX responses).
  - CSS: Rewrites `url(...)` references.
  - JavaScript files: Rewrites masked host occurrences in static JS bundles.

See:

- `src/rewriter.ts` for HTML rewriting coverage.
- `src/index.ts` for JSON/CSS/JS/non-HTML handling and streaming via `HTMLRewriter`.

## How it works

This is a simple Cloudflare worker that responds to all requests and does the swapping on the server before anything reaches the client.

## Configure routes and environment variables (wrangler.jsonc)

To use a custom domain and configure environment variables, update `wrangler.jsonc`.

1) Enable a custom domain route (production)

- Ensure there is no CNAME record for the domain in your Cloudflare DNS (as noted in the file comments).
- Set the route with `custom_domain: true` and your domain pattern.

```jsonc
// wrangler.jsonc (root)
{
  // ...
  "name": "example-domain-mask",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-16",
  // Enable the custom domain for production
  "route": {
    "custom_domain": true,
    "pattern": "example.com" // set to the domain you want to mask
  },
  // ...
}
```

2) Configure environment variables

- `ALIAS_DOMAIN`: Origins allowed by CORS and general access control.
- `TARGET_DOMAIN`: The full origin you are masking to (include protocol), e.g. `https://www.origin-site.com`.
- `ENVIRONMENT`: `production` or `development`.

```jsonc
// wrangler.jsonc (root)
{
  // ...
  "vars": {
    "ALIAS_DOMAIN": ["example.com", "www.example.com"],
    "TARGET_DOMAIN": "https://www.origin-site.com",
    "ENVIRONMENT": "production",
    "BUN_VERSION": "1.2.2" // optional, used by scripts
  }
}
```

3) Local development setup

- A development environment is already provided under `env.development` with a local route and example vars. Keep `pattern` set to `localhost:8787` for the local dev server.

```jsonc
// wrangler.jsonc (development)
{
  // ...
  "env": {
    "development": {
      "route": {
        "custom_domain": false,
        "pattern": "localhost:8787"
      },
      "vars": {
        "ALIAS_DOMAIN": ["localhost"],
        "TARGET_DOMAIN": "https://www.origin-site.com",
        "ENVIRONMENT": "development"
      }
    }
  }
}
```

## Run and deploy

- Dev: `bun run dev`
- Type generation (for env bindings): `bun run typegen`
- Deploy: `bun run deploy` (or `wrangler deploy --minify`)

Notes:

- CORS is backed by `ALIAS_DOMAIN` in `src/factory.ts`. Ensure you include all origins that will request your worker.
- The middleware sets `X-Robots-Tag: noindex, nofollow` and adds a `Link: <...>; rel="canonical"` header to discourage indexing of the masked domain while keeping canonical signals consistent.
