/**
 * Test setup file for Vitest
 * This file runs before all tests and can be used for global test configuration
 */

// Global test setup can go here
// For example, setting up global mocks or test utilities

/**
 * Mock fetch for testing
 * This allows us to control the responses from external services
 */
globalThis.fetch =
	globalThis.fetch ||
	(() => {
		throw new Error('fetch is not available in test environment')
	})

/**
 * Test utilities and helpers can be defined here
 */
export const testUtils = {
	/**
	 * Create a mock request for testing
	 */
	createMockRequest: (url: string, options: RequestInit = {}) => {
		return new Request(url, {
			method: 'GET',
			...options,
		})
	},

	/**
	 * Create a mock response for testing
	 */
	createMockResponse: (body: string, options: ResponseInit = {}) => {
		return new Response(body, {
			status: 200,
			headers: { 'content-type': 'text/html' },
			...options,
		})
	},
}
