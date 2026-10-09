import { error } from '@sveltejs/kit';
import { notesEnabled } from '#lib/server/config.ts';
import { getMotion } from '#lib/server/db.ts';
import { getNote, noteLocation } from '#lib/server/notes.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	if (!notesEnabled) error(404, 'Not found');
	const motion = getMotion(Number(params.id));
	if (!motion) error(404, 'Motion not found');
	const note = getNote(motion.motion);
	return {
		motion,
		note: note ? { body: note.body, updated_at: note.updated_at } : null,
		// For the "Open in Obsidian" link and showing where the note lives.
		file: note ? noteLocation(note.file) : null
	};
};
