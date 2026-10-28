// Build motions.db from data/motions.csv, or update that CSV from a new export.
//
//   node scripts/motions.js build [--if-needed]   (npm run motions:build)
//   node scripts/motions.js update <export.csv>   (npm run motions:update -- <export.csv>)
//
// data/motions.csv is the source of truth (committed to git); motions.db is
// built from it and gitignored. `npm run dev` / `npm run build` run
// `build --if-needed` first, so a fresh clone gets the database automatically.
//
// The CSV is mostly ordered newest-first, and `id` preserves that order. Its
// `date` column (YYYY-MM-DD, the tournament's first day) comes from the tab's
// round times (Tabbycat tabs) or the admin tools, and is blank for the rest.
// "Latest" sorts by `sort_date`: the date, or for an undated motion the date of
// the nearest dated row below it in the CSV (if from the same year), else the
// first of January of `year_est`. `tournament_order` is the id of a tournament's
// first row, and `round_order` ranks rounds within a tournament: in-rounds by
// number, then outrounds (octos < quarters < semis < finals < grand final).
//
// Motion categories ("types", e.g. "Healthcare|Law") come from the CSV's
// `types` column and go in the `motion_types` table, one row per type.
//
// `year_est` is the year in the tournament name (or `date`), or else the year of
// the nearest dated rows (tournaments like "Oxford IV" span many editions under one name).
// `major` names the major tournament (see major-tournaments.js) for BP
// university motions from 2010 on, else NULL.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { majorGroup } from './major-tournaments.js';
import { toInt, unicodeRegex } from './unicode-regex.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CSV_PATH = path.join(ROOT, 'data', 'motions.csv');
const DB_PATH = path.join(ROOT, 'motions.db');
const MAJOR_FROM_YEAR = 2010;

const YEAR_RE = unicodeRegex(String.raw`\b(19[89]\d|20[0-4]\d)\b`, 'g');

// The (last) year in a tournament's name, e.g. 2026 for "Princeton IV 2026".
function nameYear(name) {
	const found = [...name.matchAll(YEAR_RE)];
	return found.length ? Number(found.at(-1)[1]) : null;
}

// Outround stages, checked in order (first match wins), so e.g. "Pre-Semis"
// is caught before "Semis" and "Semi Finals" before "Finals".
const OUTROUNDS = [
	[String.raw`(triple|double)[- ]?oct|pre-?octo`, 100],
	[String.raw`partial.*oct`, 105],
	[String.raw`octo|octa|octav|oitav|\br16\b|round of 16`, 110],
	[String.raw`(partial|double).*quarter|pre-?quarter`, 115],
	[String.raw`準々決勝|八强|quarter|cuarto|quarta|\bqf\b`, 120],
	[String.raw`(partial|double).*semi|pre-?semi`, 125],
	[String.raw`準決勝|四强|półfinał|semi|\bsf\b`, 130],
	[String.raw`总决赛|grand|gran |grande|гранд`, 150],
	[String.raw`決勝|决赛|final|finał|финал|\bgf\b`, 140]
].map(([pattern, rank]) => [unicodeRegex(pattern), rank]);
const UNKNOWN_ROUND = 999;
const DIGITS = unicodeRegex(String.raw`\d+`);

function roundOrder(name) {
	const s = name.toLowerCase();
	for (const [pattern, rank] of OUTROUNDS) if (pattern.test(s)) return rank;
	if (s.includes('practice')) return 0;
	const m = s.match(DIGITS);
	if (m && toInt(m[0]) < 100) return toInt(m[0]);
	return UNKNOWN_ROUND;
}

// The style filter's options, in the order the sidebar shows them.
export const STYLE_GROUPS = [
	'BP',
	'Asians/Australs',
	'World Schools',
	'Lincoln-Douglas',
	'Public Forum',
	'CanPar',
	'CNDF',
	'Other'
];

function styleGroup(style) {
	const s = style.trim().toLowerCase();
	if (s.includes('asian') || s.includes('austral')) return 'Asians/Australs';
	if (s === 'cp') return 'CanPar';
	return STYLE_GROUPS.find((g) => g.toLowerCase() === s) ?? 'Other';
}

function levelGroup(level) {
	const s = level.trim().toLowerCase();
	if (s === 'university' || s === 'unversity') return 'University';
	if (s === 'school' || s === 'schools') return 'School';
	if (s === 'mixed') return 'Mixed';
	return 'Other';
}

