import { json } from '@sveltejs/kit';
import { recordedPage } from '#lib/server/recorded.ts';
import type { RequestHandler } from './$types';

// The next page of the Recorded rounds grid, for the same filters and channel.
export const GET: RequestHandler = ({ url }) => {
	const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
	return json(recordedPage(url.searchParams, offset).motions);
};
