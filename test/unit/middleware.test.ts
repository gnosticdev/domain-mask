import type { HonoVariables } from '@/factory'
import type { Hono } from 'hono'
import { createFactory } from 'hono/factory'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { testClient } from 'hono/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import {
	headersMiddleware,
	postMiddleware,
	preMiddleware,
} from '../../src/middleware'

/**
 * Unit tests for middleware functions
 * Tests the pre, post, and headers middleware logic
 */
describe('Middleware', () => {
	const routeFactory = createFactory<{
		Bindings: Env
		Variables: HonoVariables
	}>({
		initApp: (app) => {
			app.use('*', logger(), prettyJSON())
		},
	})
	let app: Hono<{ Bindings: Env; Variables: HonoVariables }>

	describe('preMiddleware', () => {
		beforeEach(() => {
			app = routeFactory.createApp().use('*', preMiddleware)
		})

		it('should set requestURL and targetURL correctly', async () => {
			const route = app.get('/test', (c) => {
				const requestURL = c.get('requestURL')
				const targetURL = c.get('targetURL')
				return c.json({
					requestURL: requestURL.toString(),
					targetURL: targetURL.toString(),
				})
			})

			const client = testClient(route, {
				Bindings: {
					ALIAS_DOMAIN: 'test.example.com',
					TARGET_DOMAIN: 'httpbin.org',
					ENVIRONMENT: 'test',
				},
			})

			const res = await client.test.$get()

			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data.requestURL).toBe('https://test.example.com/test')
			expect(data.targetURL).toBe('https://httpbin.org/test')
		})

		it('should reject requests from non-alias domains', async () => {
			app.use('*', preMiddleware)
			app.get('/test', (c) => c.text('success'))

			const req = new Request('https://unauthorized.com/test')
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(403)
			expect(await res.text()).toBe('Not allowed')
		})

		it('should handle domains without protocol', async () => {
			app.use('*', preMiddleware)
			app.get('/test', (c) => {
				const requestURL = c.get('requestURL')
				const targetURL = c.get('targetURL')
				return c.json({
					requestURL: requestURL.toString(),
					targetURL: targetURL.toString(),
				})
			})

			const req = new Request('https://test.example.com/test')
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com', // No protocol
				TARGET_DOMAIN: 'httpbin.org', // No protocol
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data.requestURL).toBe('https://test.example.com/test')
			expect(data.targetURL).toBe('https://httpbin.org/test')
		})

		it('should preserve query parameters and path', async () => {
			app.use('*', preMiddleware)
			app.get('/test', (c) => {
				const requestURL = c.get('requestURL')
				const targetURL = c.get('targetURL')
				return c.json({
					requestURL: requestURL.toString(),
					targetURL: targetURL.toString(),
				})
			})

			const req = new Request(
				'https://test.example.com/path/to/resource?param=value&other=test',
			)
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data.requestURL).toBe(
				'https://test.example.com/path/to/resource?param=value&other=test',
			)
			expect(data.targetURL).toBe(
				'https://httpbin.org/path/to/resource?param=value&other=test',
			)
		})
	})

	describe('headersMiddleware', () => {
		it('should add X-Robots-Tag header', async () => {
			app.use('*', headersMiddleware)
			app.get('/test', (c) => c.text('success'))

			const req = new Request('https://test.example.com/test')
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(200)
			expect(res.headers.get('X-Robots-Tag')).toBe(
				'noindex, nofollow, noarchive, nosnippet',
			)
		})

		it('should set forward headers correctly', async () => {
			app.use('*', headersMiddleware)
			app.get('/test', (c) => {
				const forwardHeaders = c.get('forwardHeaders')
				return c.json({
					'X-Forwarded-Host': forwardHeaders.get('X-Forwarded-Host'),
					'X-Forwarded-Proto': forwardHeaders.get('X-Forwarded-Proto'),
					'Accept-Encoding': forwardHeaders.get('Accept-Encoding'),
				})
			})

			const req = new Request('https://test.example.com/test', {
				headers: { 'Accept-Encoding': 'gzip, deflate' },
			})
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(200)
			const data = await res.json()
			expect(data['X-Forwarded-Host']).toBe('test.example.com')
			expect(data['X-Forwarded-Proto']).toBe('https')
			expect(data['Accept-Encoding']).toBeNull() // Should be deleted
		})

		it('should add Link header for HTML requests', async () => {
			app.use('*', headersMiddleware)
			app.get('/test', (c) => {
				c.header('content-type', 'text/html')
				return c.text('success')
			})

			const req = new Request('https://test.example.com/test')
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(200)
			const linkHeader = res.headers.get('Link')
			expect(linkHeader).toContain('rel="canonical"')
			expect(linkHeader).toContain('httpbin.org/test')
		})
	})

	describe('postMiddleware', () => {
		it('should rewrite Location header in redirects', async () => {
			app.use('*', postMiddleware)
			app.get('/test', (c) => {
				return c.redirect('https://httpbin.org/redirect-target', 302)
			})

			const req = new Request('https://test.example.com/test')
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(302)
			const location = res.headers.get('Location')
			expect(location).toBe('https://test.example.com/redirect-target')
		})

		it('should rewrite Set-Cookie domain', async () => {
			app.use('*', postMiddleware)
			app.get('/test', (c) => {
				c.header('Set-Cookie', 'session=abc123; Domain=httpbin.org; Path=/')
				return c.text('success')
			})

			const req = new Request('https://test.example.com/test')
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(200)
			const setCookie = res.headers.get('Set-Cookie')
			expect(setCookie).toContain('Domain=httpbin.org')
		})

		it('should remove Strict-Transport-Security header', async () => {
			app.use('*', postMiddleware)
			app.get('/test', (c) => {
				c.header('Strict-Transport-Security', 'max-age=31536000')
				return c.text('success')
			})

			const req = new Request('https://test.example.com/test')
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(200)
			expect(res.headers.get('Strict-Transport-Security')).toBeNull()
		})

		it('should rewrite CSP headers', async () => {
			app.use('*', postMiddleware)
			app.get('/test', (c) => {
				c.header('Content-Security-Policy', "default-src 'self' httpbin.org")
				return c.text('success')
			})

			const req = new Request('https://test.example.com/test')
			const res = await app.request(req, {
				ALIAS_DOMAIN: 'test.example.com',
				TARGET_DOMAIN: 'httpbin.org',
				ENVIRONMENT: 'test',
			})

			expect(res.status).toBe(200)
			const csp = res.headers.get('Content-Security-Policy')
			expect(csp).toContain('httpbin.org')
		})
	})
})
