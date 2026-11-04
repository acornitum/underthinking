// Find recorded rounds on YouTube and match them to motions, for the
// "Recorded rounds" page.
//
//   node scripts/videos.js   (npm run videos:update)
//
// Lists every upload on each channel below with yt-dlp (no API key needed;
// set YTDLP to use a different binary, e.g. a newer one than Homebrew's), reads
// the year and round from each title, and matches it to that edition's motion
// in motions.db. Writes data/videos.json: the matched videos, plus the ones it
// couldn't match (no motion for that round in the CSV, or not a round at all)
// so they can be checked by hand.
//
// A match needs exactly one motion for the round: tournaments that set
// different motions per bracket (e.g. "Round 1-A" and "Round 1-B") only match
// when both brackets got the same motion.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(ROOT, 'data', 'videos.json');
const YTDLP = process.env.YTDLP || 'yt-dlp';

// Each channel's uploads, and which tournaments in the CSV they're from.
// Editions are told apart by year (`year_est`), as some share one name.
const CHANNELS = [
	{
		url: 'https://www.youtube.com/@hwsroundrobin/videos',
		tournaments: /^HWS (Round Robin|RR)\b/
	}
];

const FINAL_ORDERS = new Set([140, 150]);

// "2025 HWS Open Round Robin- Round 2, Stern 204" → { year: 2025, round: 2,
// label: 'Stern 204' }. Finals get round 'final'; titles with no round
// (keynotes and the like) get null.
function parseTitle(title) {
	const year = title.match(/\b(20\d\d)\b/)?.[1];
	const numbered = title.match(/round\s*(\d+)/i);
	const final = !numbered && title.match(/\bfinals?\b(?: round)?/i);
	if (!year || !(numbered || final)) return null;
	const rest = title.slice((numbered ?? final).index + (numbered ?? final)[0].length);
	const label = rest
		.replace(/\bSD 480p\b/i, '')
		.replace(/\(\w+ \d+, \d{4}\)/, '')
		.replace(/\(([^)]*)\)/g, ' $1 ')
		.replace(/^[\s,:\-–—]+|[\s,:\-–—]+$/g, '')
		.replace(/\s+/g, ' ');
	return { year: Number(year), round: numbered ? Number(numbered[1]) : 'final', label };
}

function roundKey(roundOrder) {
	if (FINAL_ORDERS.has(roundOrder)) return 'final';
	return roundOrder > 0 && roundOrder < 100 ? roundOrder : null;
}

// Motions are sometimes entered twice with small differences (a dropped word,
// a missing full stop, or the infoslide pasted onto the end), so two motions
// count as the same when nearly all the shorter one's words are in the other.
const words = (motion) => new Set(motion.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

function sameMotion(a, b) {
	const [x, y] = [words(a), words(b)];
	const shared = [...x].filter((w) => y.has(w)).length;
	return shared / Math.min(x.size, y.size) >= 0.8;
}

// The cleanest of a round's copies: the shortest (so not one with the
// infoslide pasted in), then the first.
const trimmedLength = (r) => r.motion.replace(/[.\s]+$/, '').length;
const cleanest = (rows) =>
	rows.reduce((a, b) =>
		trimmedLength(b) < trimmedLength(a) || (trimmedLength(b) === trimmedLength(a) && b.id < a.id)
			? b
			: a
	);

// Year → round → the motion rows set in it.
function motionsByRound(db, tournaments) {
	const rows = db
		.prepare('SELECT id, tournament_name, round, motion, year_est, round_order FROM motions')
		.all()
		.filter((r) => tournaments.test(r.tournament_name));
	const byRound = new Map();
	for (const r of rows) {
		const key = roundKey(r.round_order);
		if (key === null || r.year_est === null) continue;
		const id = `${r.year_est}|${key}`;
		if (!byRound.has(id)) byRound.set(id, []);
		byRound.get(id).push(r);
	}
	return byRound;
}

function listUploads(url) {
	const out = execFileSync(YTDLP, ['--flat-playlist', '--print', '%(id)s\t%(title)s', url], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
		stdio: ['ignore', 'pipe', 'inherit']
	});
	return out
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [id, ...title] = line.split('\t');
			return { id, title: title.join('\t').trim() };
		});
}

function update() {
	const db = new DatabaseSync(path.join(ROOT, 'motions.db'), { readOnly: true });
	const videos = [];
	const unmatched = [];

	for (const channel of CHANNELS) {
		const uploads = listUploads(channel.url);
		if (!uploads.length) {
			throw new Error(`No uploads found on ${channel.url}: is yt-dlp up to date?`);
		}
		const byRound = motionsByRound(db, channel.tournaments);

		for (const { id, title } of uploads) {
			const parsed = parseTitle(title);
			if (!parsed) {
				unmatched.push({ id, title, reason: 'no round in title' });
				continue;
			}
			const rows = byRound.get(`${parsed.year}|${parsed.round}`) ?? [];
			if (!rows.length || rows.some((r) => !sameMotion(r.motion, rows[0].motion))) {
				const reason = rows.length ? 'several motions for this round' : 'no motion for this round';
				unmatched.push({ id, title, reason });
				continue;
			}
			const row = cleanest(rows);
			videos.push({
				id,
				title,
				label: parsed.label,
				tournament_name: row.tournament_name,
				round: row.round,
				motion: row.motion
			});
		}
	}

	fs.writeFileSync(OUT_PATH, JSON.stringify({ videos, unmatched }, null, '\t') + '\n');
	console.log(`Matched ${videos.length} videos; ${unmatched.length} unmatched (see ${OUT_PATH}).`);
}

update();
