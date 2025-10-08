// @ts-check

import AstroPWA from '@vite-pwa/astro'
import { defineConfig } from 'astro/config'

export default defineConfig({
	build: {
		inlineStylesheets: 'never',
	},
	integrations: [
		AstroPWA({
			manifest: false,
			registerType: 'autoUpdate',
			workbox: {
				globPatterns: ['**/*.{css,db,html,js,wasm}'],
			},
		}),
	],
})
