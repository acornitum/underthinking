// One small popup message for the whole site, e.g. "Copied to clipboard!",
// shown at a point on the page (page coordinates, so it scrolls with content).
// Showing a new message replaces the current one and restarts its timer.
type Toast = { id: number; message: string; x: number; y: number };

let current = $state<Toast | null>(null);
let nextId = 0;
let timer: ReturnType<typeof setTimeout>;

export const toast = {
	get current() {
		return current;
	},
	show(message: string, at: { x: number; y: number }, duration = 1600) {
		const id = ++nextId;
		current = { id, message, ...at };
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (current?.id === id) current = null;
		}, duration);
	}
};

// A tiny hint that appears after the mouse rests on something, e.g. "Copy to
// clipboard". Moving the mouse before it shows restarts the wait.
const HINT_DELAY = 700;
let hint = $state<{ message: string; x: number; y: number } | null>(null);
let hintTimer: ReturnType<typeof setTimeout>;

export const hoverHint = {
	get current() {
		return hint;
	},
	// Call on mousemove over the element.
	move(message: string, e: MouseEvent) {
		if (hint) return; // once shown, stay put until the mouse leaves
		clearTimeout(hintTimer);
		const at = { x: e.pageX, y: e.pageY };
		hintTimer = setTimeout(() => (hint = { message, ...at }), HINT_DELAY);
	},
	// Call on mouseleave or click.
	hide() {
		clearTimeout(hintTimer);
		hint = null;
	}
};
