import { parseFilters } from '#lib/filters.ts';
import { recordedChannels, recordedMotions } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const motions = recordedMotions(parseFilters(url.searchParams));
	return {
		channels: recordedChannels(),
		motions,
		videoCount: motions.reduce((n, m) => n + (m.videos?.length ?? 0), 0)
	};
};
