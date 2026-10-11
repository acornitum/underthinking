import type { Component } from 'svelte';
import { dev } from '$app/env';

// Local-only admin tools (adding and editing motions) live in src/lib/admin/
// and src/routes/admin/, which are gitignored and left out of the Docker image.
// The site renders their components through these slots, which are empty when
// the folder is missing (a clone, the deployed site) or outside `npm run dev`.
const modules = import.meta.glob<Component<any>>('/src/lib/admin/slots/*.svelte', {
	eager: true,
	import: 'default'
});

export function adminSlot(
	name: 'SidebarNav' | 'SidebarToggle' | 'MotionActions' | 'TournamentActions'
) {
	return dev ? modules[`/src/lib/admin/slots/${name}.svelte`] : undefined;
}

// Everything only the admin sees gets this orange dashed outline. (Kept here,
// not in src/lib/admin/, so the site layout can outline admin-only pages.)
export const ADMIN_OUTLINE = 'outline-2 -outline-offset-2 outline-dashed outline-orange-400';

export function isAdminPage(pathname: string) {
	return dev && pathname.startsWith('/admin/');
}
