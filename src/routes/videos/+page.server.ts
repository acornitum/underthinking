import { parseFilters } from '#lib/filters.ts';
import { recordedMotions } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const motions = recordedMotions(parseFilters(url.searchParams));
	return { motions, videoCount: motions.reduce((n, m) => n + (m.videos?.length ?? 0), 0) };
};
