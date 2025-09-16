import { routeFactory } from './factory'

/**
 * Helper function to compare hostnames without www.
 */
const eqHost = (a: string, b: string) =>
	a.replace(/^www\./, '') === b.replace(/^www\./, '')

/**
 * Add https:// to the hostname if it's not present and return a new URL object
 */
const normailzeUrl = (url: URL | string) => {
	if (typeof url === 'string') {
		// the domains might not have a protocol, so we need to add it
		url = !url.match(/^https?:\/\//) ? `https://${url}` : url
		url = new URL(url)
	}

	const normalized = new URL(url.toString())
	normalized.host = url.host
	return normalized
}

/**
 * Middleware to compute the request and masked URLs
 */
export const preMiddleware = routeFactory.createMiddleware(async (c, next) => {
	// request url will be from our ALIAS_DOMAIN
	const reqUrl = new URL(c.req.url)
	const aliasDomain = normailzeUrl(c.env.ALIAS_DOMAIN)
	const targetURL = normailzeUrl(c.env.TARGET_DOMAIN)

	if (reqUrl.hostname !== aliasDomain.hostname) {
		return c.text('Not allowed', 403)
	}

	// requestURL = the public/masking host user is visiting
	c.set('requestURL', reqUrl)

	// build the masked URL

	// copy the rest of the request url
	targetURL.pathname = reqUrl.pathname
	targetURL.search = reqUrl.search
	c.set('targetURL', targetURL)

	console.log('aliasDomain', aliasDomain)
	console.log('targetURL', targetURL)
	console.log('reqUrl', reqUrl)

	await next()
})

/**
 * Middleware to fix redirects, cookies, and a couple security headers
 */
export const postMiddleware = routeFactory.createMiddleware(async (c, next) => {
	// only apply to responses
	await next()

	const _headers = c.res.headers
	const aliasHostname = c.get('targetURL').hostname

	// 1) Rewrite redirect Location to mask domain
	const loc = _headers.get('Location')
	if (loc) {
		try {
			const targetLoc = new URL(loc, `https://${aliasHostname}`)
			if (eqHost(targetLoc.hostname, aliasHostname)) {
				targetLoc.hostname = aliasHostname
				_headers.set('Location', targetLoc.toString())
			}
		} catch {
			/* ok */
		}
	}

	// 2) Rewrite Set-Cookie Domain to MASK_HOST
	const getAll = _headers.getSetCookie()
	if (getAll?.length) {
		_headers.delete('Set-Cookie')
		for (const cki of getAll) {
			_headers.append(
				'Set-Cookie',
				cki.replace(/;\s*Domain=[^;]+/i, `; Domain=${c.env.TARGET_DOMAIN}`),
			)
		}
	} else {
		const one = _headers.get('Set-Cookie')
		if (one)
			_headers.set(
				'Set-Cookie',
				one.replace(/;\s*Domain=[^;]+/gi, `; Domain=${c.env.TARGET_DOMAIN}`),
			)
	}

	// 3) Optional: patch CSP that hard-codes origin, and drop HSTS
	const csp = _headers.get('Content-Security-Policy')
	if (csp?.includes(c.env.TARGET_DOMAIN))
		_headers.set(
			'Content-Security-Policy',
			csp.replaceAll(c.env.TARGET_DOMAIN, c.env.TARGET_DOMAIN),
		)
	_headers.delete('Strict-Transport-Security')
})

/**
 * Middleware to add/alter headers to the request
 *
 * - Prevent search engines from indexing the masked domain
 * - Add Link header for canonical URL if it's an HTML response
 */
export const headersMiddleware = routeFactory.createMiddleware(
	async (c, next) => {
		// Prevent search engines from indexing the masked domain, also setting custom response in the route
		c.header('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
		await next()

		const reqUrl = new URL(c.req.url)

		// normalize forwarding headers (and make rewriting easier)
		const hdr = new Headers(c.req.raw.headers)
		hdr.set('X-Forwarded-Host', reqUrl.host)
		hdr.set('X-Forwarded-Proto', 'https')
		hdr.delete('Accept-Encoding') // so you can rewrite text safely
		c.set('forwardHeaders', hdr)

		// Add Link header for canonical URL if it's an HTML response
		const contentType = c.req.header('content-type')
		if (contentType?.includes('text/html')) {
			const maskedURL = new URL(c.env.TARGET_DOMAIN)
			maskedURL.pathname = new URL(c.req.url).pathname
			maskedURL.search = new URL(c.req.url).search
			c.header('Link', `<${maskedURL.toString()}>; rel="canonical"`)
		}
	},
)
