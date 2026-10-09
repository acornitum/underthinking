import { json } from '@sveltejs/kit';
import { parseFilters } from '#lib/filters.ts';
import { latestMotions, shuffledMotions } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
	const filters = parseFilters(url.searchParams);
	// `shuffle=<seed>`: the random page's infinite mode, in a stable shuffled order.
	const seed = Number.parseInt(url.searchParams.get('shuffle') ?? '', 10);
	return json(
		Number.isFinite(seed) ? shuffledMotions(filters, seed, offset) : latestMotions(filters, offset)
	);
};
