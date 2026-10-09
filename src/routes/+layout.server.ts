import { notesEnabled } from '#lib/server/config.ts';
import { countMotionsWithNotes, filterOptions } from '#lib/server/db.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ depends }) => {
	// The notes page invalidates this after saving, to refresh the notes count.
	depends('app:notes');
	return {
		filterOptions: filterOptions(),
		notesEnabled,
		notesCount: notesEnabled ? countMotionsWithNotes() : 0
	};
};
