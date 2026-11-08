// The Recorded rounds page: its rounds (filtered, optionally one channel's,
// and sorted), a page at a time for infinite scrolling.
import { filtersToQuery, parseFilters } from '#lib/filters.ts';
import { recordedChannels, recordedMotions, type Motion } from '#lib/server/db.ts';

// A multiple of both column counts (2 and 3), so every page fills its rows.
export const VIDEO_PAGE_SIZE = 24;

// A channel's handle without the "@", e.g. "hwsroundrobin", for ?channel=.
const handleOf = (link: string) => link.replace(/\/+$/, '').split('/').pop()!.replace(/^@/, '');

// How the rounds are ordered (?sort=): by tournament date (the default), by
// the newest video's upload date, or by its most-watched video's views.
// Ties keep the tournament order.
export const SORTS = [
	{ value: 'tournament', label: 'Newest tournament' },
	{ value: 'posted', label: 'Recently uploaded' },
	{ value: 'views', label: 'Most watched' }
] as const;
export type Sort = (typeof SORTS)[number]['value'];

const posted = (m: Motion) =>
	m.videos?.reduce(
		(latest, v) => (v.published && v.published > latest ? v.published : latest),
		''
	) ?? '';
const views = (m: Motion) => Math.max(0, ...(m.videos ?? []).map((v) => v.views ?? 0));

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

	const sort: Sort = SORTS.find((s) => s.value === params.get('sort'))?.value ?? 'tournament';
	if (sort === 'posted') motions = motions.toSorted((a, b) => posted(b).localeCompare(posted(a)));
	if (sort === 'views') motions = motions.toSorted((a, b) => views(b) - views(a));

	// The filters, channel and sort as a query string (e.g. "?q=x&channel=y"), for
	// fetching the next pages.
	const query = new URLSearchParams(filtersToQuery(filters));
	if (channel) query.set('channel', channel.handle);
	if (sort !== 'tournament') query.set('sort', sort);
	const queryString = query.size ? `?${query}` : '';

	return {
		selected: channel?.handle ?? null,
		sort,
		query: queryString,
		rounds: motions.length,
		videoCount: motions.reduce((n, m) => n + (m.videos?.length ?? 0), 0),
		motions: motions.slice(offset, offset + limit)
	};
}
