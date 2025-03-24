<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { timeDataStore } from '$lib/stores/timeDataStore';
  import type { TemporalData } from '$lib/types';
  import { browser } from '$app/environment';
  
  // Props
  export let data: TemporalData[] = []; // Array of {date, count} objects
  export let height = '120px';
  
  // Local state
  let svgElement: HTMLDivElement;
  let chart: any = null;
  let width = 0;
  let margin = { top: 10, right: 30, bottom: 30, left: 40 };
  let x: any, y: any, xAxis: any, currentDateLine: any;
  let d3: any = null; // Will hold d3 modules
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  onMount(async () => {
    if (!browser) return;
    
    try {
      // Import D3 modules dynamically
      const [
        selection,
        scale,
        axis,
        shape,
        time,
        timeFormat
      ] = await Promise.all([
        import('d3-selection'),
        import('d3-scale'),
        import('d3-axis'),
        import('d3-shape'),
        import('d3-time'),
        import('d3-time-format')
      ]);
      
      // Build d3 object with imported modules
      d3 = {
        select: selection.select,
        scaleTime: scale.scaleTime,
        scaleLinear: scale.scaleLinear,
        axisBottom: axis.axisBottom,
        area: shape.area,
        curveBasis: shape.curveBasis,
        timeMonth: time.timeMonth,
        timeYear: time.timeYear,
        timeFormat: timeFormat.timeFormat
      };
      
      initChart();
      
      // Set up resize observer
      const resizeObserver = new ResizeObserver(entries => {
        if (entries.length > 0) {
          updateChartDimensions();
        }
      });
      
      resizeObserver.observe(svgElement.parentNode as Element);
      
      return () => {
        resizeObserver.disconnect();
      };
    } catch (error) {
      console.error('Error initializing timeline:', error);
    }
  });
  
  // Initialize the chart
  function initChart() {
    if (!d3 || !svgElement) return;
    
    // Create SVG
    chart = d3.select(svgElement)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height);
    
    // Create chart group with margins
    const g = chart.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create scales, axes, and paths
    x = d3.scaleTime();
    y = d3.scaleLinear();
    
    // Create X axis
    xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${parseInt(height) - margin.top - margin.bottom})`);
    
    // Create area path
    g.append('path')
      .attr('class', 'area-path')
      .attr('fill', '#4a86e8')
      .attr('fill-opacity', 0.6);
    
    // Create current date indicator
    currentDateLine = g.append('line')
      .attr('class', 'current-date-line')
      .attr('stroke', 'red')
      .attr('stroke-width', 2)
      .attr('y1', 0);
    
    // Update dimensions and data
    updateChartDimensions();
  }
  
  // Update chart dimensions on resize
  function updateChartDimensions() {
    if (!chart || !d3) return;
    
    // Get container width
    const container = svgElement.parentNode as Element;
    width = container.getBoundingClientRect().width;
    
    // Update SVG dimensions
    chart
      .attr('width', width)
      .attr('height', height);
    
    // Update scales
    x.range([0, width - margin.left - margin.right]);
    y.range([parseInt(height) - margin.top - margin.bottom, 0]);
    
    // Update current date line
    currentDateLine
      .attr('y2', parseInt(height) - margin.top - margin.bottom);
    
    // Update chart with new data
    updateChart();
  }
  
  // Update chart with new data
  function updateChart() {
    if (!chart || !d3 || !data || data.length === 0) return;
    
    // Set domains
    const dateExtent = [
      data[0].date,
      data[data.length - 1].date
    ];
    
    const maxCount = Math.max(...data.map(d => d.count));
    
    x.domain(dateExtent);
    y.domain([0, maxCount * 1.1]); // Add 10% padding
    
    // Update X axis
    xAxis.call(d3.axisBottom(x)
      .ticks(width > 600 ? 10 : 5)
      .tickFormat(d3.timeFormat('%b %Y')));
    
    // Create area generator
    const areaGenerator = d3.area()
      .curve(d3.curveBasis)
      .x((d: any) => x(d.date))
      .y0(parseInt(height) - margin.top - margin.bottom)
      .y1((d: any) => y(d.count));
    
    // Update area path
    chart.select('.area-path')
      .datum(data)
      .attr('d', areaGenerator);
    
    // Update current date indicator
    updateCurrentDateIndicator($timeDataStore.currentDate);
  }
  
  // Play/pause timeline animation
  function togglePlayback() {
    timeDataStore.update((state: any) => ({
      ...state,
      playing: !state.playing
    }));
  }
  
  // Handle user clicking or keying on timeline
  function handleTimelineInteraction(event: MouseEvent | KeyboardEvent) {
    if (!chart || !x || !data.length) return;
    
    // For keyboard events, only respond to Enter or Space
    if (event instanceof KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
    }
    
    // Get click position
    const container = svgElement.getBoundingClientRect();
    const clientX = event instanceof MouseEvent ? event.clientX : container.left + container.width / 2;
    const clickX = clientX - container.left - margin.left;
    
    // Convert to date
    const date = x.invert(clickX);
    
    // Update current date
    timeDataStore.update((state: any) => ({
      ...state,
      currentDate: date
    }));
    
    // Dispatch event
    dispatch('dateSelected', { date });
  }
  
  // Handle keyboard navigation on the timeline
  function handleKeyDown(event: KeyboardEvent) {
    if (!chart || !x || !data.length) return;
    
    const state = $timeDataStore;
    let newDate = new Date(state.currentDate);
    
    // Handle arrow keys
    if (event.key === 'ArrowLeft') {
      // Move back by one day
      newDate.setDate(newDate.getDate() - 1);
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      // Move forward by one day
      newDate.setDate(newDate.getDate() + 1);
      event.preventDefault();
    } else if (event.key === 'Home') {
      // Jump to start
      newDate = new Date(state.range.start);
      event.preventDefault();
    } else if (event.key === 'End') {
      // Jump to end
      newDate = new Date(state.range.end);
      event.preventDefault();
    } else {
      return;
    }
    
    // Keep within range
    if (newDate < state.range.start) {
      newDate = new Date(state.range.start);
    } else if (newDate > state.range.end) {
      newDate = new Date(state.range.end);
    }
    
    // Update current date
    timeDataStore.update((s: any) => ({
      ...s,
      currentDate: newDate
    }));
    
    // Update visualization
    updateCurrentDateIndicator(newDate);
  }
  
  // Update the current date indicator
  function updateCurrentDateIndicator(date: Date) {
    if (!chart || !x) return;
    
    // Position line at current date
    const xPos = x(date);
    
    chart.select('.current-date-line')
      .attr('x1', xPos)
      .attr('x2', xPos);
  }
  
  // Watch for changes to data
  $: if (browser && chart && d3 && data && data.length > 0) {
    updateChart();
  }
  
  // Watch for changes to current date
  $: if (browser && chart && x && $timeDataStore.currentDate) {
    updateCurrentDateIndicator($timeDataStore.currentDate);
  }
</script>

<div class="timeline-container">
  <div class="controls">
    <button class="play-button" on:click={togglePlayback}>
      {$timeDataStore.playing ? 'Pause' : 'Play'}
    </button>
    
    <span class="current-date">
      {$timeDataStore.currentDate.toLocaleDateString()}
    </span>
    
    <div class="speed-control">
      <label for="speed">Speed:</label>
      <input 
        id="speed" 
        type="range" 
        min="0.1" 
        max="5" 
        step="0.1" 
        bind:value={$timeDataStore.playbackSpeed}
      />
      <span>{$timeDataStore.playbackSpeed}x</span>
    </div>
  </div>
  
  <div 
    class="chart" 
    bind:this={svgElement} 
    on:click={handleTimelineInteraction}
    on:keydown={handleKeyDown}
    on:keypress={handleTimelineInteraction}
    role="slider"
    tabindex="0"
    aria-label="Timeline slider - click or use arrow keys to navigate through time"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow="50"
  >
    <!-- D3 will append SVG here -->
  </div>
</div>

<style>
  .timeline-container {
    width: 100%;
    background-color: white;
    border-radius: 4px;
    padding: 10px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .controls {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    gap: 15px;
  }
  
  .play-button {
    padding: 5px 10px;
    background-color: #4a86e8;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .current-date {
    font-weight: bold;
    min-width: 120px;
  }
  
  .speed-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .chart {
    width: 100%;
    height: 100px;
    overflow: hidden;
    cursor: pointer;
    outline: none;
  }
  
  .chart:focus {
    box-shadow: 0 0 0 2px #4a86e8;
  }
  
  :global(.x-axis text) {
    font-size: 10px;
  }
  
  :global(.current-date-line) {
    pointer-events: none;
  }
</style> 