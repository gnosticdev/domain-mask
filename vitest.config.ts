import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

/**
 * Vitest configuration for Cloudflare Workers testing
 * Uses the Workers pool to run tests in a Workers-like environment
 */
export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
		// Test file patterns
		include: ['test/**/*.spec.ts', 'test/**/*.test.ts'],
		// Setup files
		setupFiles: ['test/setup.ts'],
	},
})
