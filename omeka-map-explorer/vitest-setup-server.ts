// Vitest server environment setup
// Provide minimal SvelteKit payload to satisfy runtime code accessing it.
// @ts-ignore
globalThis.__SVELTEKIT_PAYLOAD__ = globalThis.__SVELTEKIT_PAYLOAD__ || { data: {} };
