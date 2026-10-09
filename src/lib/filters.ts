// Sidebar filters. Selections live in the URL (?type=Law&style=BP), so they
// survive reloads and can be shared. Within a filter, options are OR'd; across
// filters they're AND'd.
export const FILTERS = [
	{ key: 'tournament', label: 'Tournaments' },
	{ key: 'type', label: 'Motion type' },
	{ key: 'style', label: 'Debate style' },
	{ key: 'level', label: 'Level' }
] as const;

export type FilterKey = (typeof FILTERS)[number]['key'];
// `q` is the search box text and `notes` the "With notes" sidebar link; both
// are matched separately from the sidebar filter boxes.
export type Filters = Record<FilterKey, string[]> & { q: string; notes: boolean };
export type FilterOption = { value: string; label?: string; count: number };

// `tournament` option: hand-picked major BP university tournaments
// from 2010 on (see scripts/major-tournaments.js).
export const MAJOR = 'major';

// The other `tournament` option: motions from 2020 onward (including 2020).
// Unlike other filters, the tournament options combine with AND.
export const RECENT = 'recent';
export const RECENT_FROM_YEAR = 2020;

// `?notes=yes` limits motions to those you've written notes for.
export const HAS_NOTES = 'yes';

export function parseFilters(params: Pick<URLSearchParams, 'get' | 'getAll'>): Filters {
	return {
		q: params.get('q')?.trim() ?? '',
		tournament: params.getAll('tournament'),
		type: params.getAll('type'),
		style: params.getAll('style'),
		level: params.getAll('level'),
		notes: params.get('notes') === HAS_NOTES
	};
}

export function filtersToQuery(filters: Filters): string {
	const params = new URLSearchParams();
	if (filters.q) params.set('q', filters.q);
	if (filters.notes) params.set('notes', HAS_NOTES);
	for (const { key } of FILTERS) for (const value of filters[key]) params.append(key, value);
	const query = params.toString();
	return query ? `?${query}` : '';
}
