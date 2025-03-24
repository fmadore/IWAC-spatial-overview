import { writable } from 'svelte/store';
import type { TemporalData } from '$lib/types';

interface TimeDataState {
  data: TemporalData[];
  range: {
    start: Date;
    end: Date;
  };
  currentDate: Date;
  playing: boolean;
  playbackSpeed: number;
}

export const timeDataStore = writable<TimeDataState>({
  data: [], // Array of temporal data points
  range: {
    start: new Date('1900-01-01'),
    end: new Date('2023-12-31')
  },
  currentDate: new Date('1900-01-01'),
  playing: false,
  playbackSpeed: 1
}); 