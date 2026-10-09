import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';

// Notes are plain Markdown files in notes/, so the folder can be opened as an
// Obsidian vault. Each file's frontmatter `motion` property says which motion it
// belongs to; the rest of the file is the note. Files can be renamed or moved
// into subfolders freely. Other frontmatter (tags, aliases...) is preserved.
export const NOTES_DIR = path.resolve('notes');

export type Note = { body: string; updated_at: string; file: string };

// What the site writes into a note's frontmatter.
export type NoteMeta = {
	motion: string;
	tournaments: string[];
	level: string;
	style: string;
	infoslide: string | null;
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n?---(?:\r?\n|$)/;

function split(text: string) {
	const match = text.match(FRONTMATTER);
	if (!match) return { frontmatter: '', body: text };
	// The site writes one blank line after the frontmatter; don't show it as note text.
	return { frontmatter: match[1], body: text.slice(match[0].length).replace(/^\r?\n/, '') };
}

function motionOf(frontmatter: string): string | undefined {
	try {
		const motion = parseDocument(frontmatter).get('motion');
		return typeof motion === 'string' ? motion : undefined;
	} catch {
		return undefined; // malformed frontmatter: not one of our notes
	}
}

// Path → parsed motion, re-read only when a file's mtime changes.
const cache = new Map<string, { mtimeMs: number; motion: string | undefined }>();

function markdownFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (entry.name.startsWith('.')) return []; // .obsidian, .trash, etc.
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return markdownFiles(full);
		return entry.name.endsWith('.md') ? [full] : [];
	});
}

// Motion text → note file. Rescanned on every call so edits, renames and
// deletions in Obsidian show up immediately; unchanged files aren't re-read.
function index(): Map<string, string> {
	const files = markdownFiles(NOTES_DIR).sort();
	const byMotion = new Map<string, string>();
	for (const file of files) {
		const { mtimeMs } = fs.statSync(file);
		let entry = cache.get(file);
		if (entry?.mtimeMs !== mtimeMs) {
			entry = { mtimeMs, motion: motionOf(split(fs.readFileSync(file, 'utf8')).frontmatter) };
			cache.set(file, entry);
		}
		if (entry.motion && !byMotion.has(entry.motion)) byMotion.set(entry.motion, file);
	}
	for (const file of cache.keys()) if (!files.includes(file)) cache.delete(file);
	return byMotion;
}

export function getNote(motion: string): Note | undefined {
	const file = index().get(motion);
	if (!file) return undefined;
	return {
		body: split(fs.readFileSync(file, 'utf8')).body,
		updated_at: fs.statSync(file).mtime.toISOString(),
		file
	};
}

// "This house would ban X" → "ban-x"
function slug(motion: string) {
	const words = motion
		.replace(/^\s*(this house|th)\b\W*/i, '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9\s]/g, '')
		.split(/\s+/)
		.filter(Boolean);
	let name = '';
	for (const word of words) {
		if (name && name.length + word.length > 60) break;
		name = name ? `${name}-${word}` : word;
	}
	return name || 'motion';
}

function newFilePath(motion: string) {
	const base = slug(motion);
	for (let n = 1; ; n++) {
		const file = path.join(NOTES_DIR, `${n === 1 ? base : `${base}-${n}`}.md`);
		if (!fs.existsSync(file)) return file;
	}
}

// Saving empty notes deletes the file, so a cleared note doesn't show as "has notes".
export function saveNote(meta: NoteMeta, body: string): Note | undefined {
	const existing = index().get(meta.motion);
	if (!body.trim()) {
		if (existing) fs.rmSync(existing);
		return undefined;
	}

	fs.mkdirSync(NOTES_DIR, { recursive: true });
	const file = existing ?? newFilePath(meta.motion);
	const doc = parseDocument(existing ? split(fs.readFileSync(existing, 'utf8')).frontmatter : '');
	doc.set('motion', meta.motion);
	doc.set('tournaments', meta.tournaments);
	doc.set('level', meta.level);
	doc.set('style', meta.style);
	if (meta.infoslide) doc.set('infoslide', meta.infoslide);
	else doc.delete('infoslide');

	const text = `---\n${doc.toString({ lineWidth: 0 })}---\n\n${body.endsWith('\n') ? body : `${body}\n`}`;
	// Write then rename, so Obsidian never sees a half-written file.
	const temp = `${file}.tmp`;
	fs.writeFileSync(temp, text);
	fs.renameSync(temp, file);
	return { body, updated_at: new Date().toISOString(), file };
}

// Where a note file is, for display and Obsidian links.
export function noteLocation(file: string) {
	return { absolute: file, relative: path.relative(path.dirname(NOTES_DIR), file) };
}

export function notedMotions(): string[] {
	return [...index().keys()];
}

export function motionsWithNotes(motions: string[]): Set<string> {
	const noted = index();
	return new Set(motions.filter((m) => noted.has(m)));
}
