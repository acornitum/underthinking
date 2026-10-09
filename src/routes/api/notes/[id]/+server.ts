import { error, json } from '@sveltejs/kit';
import { notesEnabled } from '#lib/server/config.ts';
import { getMotion, motionAppearances } from '#lib/server/db.ts';
import { noteLocation, saveNote } from '#lib/server/notes.ts';
import type { RequestHandler } from './$types';

const MAX_LENGTH = 1_000_000;

export const POST: RequestHandler = async ({ params, request }) => {
	if (!notesEnabled) error(404, 'Not found');
	const motion = getMotion(Number(params.id));
	if (!motion) error(404, 'Motion not found');
	const body = await request.text();
	if (body.length > MAX_LENGTH) error(413, 'Notes are too long');

	const note = saveNote(
		{
			motion: motion.motion,
			tournaments: motionAppearances(motion.motion),
			level: motion.level,
			style: motion.style,
			infoslide: motion.infoslide
		},
		body
	);
	return json({
		updated_at: note?.updated_at ?? null,
		file: note ? noteLocation(note.file) : null
	});
};
