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
import { GENRE_TAGS, MAIN_GENRES, SECONDARY_GENRES } from '#lib/server/genres.ts';
import { motionsWithNotes, notedMotions } from '#lib/server/notes.ts';
import { STYLE_GROUPS } from '../../../scripts/motions.js';

export const db = new DatabaseSync('motions.db', { readOnly: true });

const styleRank = (group: string) => STYLE_GROUPS.indexOf(group);

// The Format filter lists these debate styles; "Other" covers every other one
// (Lincoln-Douglas, Public Forum, CanPar, ...).
const FORMATS = ['BP', 'Asians/Australs', 'World Schools'];
const OTHER_FORMAT = 'Other';

// word_start(text, word): whether `word` appears at the start of a word in
// `text`, ignoring case, so "hart" finds "Hart House" and "hartes" but not
// "charter". The regexes are cached, as each search runs it on many rows.
const wordStarts = new Map<string, RegExp>();
db.function('word_start', { deterministic: true }, (text, word) => {
	if (typeof text !== 'string' || typeof word !== 'string') return 0;
	let re = wordStarts.get(word);
	if (!re) {
		if (wordStarts.size > 500) wordStarts.clear();
		re = new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu');
		wordStarts.set(word, re);
	}
	return re.test(text) ? 1 : 0;
});

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
	// YYYY-MM-DD; only for motions added with the admin tools.
	date: string | null;
	// The date, or January 1st of year_est: what "latest" sorts by.
	sort_date: string;
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

	// Every search word must start a word in the motion, infoslide or
	// tournament name. LIKE quickly rules out rows without it anywhere; then
	// word_start checks it's at the start of a word.
	for (const word of filters.q.split(/\s+/).filter(Boolean)) {
		const column = (name: string) => `(${name} LIKE ? ESCAPE '\\' AND word_start(${name}, ?))`;
		clauses.push(`(${column('motion')} OR ${column('infoslide')} OR ${column('tournament_name')})`);
		const pattern = `%${word.replace(/[\\%_]/g, '\\$&')}%`;
		params.push(pattern, word, pattern, word, pattern, word);
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
		const tags = [...new Set(filters.type.flatMap((t) => GENRE_TAGS.get(t) ?? [t]))];
		clauses.push(
			`id IN (SELECT motion_id FROM motion_types WHERE type IN (${placeholders(tags)}))`
		);
		params.push(...tags);
	}
	if (filters.style.length) {
		const picked = filters.style.filter((f) => FORMATS.includes(f));
		const either = [`style_group IN (${placeholders(picked)})`];
		if (filters.style.includes(OTHER_FORMAT)) {
			either.push(`style_group NOT IN (${placeholders(FORMATS)})`);
		}
		clauses.push(`(${either.join(' OR ')})`);
		params.push(...picked);
		if (filters.style.includes(OTHER_FORMAT)) params.push(...FORMATS);
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

// Newest tournaments first (by date, or year; see scripts/motions.js), then
// rounds in order: in-rounds by number, then outrounds through the grand final.
export function latestMotions(filters: Filters, offset = 0, limit = PAGE_SIZE): Motion[] {
	const w = where(filters);
	return withExtras(
		prepare(
			`SELECT * FROM motions ${w.sql} ORDER BY sort_date DESC, tournament_order, round_order, id LIMIT ? OFFSET ?`
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

// One random motion. Shuffling just the ids, then fetching the chosen row, is
// much faster than shuffling whole rows (infoslides and all).
export function randomMotion(filters: Filters): Motion | undefined {
	const w = where(filters);
	const row = prepare(
		`SELECT * FROM motions WHERE id = (SELECT id FROM motions ${w.sql} ORDER BY RANDOM() LIMIT 1)`
	).get(...w.params) as MotionRow | undefined;
	return row && withExtras([row])[0];
}

// Main genres, then the secondary ones with their group and the main genre
// they show up under.
function genreOptions(): FilterOption[] {
	const count = (name: string) => {
		const tags = [...new Set(GENRE_TAGS.get(name)!)];
		return (
			db
				.prepare(
					`SELECT COUNT(DISTINCT motion_id) AS n FROM motion_types WHERE type IN (${tags.map(() => '?').join(', ')})`
				)
				.get(...tags) as { n: number }
		).n;
	};
	return [
		...MAIN_GENRES.map(({ name }) => ({ value: name, count: count(name) })),
		...SECONDARY_GENRES.flatMap(({ group, main, genres }) =>
			genres.map((g) => ({ value: g.name, count: count(g.name), group, parent: g.main ?? main }))
		)
	];
}

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
		type: genreOptions(),
		style: (() => {
			const counts = db
				.prepare('SELECT style_group AS value, COUNT(*) AS count FROM motions GROUP BY style_group')
				.all() as { value: string; count: number }[];
			const other = counts
				.filter((c) => !FORMATS.includes(c.value))
				.reduce((n, c) => n + c.count, 0);
			return [
				...counts
					.filter((c) => FORMATS.includes(c.value))
					.sort((a, b) => styleRank(a.value) - styleRank(b.value)),
				{ value: OTHER_FORMAT, count: other }
			];
		})(),
		level: db
			.prepare(
				// Only University, School and Mixed; "Other" is just motions with no level.
				"SELECT level_group AS value, COUNT(*) AS count FROM motions WHERE level_group != 'Other' GROUP BY level_group ORDER BY count DESC"
			)
			.all() as { value: string; count: number }[]
	};
	return options;
}

// For the local admin tools, after they rebuild motions.db.
export function clearFilterOptions() {
	options = undefined;
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
