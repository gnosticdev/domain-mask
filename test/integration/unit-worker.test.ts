import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../../src/index'

/**
 * Unit tests for the worker using direct function calls
 * Tests the worker's fetch handler directly without going through the full request cycle
 */
describe('Domain Mask Worker Unit Tests', () => {
	const IncomingRequest = Request<unknown, IncomingRequestCfProperties>

	beforeEach(() => {
		// Reset any mocks before each test
		vi.clearAllMocks()
	})

	describe('robots.txt endpoint', () => {
		it('should return robots.txt content', async () => {
			const request = new IncomingRequest('https://example.com/robots.txt')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
			expect(response.headers.get('content-type')).toBe('text/plain')
			expect(response.headers.get('cache-control')).toBe(
				'public, max-age=86400',
			)

			const text = await response.text()
			expect(text).toBe('User-agent: *\nDisallow: /')
		})
	})

	describe('domain validation', () => {
		it('should reject requests from unauthorized domains', async () => {
			const request = new IncomingRequest('https://unauthorized.com/test')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(403)
			expect(await response.text()).toBe('Not allowed')
		})

		it('should accept requests from authorized domains', async () => {
			// Mock the fetch to return a simple response
			globalThis.fetch = vi.fn().mockResolvedValue(
				new Response('Hello World', {
					status: 200,
					headers: { 'content-type': 'text/html' },
				}),
			)

			const request = new IncomingRequest('https://example.com/test')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			// Should not be 403, but might be 502 if fetch fails
			expect(response.status).not.toBe(403)
		})
	})

	describe('content processing', () => {
		it('should process HTML content and rewrite URLs', async () => {
			const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:url" content="https://httpbin.org/page">
            <link rel="canonical" href="https://httpbin.org/page">
          </head>
          <body>
            <a href="https://httpbin.org/link">Link</a>
            <img src="https://httpbin.org/image.jpg" alt="test">
            <script src="https://httpbin.org/script.js"></script>
          </body>
        </html>
      `

			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockHtml, {
					status: 200,
					headers: { 'content-type': 'text/html' },
				}),
			)

			const request = new IncomingRequest('https://example.com/test')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
			const html = await response.text()

			// Check that URLs have been rewritten
			expect(html).toContain('content="https://example.com/page"')
			expect(html).toContain('href="https://example.com/page"')
			expect(html).toContain('href="https://example.com/link"')
			expect(html).toContain('src="https://example.com/image.jpg"')
			expect(html).toContain('src="https://example.com/script.js"')
		})

		it('should process JSON content and rewrite URLs', async () => {
			const mockJson = JSON.stringify({
				url: 'https://httpbin.org/api/data',
				message: 'Visit https://httpbin.org for more info',
				nested: {
					apiUrl: 'https://httpbin.org/api/nested',
				},
			})

			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockJson, {
					status: 200,
					headers: { 'content-type': 'application/json' },
				}),
			)

			const request = new IncomingRequest('https://example.com/api/test')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
			const json = await response.text()
			const data = JSON.parse(json)

			expect(data.url).toBe('https://example.com/api/data')
			expect(data.message).toBe('Visit https://example.com for more info')
			expect(data.nested.apiUrl).toBe('https://example.com/api/nested')
		})

		it('should process CSS content and rewrite URLs', async () => {
			const mockCss = `
        body {
          background: url('https://httpbin.org/bg.jpg');
        }
        .logo {
          background-image: url("https://httpbin.org/logo.png");
        }
        .icon {
          background: url(https://httpbin.org/icon.svg);
        }
      `

			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockCss, {
					status: 200,
					headers: { 'content-type': 'text/css' },
				}),
			)

			const request = new IncomingRequest('https://example.com/style.css')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
			const css = await response.text()
			expect(css).toContain('url("https://example.com/bg.jpg")')
			expect(css).toContain('url("https://example.com/logo.png")')
			expect(css).toContain('url("https://example.com/icon.svg")')
		})

		it('should process JavaScript content and rewrite URLs', async () => {
			const mockJs = `
        const apiUrl = 'https://httpbin.org/api/data';
        const baseUrl = 'https://httpbin.org';
        const config = {
          endpoint: 'https://httpbin.org/api/config'
        };
        console.log('API endpoint:', apiUrl);
      `

			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockJs, {
					status: 200,
					headers: { 'content-type': 'application/javascript' },
				}),
			)

			const request = new IncomingRequest('https://example.com/script.js')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
			const js = await response.text()
			expect(js).toContain("'https://example.com/api/data'")
			expect(js).toContain("'https://example.com'")
			expect(js).toContain("'https://example.com/api/config'")
		})

		it('should pass through image content without modification', async () => {
			const mockImageData = new ArrayBuffer(100)
			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockImageData, {
					status: 200,
					headers: { 'content-type': 'image/png' },
				}),
			)

			const request = new IncomingRequest('https://example.com/image.png')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
			expect(response.headers.get('content-type')).toBe('image/png')

			const responseData = await response.arrayBuffer()
			expect(responseData.byteLength).toBe(100)
		})
	})

	describe('HTTP methods', () => {
		it('should handle GET requests', async () => {
			global.fetch = vi.fn().mockResolvedValue(
				new Response('GET response', {
					status: 200,
					headers: { 'content-type': 'text/plain' },
				}),
			)

			const request = new IncomingRequest('https://example.com/test', {
				method: 'GET',
			})
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
			expect(await response.text()).toBe('GET response')
		})

		it('should handle POST requests with body', async () => {
			const postData = JSON.stringify({ key: 'value' })

			global.fetch = vi.fn().mockImplementation((_url, options) => {
				expect(options.method).toBe('POST')
				expect(options.body).toBeDefined()
				return Promise.resolve(
					new Response('POST response', {
						status: 200,
						headers: { 'content-type': 'text/plain' },
					}),
				)
			})

			const request = new IncomingRequest('https://example.com/test', {
				method: 'POST',
				body: postData,
				headers: { 'content-type': 'application/json' },
			})
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
		})

		it('should handle PUT requests', async () => {
			const putData = 'PUT data'

			global.fetch = vi.fn().mockImplementation((_url, options) => {
				expect(options.method).toBe('PUT')
				expect(options.body).toBeDefined()
				return Promise.resolve(
					new Response('PUT response', {
						status: 200,
						headers: { 'content-type': 'text/plain' },
					}),
				)
			})

			const request = new IncomingRequest('https://example.com/test', {
				method: 'PUT',
				body: putData,
			})
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
		})

		it('should handle PATCH requests', async () => {
			const patchData = 'PATCH data'

			global.fetch = vi.fn().mockImplementation((_url, options) => {
				expect(options.method).toBe('PATCH')
				expect(options.body).toBeDefined()
				return Promise.resolve(
					new Response('PATCH response', {
						status: 200,
						headers: { 'content-type': 'text/plain' },
					}),
				)
			})

			const request = new IncomingRequest('https://example.com/test', {
				method: 'PATCH',
				body: patchData,
			})
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
		})
	})

	describe('error handling', () => {
		it('should handle fetch errors gracefully', async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

			const request = new IncomingRequest('https://example.com/test')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(502)
			const text = await response.text()
			expect(text).toContain('Failed to process request')
		})

		it('should handle non-ok responses', async () => {
			global.fetch = vi.fn().mockResolvedValue(
				new Response('Not Found', {
					status: 404,
					statusText: 'Not Found',
					headers: { 'content-type': 'text/plain' },
				}),
			)

			const request = new IncomingRequest('https://example.com/notfound')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(502)
			const text = await response.text()
			expect(text).toContain('Failed to process request')
		})
	})

	describe('headers handling', () => {
		it('should set correct headers for forwarded requests', async () => {
			global.fetch = vi.fn().mockImplementation((_url, options) => {
				expect(options.headers.get('Host')).toBe('httpbin.org')
				expect(options.headers.get('Origin')).toBe('https://httpbin.org')
				expect(options.headers.get('Referer')).toBe('https://httpbin.org')
				return Promise.resolve(
					new Response('OK', {
						status: 200,
						headers: { 'content-type': 'text/plain' },
					}),
				)
			})

			const request = new IncomingRequest('https://example.com/test')
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
		})

		it('should preserve original headers except host', async () => {
			global.fetch = vi.fn().mockImplementation((_url, options) => {
				expect(options.headers.get('User-Agent')).toBe('test-agent')
				expect(options.headers.get('Accept')).toBe('text/html')
				return Promise.resolve(
					new Response('OK', {
						status: 200,
						headers: { 'content-type': 'text/plain' },
					}),
				)
			})

			const request = new IncomingRequest('https://example.com/test', {
				headers: {
					'User-Agent': 'test-agent',
					Accept: 'text/html',
				},
			})
			const ctx = createExecutionContext()

			const response = await worker.fetch(request, env, ctx)
			await waitOnExecutionContext(ctx)

			expect(response.status).toBe(200)
		})
	})
})
