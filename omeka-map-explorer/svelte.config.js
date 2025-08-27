import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.argv.includes('dev');
// For GitHub Pages project site: https://fmadore.github.io/IWAC-spatial-overview
const basePath = dev ? '' : '/IWAC-spatial-overview';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// GitHub Pages SPA fallback uses 404.html
			fallback: '404.html',
			strict: false
		}),
		paths: {
			base: basePath
		},
		// SPA build: don't prerender pages, let the client handle routing
		prerender: { entries: [] }
	}
};

export default config;
