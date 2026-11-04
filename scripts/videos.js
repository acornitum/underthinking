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
//
// Channels added at /admin/recordings (local admin tools) are kept as they are:
// each video records its channel, and this only replaces its own channels'.
// The helpers below are shared with that page.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { roundOrder } from './motions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VIDEOS_PATH = path.join(ROOT, 'data', 'videos.json');
const YTDLP = () => process.env.YTDLP || 'yt-dlp';

// Each channel's uploads, and which tournaments in the CSV they're from.
// Editions are told apart by year (`year_est`), as some share one name.
const CHANNELS = [
	{
		url: 'https://www.youtube.com/@hwsroundrobin/videos',
		tournaments: /^HWS (Round Robin|RR)\b/
	},
	{
		url: 'https://www.youtube.com/@PrincetonDebatePanel/videos',
		tournaments: /^Princeton IV\b/
	}
];

// Outrounds in video titles, with abbreviations spelled out so roundOrder
// (scripts/motions.js) can rank them. Longest first, so "quarter finals"
// isn't read as "finals".
const OUTROUND = [
	[String.raw`partial[- ]?double[- ]?quarter[- ]?finals?|pdqfs?`, 'partial double quarterfinals'],
	[String.raw`pre-?quarter[- ]?finals?`, 'pre-quarterfinals'],
	[String.raw`quarter[- ]?finals?|qfs?`, 'quarterfinals'],
	[String.raw`semi[- ]?finals?|sfs?`, 'semifinals'],
	[String.raw`grand[- ]?finals?|finals?`, 'final']
];
const OUTROUND_RE = new RegExp(`\\b(?:${OUTROUND.map(([p]) => p).join('|')})\\b`, 'i');

// Tournaments with separate breaks (ESL, novice, ...) set each its own motions.
const BREAK_RE = /\b(esl|efl|novice|junior)\b/i;
export const breakOf = (text) => text.match(BREAK_RE)?.[1].toLowerCase() ?? 'open';

// A round's key within an edition: its break, and its number or outround
// stage. The final and grand final are the same round.
export function roundKey(name) {
	const order = roundOrder(name);
	const stage = order === 150 ? 140 : order;
	if (stage === 0 || stage === 999 || (stage >= 100 && stage < 110)) return null;
	return `${breakOf(name)}|${stage}`;
}

// "2025 HWS Open Round Robin- Round 2, Stern 204" → { year: 2025, round:
// 'open|2', label: 'Stern 204' }, "Princeton IV 2024 | QFs | Forbes" →
// { year: 2024, round: 'open|120', label: 'Forbes' }. Titles with no round
// (keynotes and the like) give null.
function parseTitle(title) {
	const year = title.match(/\b(20\d\d)\b/)?.[1];
	const match = title.match(/round\s*(\d+)/i) ?? title.match(OUTROUND_RE);
	if (!year || !match) return null;
	const name = match[1]
		? `Round ${match[1]}`
		: OUTROUND.find(([p]) => new RegExp(`^(?:${p})$`, 'i').test(match[0]))[1];
	const round = roundKey(`${breakOf(title.slice(0, match.index))} ${name}`);
	const label = title
		.slice(match.index + match[0].length)
		.replace(/\bSD 480p\b/i, '')
		.replace(/\(\w+ \d+, \d{4}\)/, '')
		.replace(/\(([^)]*)\)/g, ' $1 ')
		.replace(/^[\s,:|\-–—]+|[\s,:|\-–—]+$/g, '')
		.replace(/^room:\s*/i, '')
		.replace(/\s+/g, ' ')
		// "ROOM 4" → "Room 4"
		.replace(/\b([A-Z])([A-Z]+)\b/g, (_, first, rest) => first + rest.toLowerCase());
	return round && { year: Number(year), round, label };
}

