import { fail } from '@sveltejs/kit';
import { env, publicQueue, submit, suggestions } from '#lib/server/submissions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	turnstileSiteKey: env('TURNSTILE_SITE_KEY') ?? null,
	suggestions: suggestions(),
	queue: await publicQueue()
});

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		// Fly puts the visitor's address in Fly-Client-IP (and overwrites any
		// sent by the client); elsewhere, the socket address.
		const ip = request.headers.get('fly-client-ip') ?? getClientAddress();
		const result = await submit(await request.formData(), ip);
		if (!result.ok) return fail(400, result);
		return result;
	}
};
