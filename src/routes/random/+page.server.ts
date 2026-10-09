import { filtersToQuery, parseFilters } from '#lib/filters.ts';
import { randomMotions, shuffledMotions } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const filters = parseFilters(url.searchParams);

	// Infinite: a fresh shuffle each load, paged in by the list as you scroll.
	if (url.searchParams.get('count') === 'infinite') {
		const seed = Math.floor(Math.random() * 1_000_000_000);
		const query = filtersToQuery(filters);
		return {
			mode: 'infinite' as const,
			motions: shuffledMotions(filters, seed),
			query: `${query ? `${query}&` : '?'}shuffle=${seed}`
		};
	}

	const count = url.searchParams.get('count') === '20' ? 20 : 1;
	return {
		mode: count === 20 ? ('twenty' as const) : ('one' as const),
		motions: randomMotions(filters, count),
		query: ''
	};
};
