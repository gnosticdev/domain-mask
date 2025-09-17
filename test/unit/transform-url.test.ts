import { describe, expect, it } from 'vitest'
import { convertToMaskedURL } from '../../src/transform-url'

/**
 * Unit tests for the convertToMaskedURL function
 * Tests URL transformation logic for domain masking
 */
describe('convertToMaskedURL', () => {
	const maskedURL = new URL('https://httpbin.org')
	const requestURL = new URL('https://example.com')

	it('should transform absolute URLs with masked domain', () => {
		const originalUrl = 'https://httpbin.org/api/test'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe('https://example.com/api/test')
	})

	it('should transform relative URLs', () => {
		const originalUrl = '/api/test'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe('https://example.com/api/test')
	})

	it('should handle protocol-relative URLs', () => {
		const originalUrl = '//httpbin.org/api/test'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe('https://example.com/api/test')
	})

	it('should preserve localhost with port', () => {
		const localhostRequestURL = new URL('http://localhost:8787')
		const originalUrl = 'https://httpbin.org/api/test'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL: localhostRequestURL,
		})

		expect(result).toBe('http://localhost:8787/api/test')
	})

	it("should not transform URLs that don't contain masked domain", () => {
		const originalUrl = 'https://example.com/api/test'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe(originalUrl)
	})

	it('should not transform data URLs', () => {
		const originalUrl =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe(originalUrl)
	})

	it('should not transform non-http URLs', () => {
		const originalUrl = 'ftp://httpbin.org/file.txt'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe(originalUrl)
	})

	it('should handle malformed URLs gracefully', () => {
		const originalUrl = 'not-a-valid-url'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe(originalUrl)
	})

	it('should preserve query parameters and fragments', () => {
		const originalUrl = 'https://httpbin.org/api/test?param=value#fragment'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe('https://example.com/api/test?param=value#fragment')
	})

	it('should handle URLs with subdomains', () => {
		const originalUrl = 'https://api.httpbin.org/test'
		const result = convertToMaskedURL({
			originalUrl,
			maskedURL,
			requestURL,
		})

		expect(result).toBe('https://api.example.com/test')
	})
})
