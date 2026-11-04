import { recordedPage, videoChannels } from '#lib/server/recorded.ts';
import type { PageServerLoad } from './$types';

// The first page of rounds; the rest load as you scroll (see /api/videos).
export const load: PageServerLoad = ({ url }) => ({
	channels: videoChannels(),
	...recordedPage(url.searchParams)
});
