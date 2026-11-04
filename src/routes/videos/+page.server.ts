import { parseFilters } from '#lib/filters.ts';
import { recordedRounds } from '#lib/server/videos.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const rounds = recordedRounds(parseFilters(url.searchParams));
	return { rounds, videoCount: rounds.reduce((n, r) => n + r.videos.length, 0) };
};
