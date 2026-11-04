// The Recorded rounds page: its rounds (filtered, and optionally one
// channel's), a page at a time for infinite scrolling.
import { filtersToQuery, parseFilters } from '#lib/filters.ts';
import { recordedChannels, recordedMotions, type Motion } from '#lib/server/db.ts';

// A multiple of both column counts (2 and 3), so every page fills its rows.
export const VIDEO_PAGE_SIZE = 24;

// A channel's handle without the "@", e.g. "hwsroundrobin", for ?channel=.
const handleOf = (link: string) => link.replace(/\/+$/, '').split('/').pop()!.replace(/^@/, '');

export function videoChannels() {
	return recordedChannels().map((c) => ({ ...c, handle: handleOf(c.link) }));
}

export function recordedPage(params: URLSearchParams, offset = 0, limit = VIDEO_PAGE_SIZE) {
	const filters = parseFilters(params);
	const channel = videoChannels().find((c) => c.handle === params.get('channel')) ?? null;

	let motions: Motion[] = recordedMotions(filters);
	// One channel picked: only its videos, and only the rounds it recorded.
	if (channel) {
		motions = motions
			.map((m) => ({ ...m, videos: m.videos?.filter((v) => v.channel === channel.url) }))
			.filter((m) => m.videos?.length);
	}

	// The filters and channel as a query string (e.g. "?q=x&channel=y"), for
	// fetching the next pages.
	const query = new URLSearchParams(filtersToQuery(filters));
	if (channel) query.set('channel', channel.handle);
	const queryString = query.size ? `?${query}` : '';

	return {
		selected: channel?.handle ?? null,
		query: queryString,
		rounds: motions.length,
		videoCount: motions.reduce((n, m) => n + (m.videos?.length ?? 0), 0),
		motions: motions.slice(offset, offset + limit)
	};
}
