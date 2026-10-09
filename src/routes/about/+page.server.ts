import { latestCommit } from '#lib/server/latest-commit.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { commit: await latestCommit() };
};
