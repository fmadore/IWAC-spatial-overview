/**
 * Reusable bubble scaling and color utilities for map visualizations
 * Used by both WorldMap and EntityMap components for consistent styling
 */

import { scaleSequential } from 'd3-scale';

export interface BubbleStyleConfig {
  /** Base radius for smallest bubbles */
  baseRadius: number;
  /** Maximum radius for largest bubbles */
  maxRadius: number;
  /** Border weight for circles */
  borderWeight: number;
  /** Fill opacity */
  fillOpacity: number;
  /** Border opacity */
  borderOpacity: number;
  /** Use white border for high contrast (default: true) */
  useWhiteBorder: boolean;
}

export interface BubbleStyle {
  radius: number;
  fillColor: string;
  borderColor: string;
  weight: number;
  opacity: number;
  fillOpacity: number;
}

export interface ColorScale {
  (value: number): string;
  domain(): [number, number];
  range(): string[];
  interpolator(): (t: number) => string;
}

/**
 * Creates a D3 color scale with high-contrast color interpolation
 * Optimized for maximum visual distinction between different values
 */
export function createBubbleColorScale(maxCount: number): ColorScale {
  return scaleSequential()
    .domain([1, maxCount])
    .interpolator((t: number): string => {
      // Custom interpolator for maximum visual impact
      if (t < 0.2) return '#3b82f6'; // Blue for low values
      if (t < 0.4) return '#10b981'; // Green for low-medium values  
      if (t < 0.6) return '#f59e0b'; // Orange for medium values
      if (t < 0.8) return '#ef4444'; // Red for high values
      return '#dc2626'; // Dark red for highest values
    }) as ColorScale;
}

/**
 * Alternative HSL-based color scale (legacy approach)
 * Provides blue-to-red gradient based on intensity
 */
export function createHSLColorScale(count: number, maxCount: number): { fillColor: string; borderColor: string } {
  const intensity = Math.sqrt(count / maxCount);
  const hue = 220 - intensity * 60; // Blue to red
  const saturation = 70 + intensity * 20;
  const lightness = 55 - intensity * 10;
  
  return {
    fillColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    borderColor: `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`
  };
}

/**
 * Calculates bubble radius based on count and configuration
 * Uses square root scaling for better visual distribution
 */
export function calculateBubbleRadius(
  count: number, 
  maxCount: number, 
  config: Pick<BubbleStyleConfig, 'baseRadius' | 'maxRadius'>
): number {
  const normalizedCount = Math.pow(count / maxCount, 0.5); // Square root for better distribution
  return config.baseRadius + (config.maxRadius - config.baseRadius) * normalizedCount;
}

/**
 * Default configuration for world map bubbles (modern D3-based styling)
 */
export const WORLD_MAP_BUBBLE_CONFIG: BubbleStyleConfig = {
  baseRadius: 3,
  maxRadius: 25,
  borderWeight: 1.5,
  fillOpacity: 0.9,
  borderOpacity: 1,
  useWhiteBorder: true
};

/**
 * Default configuration for entity map bubbles (classic HSL-based styling)
 */
export const ENTITY_MAP_BUBBLE_CONFIG: BubbleStyleConfig = {
  baseRadius: 6,
  maxRadius: 14,
  borderWeight: 2,
  fillOpacity: 0.7,
  borderOpacity: 0.9,
  useWhiteBorder: false
};

/**
 * Creates complete bubble styling for D3-based approach (WorldMap)
 */
export function createD3BubbleStyle(
  count: number,
  maxCount: number,
  colorScale: ColorScale,
  config: BubbleStyleConfig = WORLD_MAP_BUBBLE_CONFIG
): BubbleStyle {
  const radius = calculateBubbleRadius(count, maxCount, config);
  const fillColor = colorScale(count);
  
  return {
    radius,
    fillColor,
    borderColor: config.useWhiteBorder ? '#ffffff' : colorScale(Math.min(count * 1.5, maxCount)),
    weight: config.borderWeight,
    opacity: config.borderOpacity,
    fillOpacity: config.fillOpacity
  };
}

/**
 * Creates complete bubble styling for HSL-based approach (EntityMap)
 */
export function createHSLBubbleStyle(
  count: number,
  maxCount: number,
  config: BubbleStyleConfig = ENTITY_MAP_BUBBLE_CONFIG
): BubbleStyle {
  const intensity = Math.sqrt(count / maxCount);
  const radius = config.baseRadius + config.maxRadius * intensity;
  const colors = createHSLColorScale(count, maxCount);
  
  return {
    radius,
    fillColor: colors.fillColor,
    borderColor: colors.borderColor,
    weight: config.borderWeight,
    opacity: config.borderOpacity,
    fillOpacity: config.fillOpacity
  };
}

/**
 * Creates legend entries for color scale visualization
 */
export function createLegendEntries(
  colorScale: ColorScale,
  maxCount: number,
  steps: number = 5
): Array<{ value: number; color: string; label: string }> {
  const entries = [];
  const [minValue, maxValue] = colorScale.domain();
  
  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    const value = Math.round(minValue + ratio * (maxValue - minValue));
    const color = colorScale(value);
    
    // Format label based on value range
    let label: string;
    if (value === maxValue) {
      label = `${value}+`;
    } else if (value < 10) {
      label = value.toString();
    } else if (value < 100) {
      label = `${Math.floor(value / 10) * 10}+`;
    } else {
      label = `${Math.floor(value / 100) * 100}+`;
    }
    
    entries.push({ value, color, label });
  }
  
  return entries;
}
