import { parseFilters, filtersToQuery } from '#lib/filters.ts';
import { countMotions, latestMotions } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const filters = parseFilters(url.searchParams);
	return {
		motions: latestMotions(filters),
		total: countMotions(filters),
		query: filtersToQuery(filters)
	};
};
