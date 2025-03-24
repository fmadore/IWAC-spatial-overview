import { get } from 'svelte/store';
import { timeDataStore } from '$lib/stores/timeDataStore';

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
  const state = get(timeDataStore);
  
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
    timeDataStore.update(s => ({
      ...s,
      currentDate: s.range.start,
      playing: false
    }));
    animationFrame = null;
    return;
  }
  
  // Update current date
  timeDataStore.update(s => ({
    ...s,
    currentDate: newDate
  }));
  
  // Continue animation loop
  animationFrame = requestAnimationFrame(animationLoop);
}

// Initialize animation listeners
export function initialize() {
  timeDataStore.subscribe(state => {
    if (state.playing && !animationFrame) {
      startAnimation();
    } else if (!state.playing && animationFrame) {
      stopAnimation();
    }
  });
} 