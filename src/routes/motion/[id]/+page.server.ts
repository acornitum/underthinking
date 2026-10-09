import { error } from '@sveltejs/kit';
import { getMotion } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const motion = getMotion(Number(params.id));
	if (!motion) error(404, 'Motion not found');
	return { motion };
};
