import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const app = JSON.parse(readFileSync(new URL('./config/app.json', import.meta.url), 'utf8'));

// A static SPA: the same build runs in the Capacitor WebView (iOS, later
// Android) and on any static web host. `fallback` lets deep links resolve
// to index.html so the client router takes over.
export default defineConfig({
	define: { __APP_VERSION__: JSON.stringify(app.marketingVersion) },
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},
			adapter: adapter({ fallback: 'index.html' }),
			// The web version on calc.a2cons.com lives under /app.
			paths: { base: process.env.BASE_PATH ?? '' }
		})
	],
	server: { host: true, port: 5180 },
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
