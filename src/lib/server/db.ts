import { DatabaseSync, type StatementSync } from 'node:sqlite';
import {
	MAJOR,
	RECENT,
	RECENT_FROM_YEAR,
	type FilterKey,
	type FilterOption,
	type Filters
} from '#lib/filters.ts';
import { notesEnabled } from '#lib/server/config.ts';
import { motionsWithNotes, notedMotions } from '#lib/server/notes.ts';

export const db = new DatabaseSync('motions.db', { readOnly: true });

export type Motion = {
	id: number;
	motion: string;
	infoslide: string | null;
	tournament_name: string;
	round: string;
	region: string;
	country: string;
	city: string;
	level: string;
	style: string;
	tab_url: string;
	year: number | null;
	tournament_order: number;
	round_order: number;
	style_group: string;
	level_group: string;
	year_est: number | null;
	major: string | null;
	hasNotes?: boolean;
};

// A motion as stored, before articles are attached.
type MotionRow = Omit<Motion, 'hasNotes'>;

export const PAGE_SIZE = 20;

const statements = new Map<string, StatementSync>();

function prepare(sql: string) {
	let statement = statements.get(sql);
	if (!statement) statements.set(sql, (statement = db.prepare(sql)));
	return statement;
}

function where(filters: Filters) {
	const clauses: string[] = [];
	const params: string[] = [];
	const placeholders = (values: string[]) => values.map(() => '?').join(', ');

	// Every search word must appear in the motion, infoslide or tournament name.
	for (const word of filters.q.split(/\s+/).filter(Boolean)) {
		clauses.push(
			"(motion LIKE ? ESCAPE '\\' OR infoslide LIKE ? ESCAPE '\\' OR tournament_name LIKE ? ESCAPE '\\')"
		);
		const pattern = `%${word.replace(/[\\%_]/g, '\\$&')}%`;
		params.push(pattern, pattern, pattern);
	}
	if (filters.notes && notesEnabled) {
		const noted = notedMotions();
		clauses.push(noted.length ? `motion IN (${placeholders(noted)})` : '0');
		params.push(...noted);
	}
	if (filters.tournament.includes(RECENT)) {
		clauses.push(`year_est >= ${RECENT_FROM_YEAR}`);
	}
	if (filters.tournament.includes(MAJOR)) {
		clauses.push('major IS NOT NULL');
	}
	if (filters.type.length) {
		clauses.push(
			`id IN (SELECT motion_id FROM motion_types WHERE type IN (${placeholders(filters.type)}))`
		);
		params.push(...filters.type);
	}
	if (filters.style.length) {
		clauses.push(`style_group IN (${placeholders(filters.style)})`);
		params.push(...filters.style);
	}
	if (filters.level.length) {
		clauses.push(`level_group IN (${placeholders(filters.level)})`);
		params.push(...filters.level);
	}
	return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

// Attach whether each motion has notes.
function withExtras(motions: MotionRow[]): Motion[] {
	if (!motions.length) return [];
	const withNotes = notesEnabled
		? motionsWithNotes([...new Set(motions.map((m) => m.motion))])
		: new Set<string>();
	return motions.map((m) => ({
		...m,
		infoslide: m.infoslide && tidyInfoslide(m.infoslide),
		hasNotes: withNotes.has(m.motion)
	}));
}

// Infoslides are pasted text: some have Windows line endings, trailing spaces,
// several blank lines between paragraphs, or hard line breaks mid-sentence
// (copied from PDFs). Keep at most one blank line, and reflow wrapped lines.
function tidyInfoslide(text: string): string {
	const paragraphs = text
		.replace(/\r\n?/g, '\n')
		.replace(/[ \t]+$/gm, '')
		.trim()
		.split(/\n{2,}/);
	return paragraphs.map(reflow).join('\n\n');
}

const LIST_ITEM = /^\s*([-•*–]|\d+[.)]|[a-z][.)])\s/i;
const WRAPPED_LINE_MIN = 50;

// Join a paragraph's lines into flowing text, except where a line break looks
// deliberate: before a list item, or after a short line (a heading or list end).
function reflow(paragraph: string): string {
	const lines = paragraph.split('\n');
	let out = lines[0];
	for (let i = 1; i < lines.length; i++) {
		const previous = lines[i - 1];
		const deliberate = LIST_ITEM.test(lines[i]) || previous.trim().length < WRAPPED_LINE_MIN;
		out += (deliberate ? '\n' : ' ') + lines[i].trimStart();
	}
	return out;
}