const norm = (text) => text.toLowerCase().split(/\s+/).filter(Boolean).join(' ');
export const splitTypes = (types) => [...new Set((types ?? '').split('|').filter(Boolean))];

// --- CSV (RFC 4180: quoted fields may contain commas, quotes and newlines) ---

function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') ((field += '"'), i++);
			else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') (row.push(field), (field = ''));
		else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			(row.push(field), rows.push(row), (row = []), (field = ''));
		} else field += c;
	}
	if (field || row.length) (row.push(field), rows.push(row));
	const [header, ...records] = rows.filter((r) => r.length > 1 || r[0]);
	return {
		header,
		records: records.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
	};
}

export function toCsv(header, records) {
	const cell = (v) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
	return [header, ...records.map((r) => header.map((h) => r[h] ?? ''))]
		.map((row) => row.map(cell).join(','))
		.join('\n')
		.concat('\n');
}

export function readCsv(file) {
	return parseCsv(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

// --- build ---

export function build() {
	const { records } = readCsv(CSV_PATH);

	const years = records.map(
		(r) => nameYear(r.tournament_name) ?? (r.date ? Number(r.date.slice(0, 4)) : null)
	);
	const dated = years.flatMap((y, i) => (y === null ? [] : [i]));

	// Rows are newest-first; an undated row takes the older of the two nearest dated rows.
	function estimateYear(i) {
		if (years[i] !== null) return years[i];
		let lo = 0;
		let hi = dated.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (dated[mid] < i) lo = mid + 1;
			else hi = mid;
		}
		const around = [lo - 1, lo]
			.filter((j) => j >= 0 && j < dated.length)
			.map((j) => years[dated[j]]);
		return around.length ? Math.min(...around) : null;
	}

	// The date of the nearest dated row below each row (older, as rows are
	// newest-first), for sorting undated rows between the dated ones.
	const olderDate = new Array(records.length).fill(null);
	for (let i = records.length - 2; i >= 0; i--) {
		olderDate[i] = records[i + 1].date || olderDate[i + 1];
	}

	// An undated row sorts with the dated row below it (and above it, as ties
	// keep CSV order), if that's from the same year; else at the start of its year.
	function sortDate(i, yearEst) {
		if (records[i].date) return records[i].date;
		const older = olderDate[i];
		if (older && yearEst !== null && Number(older.slice(0, 4)) === yearEst) return older;
		return `${yearEst ?? '0000'}-01-01`;
	}

	// Replace the tables in place (rather than deleting the file), so a running
	// dev server sees the new data without a restart. If a dev server is reading
	// at that moment, wait for it rather than failing.
	const db = new DatabaseSync(DB_PATH, { timeout: 10_000 });
	db.exec(`
		DROP TABLE IF EXISTS motion_types;
		DROP TABLE IF EXISTS motions;
		CREATE TABLE motions (
			id INTEGER PRIMARY KEY,
			motion TEXT NOT NULL,
			infoslide TEXT,
			tournament_name TEXT,
			round TEXT,
			region TEXT,
			country TEXT,
			city TEXT,
			level TEXT,
			style TEXT,
			tab_url TEXT,
			year INTEGER,
			tournament_order INTEGER,
			round_order INTEGER,
			style_group TEXT,
			level_group TEXT,
			year_est INTEGER,
			major TEXT,
			date TEXT,
			sort_date TEXT
		);
		CREATE TABLE motion_types (
			motion_id INTEGER NOT NULL REFERENCES motions(id),
			type TEXT NOT NULL,
			PRIMARY KEY (type, motion_id)
		) WITHOUT ROWID;
	`);
	const insertMotion = db.prepare(`INSERT INTO motions VALUES (${Array(20).fill('?').join(', ')})`);
	const insertType = db.prepare('INSERT INTO motion_types VALUES (?, ?)');

	const firstSeen = new Map();
	let typed = 0;
	db.exec('BEGIN');
	records.forEach((r, index) => {
		const id = index + 1;
		const yearEst = estimateYear(index);
		// Same name in different years is a different edition of the tournament.
		const editionKey = `${r.tournament_name}\u0000${yearEst}`;
		if (!firstSeen.has(editionKey)) firstSeen.set(editionKey, id);
		const style = styleGroup(r.style);
		const level = levelGroup(r.level);
		let major = majorGroup(r.tournament_name, style, level);
		if (yearEst === null || yearEst < MAJOR_FROM_YEAR) major = null;
		insertMotion.run(
			id,
			r.motion,
			r.infoslide || null,
			r.tournament_name,
			r.round,
			r.region,
			r.country,
			r.city,
			r.level,
			r.style,
			r.tab_url,
			years[index],
			firstSeen.get(editionKey),
			roundOrder(r.round),
			style,
			level,
			yearEst,
			major,
			r.date || null,
			sortDate(index, yearEst)
		);
		const types = splitTypes(r.types);
		if (types.length) typed++;
		for (const type of types) insertType.run(id, type);
	});
	db.exec('COMMIT');
	db.exec(`
		CREATE INDEX idx_motions_order ON motions(sort_date DESC, tournament_order, round_order, id);
		CREATE INDEX idx_motions_year ON motions(year);
		CREATE INDEX idx_motions_tournament ON motions(tournament_name);
		CREATE INDEX idx_motion_types_motion ON motion_types(motion_id);
		CREATE INDEX idx_motions_major ON motions(major);
	`);
	db.close();
	console.log(`Built motions.db: ${records.length} motions (${typed} with types)`);
}

function isUpToDate() {
	try {
		return fs.statSync(DB_PATH).mtimeMs >= fs.statSync(CSV_PATH).mtimeMs;
	} catch {
		return false;
	}
}

// --- update: replace data/motions.csv with a new export, keeping known types, dates and adjudicators ---

const roundKey = (r) => [r.motion, r.tournament_name, r.round].map(norm).join('\u0000');

function update(exportPath) {
	const incoming = readCsv(exportPath);
	const current = fs.existsSync(CSV_PATH) ? readCsv(CSV_PATH).records : [];

	// Types already known, by (motion, tournament) and by motion alone.
	const byPair = new Map();
	const byMotion = new Map();
	// Dates already known, by (motion, tournament).
	const dates = new Map();
	// Adjudicators already known, by (motion, tournament, round). Kept in the
	// dataset only; the site doesn't show them.
	const adjudicators = new Map();
	for (const r of current) {
		if (r.date) dates.set(`${norm(r.motion)}\u0000${norm(r.tournament_name)}`, r.date);
		if (r.adjudicators) adjudicators.set(roundKey(r), r.adjudicators);
		const types = splitTypes(r.types);
		if (!types.length) continue;
		byPair.set(`${norm(r.motion)}\u0000${norm(r.tournament_name)}`, types);
		if (!byMotion.has(norm(r.motion))) byMotion.set(norm(r.motion), types);
	}

	let header = incoming.header.includes('types')
		? incoming.header
		: [...incoming.header.slice(0, 2), 'types', ...incoming.header.slice(2)];
	if (adjudicators.size && !header.includes('adjudicators')) {
		const at = header.indexOf('style') + 1 || header.length;
		header = [...header.slice(0, at), 'adjudicators', ...header.slice(at)];
	}
	if (dates.size && !header.includes('date')) header = [...header, 'date'];
	let kept = 0;
	const records = incoming.records.map((r) => {
		const key = norm(r.motion);
		const pair = `${key}\u0000${norm(r.tournament_name)}`;
		const date = r.date || dates.get(pair) || '';
		const adj = r.adjudicators || adjudicators.get(roundKey(r)) || '';
		if (splitTypes(r.types).length) return { ...r, date, adjudicators: adj };
		const types = byPair.get(pair) ?? byMotion.get(key) ?? [];
		if (types.length) kept++;
		return { ...r, types: types.join('|'), date, adjudicators: adj };
	});

	fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
	fs.writeFileSync(CSV_PATH, toCsv(header, records));
	console.log(
		`Updated data/motions.csv: ${records.length} motions (was ${current.length}); ` +
			`types carried over for ${kept}`
	);
	build();
}

// The functions above are also imported by the local admin tools, so only run
// a command when this file is run directly.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [command, arg] = process.argv.slice(2);
	if (command === 'build') {
		if (arg === '--if-needed' && isUpToDate()) process.exit(0);
		build();
	} else if (command === 'update' && arg) {
		update(path.resolve(arg));
	} else {
		console.error('Usage: node scripts/motions.js build [--if-needed] | update <export.csv>');
		process.exit(1);
	}
}
