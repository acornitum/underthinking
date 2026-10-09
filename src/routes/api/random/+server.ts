import { json } from '@sveltejs/kit';
import { parseFilters } from '#lib/filters.ts';
import { randomMotions } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

// One random motion matching the filters in the query string, or null.
export const GET: RequestHandler = ({ url }) => {
	return json(randomMotions(parseFilters(url.searchParams), 1)[0] ?? null);
};
