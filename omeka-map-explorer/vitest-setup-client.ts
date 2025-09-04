import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	enumerable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// add more mocks here if you need them

// Minimal SvelteKit payload shim so runtime imports don't explode in jsdom
// @ts-ignore
globalThis.__SVELTEKIT_PAYLOAD__ = globalThis.__SVELTEKIT_PAYLOAD__ || { data: {} };

// jsdom doesn't implement ResizeObserver; provide a lightweight stub
class ResizeObserverStub {
	callback: ResizeObserverCallback;
	constructor(cb: ResizeObserverCallback) {
		this.callback = cb;
	}
	observe() {}
	unobserve() {}
	disconnect() {}
}
// @ts-ignore
globalThis.ResizeObserver = (globalThis as any).ResizeObserver || ResizeObserverStub;
