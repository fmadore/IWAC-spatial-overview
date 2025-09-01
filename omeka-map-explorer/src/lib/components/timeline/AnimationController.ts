import { timeData } from '$lib/state/timeData.svelte';

let animationFrame: number | null = null;
let lastTimestamp: number = 0;

// Start animation loop
export function startAnimation() {
	if (animationFrame) return;

	lastTimestamp = performance.now();
	animationFrame = requestAnimationFrame(animationLoop);
}

// Stop animation loop
export function stopAnimation() {
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}
}

// Animation loop
function animationLoop(timestamp: number) {
	const state = timeData;

	if (!state.playing) {
		animationFrame = null;
		return;
	}

	const elapsed = timestamp - lastTimestamp;
	lastTimestamp = timestamp;

	// Calculate time progression
	const msPerDay = 1000 / state.playbackSpeed;
	const daysToAdvance = elapsed / msPerDay;

	// Create new date
	const newDate = new Date(state.currentDate);
	newDate.setDate(newDate.getDate() + daysToAdvance);

	// Check if we've reached the end
	if (newDate > state.range.end) {
		timeData.currentDate = state.range.start;
		timeData.playing = false;
		animationFrame = null;
		return;
	}

	// Update current date
	timeData.currentDate = newDate;

	// Continue animation loop
	animationFrame = requestAnimationFrame(animationLoop);
}

// Initialize animation listeners
export function initialize() {
	// Polling effect: minimal overhead approach; could be replaced with $effect in Svelte component
	const check = () => {
		if (timeData.playing && !animationFrame) {
			startAnimation();
		} else if (!timeData.playing && animationFrame) {
			stopAnimation();
		}
		requestAnimationFrame(check);
	};
	requestAnimationFrame(check);
}