// Motions are sometimes entered twice with small differences (a dropped word,
// a missing full stop, or the infoslide pasted onto the end), so two motions
// count as the same when nearly all the shorter one's words are in the other.
const words = (motion) => new Set(motion.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

export function sameMotion(a, b) {
	const [x, y] = [words(a), words(b)];
	const shared = [...x].filter((w) => y.has(w)).length;
	return shared / Math.min(x.size, y.size) >= 0.8;
}

// The cleanest of a round's copies: the shortest (so not one with the
// infoslide pasted in), then the first.
const trimmedLength = (r) => r.motion.replace(/[.\s]+$/, '').length;
export const cleanest = (rows) =>
	rows.reduce((a, b) =>
		trimmedLength(b) < trimmedLength(a) || (trimmedLength(b) === trimmedLength(a) && b.id < a.id)
			? b
			: a
	);

// Year → round → the motion rows set in it.
function motionsByRound(db, tournaments) {
	const rows = db
		.prepare('SELECT id, tournament_name, round, motion, year_est FROM motions')
		.all()
		.filter((r) => tournaments.test(r.tournament_name));
	const byRound = new Map();
	for (const r of rows) {
		const key = roundKey(r.round);
		if (key === null || r.year_est === null) continue;
		const id = `${r.year_est}|${key}`;
		if (!byRound.has(id)) byRound.set(id, []);
		byRound.get(id).push(r);
	}
	return byRound;
}

// Every upload on a channel ("…/@name/videos"): its id, title, view count,
// upload date (YYYY-MM-DD) and length in seconds. The date is estimated from
// YouTube's "2 years ago", which is all the channel's video list says; the
// exact one would mean opening each video. Missing numbers are null.
export async function listUploads(url) {
	const { stdout } = await promisify(execFile)(
		YTDLP(),
		[
			'--flat-playlist',
			'--extractor-args',
			'youtubetab:approximate_date',
			'--print',
			'%(id)s\t%(view_count)s\t%(upload_date)s\t%(duration)s\t%(title)s',
			url
		],
		{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
	);
	const number = (text) => (/^\d+(\.\d+)?$/.test(text) ? Math.round(Number(text)) : null);
	return stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [id, views, date, duration, ...title] = line.split('\t');
			return {
				id,
				title: title.join('\t').trim(),
				views: number(views),
				published: /^\d{8}$/.test(date)
					? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
					: null,
				duration: number(duration)
			};
		});
}

// data/videos.json: `videos` (matched, each with its channel) and `unmatched`.
export function readVideos() {
	try {
		return JSON.parse(fs.readFileSync(VIDEOS_PATH, 'utf8'));
	} catch {
		return { videos: [], unmatched: [] };
	}
}

// Replace the given channels' videos with `videos` (and `unmatched`).
export function writeVideos(channels, videos, unmatched = []) {
	const current = readVideos();
	const others = (list) => (list ?? []).filter((v) => v.channel && !channels.includes(v.channel));
	const out = {
		videos: [...others(current.videos), ...videos],
		unmatched: [...others(current.unmatched), ...unmatched]
	};
	fs.writeFileSync(VIDEOS_PATH, JSON.stringify(out, null, '\t') + '\n');
	return out;
}

async function update() {
	const db = new DatabaseSync(path.join(ROOT, 'motions.db'), { readOnly: true });
	const videos = [];
	const unmatched = [];

	for (const channel of CHANNELS) {
		const uploads = await listUploads(channel.url);
		if (!uploads.length) {
			throw new Error(`No uploads found on ${channel.url}: is yt-dlp up to date?`);
		}
		const byRound = motionsByRound(db, channel.tournaments);

		for (const { id, title, ...stats } of uploads) {
			const parsed = parseTitle(title);
			if (!parsed) {
				unmatched.push({ id, title, channel: channel.url, reason: 'no round in title' });
				continue;
			}
			const rows = byRound.get(`${parsed.year}|${parsed.round}`) ?? [];
			if (!rows.length || rows.some((r) => !sameMotion(r.motion, rows[0].motion))) {
				const reason = rows.length ? 'several motions for this round' : 'no motion for this round';
				unmatched.push({ id, title, channel: channel.url, reason });
				continue;
			}
			const row = cleanest(rows);
			videos.push({
				id,
				title,
				channel: channel.url,
				label: parsed.label,
				tournament_name: row.tournament_name,
				round: row.round,
				motion: row.motion,
				...stats
			});
		}
	}

	// Channels added at /admin/recordings keep their matches; only their views,
	// dates and lengths are refreshed.
	const others = [...new Set(readVideos().videos.map((v) => v.channel))].filter(
		(c) => c && !CHANNELS.some((channel) => channel.url === c)
	);
	for (const url of others) {
		const stats = new Map((await listUploads(url)).map(({ id, title, ...s }) => [id, s]));
		const current = readVideos();
		const refreshed = current.videos
			.filter((v) => v.channel === url)
			.map((v) => ({ ...v, ...(stats.get(v.id) ?? {}) }));
		writeVideos(
			[url],
			refreshed,
			current.unmatched.filter((v) => v.channel === url)
		);
	}

	writeVideos(
		CHANNELS.map((c) => c.url),
		videos,
		unmatched
	);
	console.log(
		`Matched ${videos.length} videos; ${unmatched.length} unmatched (see ${VIDEOS_PATH}).`
	);
}

// Only update when run directly, not when the admin tools import the helpers.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await update();
}
