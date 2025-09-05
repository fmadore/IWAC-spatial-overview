import type { TemporalData } from '$lib/types';

interface TimeDataState {
	data: TemporalData[];
	range: { start: Date; end: Date };
	currentDate: Date;
}

export const timeData = $state<TimeDataState>({
	data: [],
	range: { start: new Date('1900-01-01'), end: new Date('2023-12-31') },
	currentDate: new Date('1900-01-01')
});
