import { parseFilters } from '#lib/filters.ts';
import { recordedChannels, recordedMotions } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

// A channel's handle without the "@", e.g. "hwsroundrobin", for ?channel=.
const handleOf = (link: string) => link.replace(/\/+$/, '').split('/').pop()!.replace(/^@/, '');

export const load: PageServerLoad = ({ url }) => {
	const channels = recordedChannels().map((c) => ({ ...c, handle: handleOf(c.link) }));
	const selected = channels.find((c) => c.handle === url.searchParams.get('channel')) ?? null;

	let motions = recordedMotions(parseFilters(url.searchParams));
	// One channel picked: only its videos, and only the rounds it recorded.
	if (selected) {
		motions = motions
			.map((m) => ({ ...m, videos: m.videos?.filter((v) => v.channel === selected.url) }))
			.filter((m) => m.videos?.length);
	}
	return {
		channels,
		selected: selected?.handle ?? null,
		motions,
		videoCount: motions.reduce((n, m) => n + (m.videos?.length ?? 0), 0)
	};
};