// Newest tournaments first (the source CSV is ordered newest-first), then
// rounds in order: in-rounds by number, then outrounds through the grand final.
export function latestMotions(filters: Filters, offset = 0, limit = PAGE_SIZE): Motion[] {
	const w = where(filters);
	return withExtras(
		prepare(
			`SELECT * FROM motions ${w.sql} ORDER BY tournament_order, round_order, id LIMIT ? OFFSET ?`
		).all(...w.params, limit, offset) as MotionRow[]
	);
}

export function getMotion(id: number): Motion | undefined {
	const row = prepare('SELECT * FROM motions WHERE id = ?').get(id) as MotionRow | undefined;
	return row && withExtras([row])[0];
}

// Every matching motion in a shuffled order that's stable for a given seed, so
// "infinite" random scrolling can page through it with no repeats. The order
// comes from a multiplicative hash of the id (Knuth), offset by the seed.
export function shuffledMotions(
	filters: Filters,
	seed: number,
	offset = 0,
	limit = PAGE_SIZE
): Motion[] {
	const w = where(filters);
	return withExtras(
		prepare(
			`SELECT * FROM motions ${w.sql}
			ORDER BY ((id + ?) * 2654435761) % 4294967291, id LIMIT ? OFFSET ?`
		).all(...w.params, seed, limit, offset) as MotionRow[]
	);
}

export function countMotions(filters: Filters): number {
	const w = where(filters);
	return (prepare(`SELECT COUNT(*) AS n FROM motions ${w.sql}`).get(...w.params) as { n: number })
		.n;
}

export function randomMotions(filters: Filters, count: number): Motion[] {
	const w = where(filters);
	return withExtras(
		prepare(`SELECT * FROM motions ${w.sql} ORDER BY RANDOM() LIMIT ?`).all(
			...w.params,
			count
		) as MotionRow[]
	);
}

// Rare motion types (mostly one-off tags) are left out of the filter list.
const MIN_TYPE_COUNT = 20;

let options: Record<FilterKey, FilterOption[]> | undefined;

// Every option with its total motion count, most common first. Motion data
// doesn't change while running, so this is cached.
export function filterOptions(): Record<FilterKey, FilterOption[]> {
	options ??= {
		tournament: [
			{
				value: MAJOR,
				label: 'Majors only',
				count: (
					db.prepare('SELECT COUNT(*) AS n FROM motions WHERE major IS NOT NULL').get() as {
						n: number;
					}
				).n
			},
			{
				value: RECENT,
				label: `After ${RECENT_FROM_YEAR}`,
				count: (
					db
						.prepare('SELECT COUNT(*) AS n FROM motions WHERE year_est >= ?')
						.get(RECENT_FROM_YEAR) as { n: number }
				).n
			}
		],
		type: db
			.prepare(
				`SELECT type AS value, COUNT(*) AS count FROM motion_types
				GROUP BY type HAVING count >= ${MIN_TYPE_COUNT} ORDER BY count DESC`
			)
			.all() as FilterOption[],
		style: db
			.prepare(
				'SELECT style_group AS value, COUNT(*) AS count FROM motions GROUP BY style_group ORDER BY count DESC'
			)
			.all() as FilterOption[],
		level: db
			.prepare(
				'SELECT level_group AS value, COUNT(*) AS count FROM motions GROUP BY level_group ORDER BY count DESC'
			)
			.all() as FilterOption[]
	};
	return options;
}

// How many motions have notes (live, unlike filterOptions).
export function countMotionsWithNotes(): number {
	return countMotions({ q: '', tournament: [], type: [], style: [], level: [], notes: true });
}

// Every tournament and round a motion was set at, newest first, e.g. "Princeton IV 2026 (Round 2)".
export function motionAppearances(motion: string): string[] {
	const rows = prepare(
		'SELECT tournament_name, round FROM motions WHERE motion = ? ORDER BY tournament_order, round_order'
	).all(motion) as { tournament_name: string; round: string }[];
	return [...new Set(rows.map((r) => `${r.tournament_name} (${r.round})`))];
}
