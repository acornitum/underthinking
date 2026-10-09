// Colour themes. The choice lives on <html data-theme> (set before render by
// the script in app.html) and is remembered in localStorage.
// Hazel is the default and comes first in the sidebar switch.
export const THEMES = ['hazel', 'dark', 'light', 'disc'] as const;
export type Theme = (typeof THEMES)[number];

let current = $state<Theme>('hazel');

export const theme = {
	get current() {
		return current;
	},
	// Read what app.html applied; call once on mount.
	sync() {
		const applied = document.documentElement.dataset.theme;
		current = THEMES.includes(applied as Theme) ? (applied as Theme) : 'hazel';
	},
	set(next: Theme) {
		current = next;
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem('theme', next);
		} catch {
			// Storage blocked (e.g. private mode): the choice lasts for this page only.
		}
	}
};
