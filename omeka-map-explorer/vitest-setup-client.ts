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

// Mock WebGL context for Sigma.js and other graphics libraries
class WebGLRenderingContextMock {
	canvas: HTMLCanvasElement = null!;
	constructor() {}
}

// Mock WebGL2 context
class WebGL2RenderingContextMock extends WebGLRenderingContextMock {
	constructor() {
		super();
	}
}

// Add WebGL context constructors to global scope
// @ts-ignore
globalThis.WebGLRenderingContext = globalThis.WebGLRenderingContext || WebGLRenderingContextMock;
// @ts-ignore  
globalThis.WebGL2RenderingContext = globalThis.WebGL2RenderingContext || WebGL2RenderingContextMock;

// Mock HTMLCanvasElement getContext method to return mock WebGL contexts
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(function(contextType: string, options?: any) {
	if (contextType === 'webgl' || contextType === 'experimental-webgl') {
		return new WebGLRenderingContextMock();
	}
	if (contextType === 'webgl2') {
		return new WebGL2RenderingContextMock();
	}
	if (contextType === '2d') {
		// Return a basic 2D context mock
		return {
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			font: '',
			textAlign: 'start',
			textBaseline: 'alphabetic',
			globalAlpha: 1,
			fillRect: vi.fn(),
			strokeRect: vi.fn(),
			clearRect: vi.fn(),
			beginPath: vi.fn(),
			closePath: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			arc: vi.fn(),
			arcTo: vi.fn(),
			fill: vi.fn(),
			stroke: vi.fn(),
			fillText: vi.fn(),
			strokeText: vi.fn(),
			measureText: vi.fn().mockReturnValue({ width: 100 }),
			save: vi.fn(),
			restore: vi.fn(),
			translate: vi.fn(),
			rotate: vi.fn(),
			scale: vi.fn(),
			setTransform: vi.fn(),
			transform: vi.fn(),
			getImageData: vi.fn(),
			putImageData: vi.fn(),
			createImageData: vi.fn(),
			roundRect: vi.fn()
		};
	}
	// Fall back to original implementation for other context types
	return originalGetContext.call(this, contextType, options);
});
