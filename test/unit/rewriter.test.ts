import { describe, expect, it } from 'vitest'
import { createRewriter } from '../../src/rewriter'

/**
 * Unit tests for the HTML rewriter functionality
 * Tests HTML content transformation for domain masking
 */
describe('createRewriter', () => {
	const maskedURL = new URL('https://httpbin.org')
	const requestURL = new URL('https://example.com')

	it('should rewrite href attributes', async () => {
		const html = '<a href="https://httpbin.org/api/test">Link</a>'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain('href="https://example.com/api/test"')
	})

	it('should rewrite src attributes', async () => {
		const html = '<img src="https://httpbin.org/image.jpg" alt="test">'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain('src="https://example.com/image.jpg"')
	})

	it('should rewrite srcset attributes', async () => {
		const html =
			'<img srcset="https://httpbin.org/image1.jpg 1x, https://httpbin.org/image2.jpg 2x" alt="test">'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain(
			'srcset="https://example.com/image1.jpg 1x, https://example.com/image2.jpg 2x"',
		)
	})

	it('should rewrite script src attributes', async () => {
		const html = '<script src="https://httpbin.org/script.js"></script>'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain('src="https://example.com/script.js"')
	})

	it('should rewrite canonical link href', async () => {
		const html = '<link rel="canonical" href="https://httpbin.org/page">'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain('href="https://example.com/page"')
	})

	it('should rewrite meta content URLs', async () => {
		const html = '<meta property="og:url" content="https://httpbin.org/page">'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain('content="https://example.com/page"')
	})

	it('should rewrite og:url and twitter:url meta tags', async () => {
		const html = `
      <meta property="og:url" content="https://httpbin.org/page">
      <meta name="twitter:url" content="https://httpbin.org/page">
    `
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain(
			'property="og:url" content="https://example.com/page"',
		)
		expect(transformedHtml).toContain(
			'name="twitter:url" content="https://example.com/page"',
		)
	})

	it('should rewrite text content', async () => {
		const html = '<p>Visit https://httpbin.org for more info</p>'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain('Visit https://example.com for more info')
	})

	it('should rewrite noscript content', async () => {
		const html =
			'<noscript>Please enable JavaScript to visit https://httpbin.org</noscript>'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain(
			'Please enable JavaScript to visit https://example.com',
		)
	})

	it('should remove analytics scripts', async () => {
		const html = '<script src="https://googletagmanager.com/gtag/js"></script>'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).not.toContain('googletagmanager.com')
	})

	it('should remove analytics links', async () => {
		const html = '<link rel="preconnect" href="https://google-analytics.com">'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).not.toContain('google-analytics.com')
	})

	it('should remove HTML comments', async () => {
		const html =
			'<div>Content</div><!-- This is a comment --><p>More content</p>'
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).not.toContain('This is a comment')
		expect(transformedHtml).toContain('<div>Content</div>')
		expect(transformedHtml).toContain('<p>More content</p>')
	})

	it('should handle localhost with port', async () => {
		const localhostRequestURL = new URL('http://localhost:8787')
		const html = '<a href="https://httpbin.org/api/test">Link</a>'
		const rewriter = createRewriter({
			maskedURL,
			requestURL: localhostRequestURL,
		})

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain('href="http://localhost:8787/api/test"')
	})

	it('should handle complex HTML with multiple transformations', async () => {
		const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:url" content="https://httpbin.org/page">
          <link rel="canonical" href="https://httpbin.org/page">
          <script src="https://httpbin.org/script.js"></script>
        </head>
        <body>
          <img src="https://httpbin.org/image.jpg" alt="test">
          <a href="https://httpbin.org/link">Link</a>
          <p>Visit https://httpbin.org for more info</p>
        </body>
      </html>
    `
		const rewriter = createRewriter({ maskedURL, requestURL })

		const response = rewriter.transform(new Response(html))
		const transformedHtml = await response.text()

		expect(transformedHtml).toContain('content="https://example.com/page"')
		expect(transformedHtml).toContain('href="https://example.com/page"')
		expect(transformedHtml).toContain('src="https://example.com/script.js"')
		expect(transformedHtml).toContain('src="https://example.com/image.jpg"')
		expect(transformedHtml).toContain('href="https://example.com/link"')
		expect(transformedHtml).toContain('Visit https://example.com for more info')
	})
})
