import { SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Integration tests for the main worker functionality
 * Tests the complete request/response cycle through the worker
 */
describe('Domain Mask Worker Integration Tests', () => {
	beforeEach(() => {
		// Reset any mocks before each test
		vi.clearAllMocks()
	})

	describe('robots.txt endpoint', () => {
		it('should return robots.txt content', async () => {
			const response = await SELF.fetch('https://example.com/robots.txt')

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
			const response = await SELF.fetch('https://unauthorized.com/test')

			expect(response.status).toBe(403)
			expect(await response.text()).toBe('Not allowed')
		})

		it('should accept requests from authorized domains', async () => {
			// Mock the fetch to return a simple response
			global.fetch = vi.fn().mockResolvedValue(
				new Response('Hello World', {
					status: 200,
					headers: { 'content-type': 'text/html' },
				}),
			)

			const response = await SELF.fetch('https://example.com/test')

			// Should not be 403, but might be 502 if fetch fails
			expect(response.status).not.toBe(403)
		})
	})

	describe('content type handling', () => {
		it('should handle HTML responses', async () => {
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
          </body>
        </html>
      `

			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockHtml, {
					status: 200,
					headers: { 'content-type': 'text/html' },
				}),
			)

			const response = await SELF.fetch('https://example.com/test')

			expect(response.status).toBe(200)
			const html = await response.text()

			// Check that URLs have been rewritten
			expect(html).toContain('content="https://example.com/page"')
			expect(html).toContain('href="https://example.com/page"')
			expect(html).toContain('href="https://example.com/link"')
			expect(html).toContain('src="https://example.com/image.jpg"')
		})

		it('should handle JSON responses', async () => {
			const mockJson = JSON.stringify({
				url: 'https://httpbin.org/api/data',
				message: 'Visit https://httpbin.org for more info',
			})

			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockJson, {
					status: 200,
					headers: { 'content-type': 'application/json' },
				}),
			)

			const response = await SELF.fetch('https://example.com/api/test')

			expect(response.status).toBe(200)
			const json = await response.text()
			const data = JSON.parse(json)

			expect(data.url).toBe('https://example.com/api/data')
			expect(data.message).toBe('Visit https://example.com for more info')
		})

		it('should handle CSS responses', async () => {
			const mockCss = `
        body { background: url('https://httpbin.org/bg.jpg'); }
        .logo { background-image: url("https://httpbin.org/logo.png"); }
      `

			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockCss, {
					status: 200,
					headers: { 'content-type': 'text/css' },
				}),
			)

			const response = await SELF.fetch('https://example.com/style.css')

			expect(response.status).toBe(200)
			const css = await response.text()

			expect(css).toContain('url("https://example.com/bg.jpg")')
			expect(css).toContain('url("https://example.com/logo.png")')
		})

		it('should handle JavaScript responses', async () => {
			const mockJs = `
        const apiUrl = 'https://httpbin.org/api/data';
        const baseUrl = 'https://httpbin.org';
        console.log('API endpoint:', apiUrl);
      `

			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockJs, {
					status: 200,
					headers: { 'content-type': 'application/javascript' },
				}),
			)

			const response = await SELF.fetch('https://example.com/script.js')

			expect(response.status).toBe(200)
			const js = await response.text()

			expect(js).toContain("'https://example.com/api/data'")
			expect(js).toContain("'https://example.com'")
		})

		it('should handle image responses', async () => {
			const mockImageData = new ArrayBuffer(100)
			global.fetch = vi.fn().mockResolvedValue(
				new Response(mockImageData, {
					status: 200,
					headers: { 'content-type': 'image/png' },
				}),
			)

			const response = await SELF.fetch('https://example.com/image.png')

			expect(response.status).toBe(200)
			expect(response.headers.get('content-type')).toBe('image/png')
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

			const response = await SELF.fetch('https://example.com/test', {
				method: 'GET',
			})

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

			const response = await SELF.fetch('https://example.com/test', {
				method: 'POST',
				body: postData,
				headers: { 'content-type': 'application/json' },
			})

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

			const response = await SELF.fetch('https://example.com/test', {
				method: 'PUT',
				body: putData,
			})

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

			const response = await SELF.fetch('https://example.com/test', {
				method: 'PATCH',
				body: patchData,
			})

			expect(response.status).toBe(200)
		})
	})

	describe('error handling', () => {
		it('should handle fetch errors gracefully', async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

			const response = await SELF.fetch('https://example.com/test')

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

			const response = await SELF.fetch('https://example.com/notfound')

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

			const response = await SELF.fetch('https://example.com/test')

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

			const response = await SELF.fetch('https://example.com/test', {
				headers: {
					'User-Agent': 'test-agent',
					Accept: 'text/html',
				},
			})

			expect(response.status).toBe(200)
		})
	})
})
