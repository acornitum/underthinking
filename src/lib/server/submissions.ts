// Public submissions from /add. Each one becomes a GitHub issue labelled
// `submission` in SUBMISSIONS_REPO; the local admin page /admin/submissions
// lists them for review. Nothing is stored on the server itself (the deployed
// database is read-only and the Fly machine has no volume).
//
// Environment (Fly secrets in production, .env locally):
//   SUBMISSIONS_REPO          owner/name of the repo that collects the issues
//                             (its open ones are also listed publicly on /add)
//   SUBMISSIONS_GITHUB_TOKEN  fine-grained token with Issues read/write on that repo only
//   TURNSTILE_SITE_KEY        Cloudflare Turnstile site key (shown to the browser)
//   TURNSTILE_SECRET_KEY      Cloudflare Turnstile secret
// Without the Turnstile keys the check is skipped (fine locally, not in production).
import path from 'node:path';
import { dev } from '$app/env';
import videoData from '../../../data/videos.json';
import { db } from '#lib/server/db.ts';

let envLoaded = false;

// Vite doesn't load .env into process.env, so read it ourselves in dev.
export function env(name: string): string | undefined {
	if (dev && !envLoaded) {
		envLoaded = true;
		try {
			process.loadEnvFile(path.join(process.cwd(), '.env'));
		} catch {
			// no .env: maybe the variables are set in the shell
		}
	}
	return process.env[name] || undefined;
}

export type Kind = 'motion' | 'video';

// What a submission holds; this is also the JSON stored in the issue.
export type Submission = {
	kind: Kind;
	url: string; // the tab URL (motions, required) or YouTube URL (videos)
	tournament: string;
	// Tournament details, as in data/motions.csv (motions only).
	date: string;
	level: string;
	style: string;
	region: string;
	country: string;
	city: string;
	// Which round a recording is of (videos only).
	round: string;
	motion: string;
	notes: string;
	// Filled in for videos from YouTube's oEmbed: title and channel.
	videoTitle?: string;
	channelName?: string;
	channelUrl?: string;
	submittedAt: string;
};

const LIMITS = {
	url: 500,
	tournament: 150,
	date: 10,
	level: 60,
	style: 60,
	region: 60,
	country: 60,
	city: 60,
	round: 60,
	motion: 600,
	notes: 1000
};

// The result of a submission attempt; `field` names the input to fix.
export type Outcome =
	{ ok: true; duplicate?: string } | { ok: false; message: string; field?: string };

// --- rate limiting ---------------------------------------------------------
// In memory: it resets when the machine stops and isn't shared between
// machines, which is fine for one small machine that scales to zero. The
// global daily cap bounds the worst case however many IPs a bot uses.
const PER_IP = { max: 5, windowMs: 60 * 60 * 1000 };
const GLOBAL_PER_DAY = 50;
const byIp = new Map<string, number[]>();
let today = { day: '', count: 0 };

function rateLimited(ip: string): string | null {
	const now = Date.now();
	const day = new Date(now).toISOString().slice(0, 10);
	if (today.day !== day) today = { day, count: 0 };
	if (today.count >= GLOBAL_PER_DAY) {
		return 'The site has had a lot of submissions today. Please try again tomorrow.';
	}
	const recent = (byIp.get(ip) ?? []).filter((t) => now - t < PER_IP.windowMs);
	if (recent.length >= PER_IP.max) {
		byIp.set(ip, recent);
		return 'You’ve sent a few submissions in the last hour. Please try again later.';
	}
	// Keep the map small: drop IPs with nothing recent.
	if (byIp.size > 5000) {
		for (const [k, v] of byIp) if (!v.some((t) => now - t < PER_IP.windowMs)) byIp.delete(k);
	}
	return null;
}

function recordSubmission(ip: string) {
	const now = Date.now();
	byIp.set(ip, [...(byIp.get(ip) ?? []).filter((t) => now - t < PER_IP.windowMs), now]);
	today.count++;
}

// --- validation -------------------------------------------------------------
const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

function httpUrl(input: string): URL | null {
	try {
		const url = new URL(input);
		return /^https?:$/.test(url.protocol) ? url : null;
	} catch {
		return null;
	}
}

const YOUTUBE_HOSTS = /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/;

// The video id of a YouTube watch/short/live/youtu.be URL, if it is one.
export function youtubeId(url: URL): string | null {
	if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
	if (url.searchParams.get('v')) return url.searchParams.get('v');
	const m = url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/);
	return m?.[1] ?? null;
}

function tabExists(url: string): boolean {
	const u = url.replace(/\/+$/, '');
	return !!db.prepare('SELECT 1 FROM motions WHERE tab_url IN (?, ?) LIMIT 1').get(u, `${u}/`);
}

const knownVideos = new Set(videoData.videos.map((v) => v.id));
const knownChannels = new Set(
	videoData.channels.flatMap((c) => [c.url, c.link].map((u) => u.toLowerCase().replace(/\/+$/, '')))
);

type Parsed =
	{ submission: Submission } | { error: Outcome & { ok: false } } | { duplicate: string };

function parse(form: FormData): Parsed {
	const kind = text(form, 'kind') === 'video' ? 'video' : 'motion';
	const s: Submission = {
		kind,
		url: text(form, 'url'),
		tournament: text(form, 'tournament'),
		date: kind === 'motion' ? text(form, 'date') : '',
		level: kind === 'motion' ? text(form, 'level') : '',
		style: kind === 'motion' ? text(form, 'style') : '',
		region: kind === 'motion' ? text(form, 'region') : '',
		country: kind === 'motion' ? text(form, 'country') : '',
		city: kind === 'motion' ? text(form, 'city') : '',
		round: kind === 'video' ? text(form, 'round') : '',
		motion: kind === 'video' ? text(form, 'motion') : '',
		notes: text(form, 'notes'),
		submittedAt: new Date().toISOString()
	};
	for (const [field, max] of Object.entries(LIMITS)) {
		if (s[field as keyof typeof LIMITS].length > max) {
			return {
				error: { ok: false, field, message: `That’s too long (at most ${max} characters).` }
			};
		}
	}

	if (kind === 'video') {
		const url = httpUrl(s.url);
		if (!url || !YOUTUBE_HOSTS.test(url.hostname)) {
			return { error: { ok: false, field: 'url', message: 'Paste a YouTube link.' } };
		}
		const id = youtubeId(url);
		if (id && knownVideos.has(id)) return { duplicate: 'We already have this video.' };
		if (!id && knownChannels.has(s.url.toLowerCase().replace(/\/+$/, ''))) {
			return { duplicate: 'We already have this channel.' };
		}
		return { submission: s };
	}

	if (!httpUrl(s.url)) {
		return { error: { ok: false, field: 'url', message: 'Paste the tournament’s tab link.' } };
	}
	if (s.date && !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
		return { error: { ok: false, field: 'date', message: 'That date doesn’t look right.' } };
	}
	if (tabExists(s.url)) return { duplicate: 'We already have motions from this tab.' };
	return { submission: s };
}

// --- external services ------------------------------------------------------
async function turnstileOk(token: string, ip: string): Promise<boolean> {
	const secret = env('TURNSTILE_SECRET_KEY');
	if (!secret) return dev; // not set up: only allowed locally
	const body = new FormData();
	body.set('secret', secret);
	body.set('response', token);
	body.set('remoteip', ip);
	try {
		const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			body,
			signal: AbortSignal.timeout(8000)
		});
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}

// Title and channel of a YouTube video or playlist; also checks it exists.
async function youtubeInfo(url: string) {
	try {
		const res = await fetch(
			`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
			{ signal: AbortSignal.timeout(8000) }
		);
		if (!res.ok) return null;
		const d = (await res.json()) as { title?: string; author_name?: string; author_url?: string };
		return { videoTitle: d.title, channelName: d.author_name, channelUrl: d.author_url };
	} catch {
		return null;
	}
}

// Mentions and #refs are inert inside the code block, so submitted text
// can't ping anyone or link issues. Backticks are escaped so it can't close
// the block either.
function issueBody(s: Submission) {
	const json = JSON.stringify(s, null, 2).replace(/`/g, '\\u0060');
	return `Submitted through /add. Review it at /admin/submissions.\n\n\`\`\`json\n${json}\n\`\`\`\n`;
}

function issueTitle(s: Submission) {
	const what = s.kind === 'video' ? s.videoTitle || s.url : s.tournament || s.url;
	const clean = what.replace(/[@#]/g, '').replace(/\s+/g, ' ').slice(0, 90);
	return `[${s.kind}] ${clean}`;
}

export const SUBMISSION_LABEL = 'submission';

export type Issue = {
	number: number;
	html_url: string;
	title: string;
	body: string | null;
	created_at: string;
	pull_request?: unknown;
};

// The open submission issues, oldest first (pull requests left out).
export async function openIssues(): Promise<Issue[]> {
	const issues = (await github(
		'GET',
		`/issues?labels=${SUBMISSION_LABEL}&state=open&per_page=100&direction=asc`
	)) as Issue[];
	return issues.filter((i) => !i.pull_request);
}

// The JSON block issueBody() writes (its backticks are escaped, so the first
// closing fence ends it). Issues opened by hand have none.
export function parseIssue(body: string | null): Submission | undefined {
	const m = body?.match(/```json\n([\s\S]*?)\n```/);
	try {
		return m ? (JSON.parse(m[1]) as Submission) : undefined;
	} catch {
		return undefined;
	}
}

// --- the public queue on /add -----------------------------------------------
// Only the tournament (or video title), link and date are shown. Cached for a
// minute so page views don't each call GitHub; a new submission clears it.
export type QueueItem = { kind: Kind; name: string; url: string; submitted: string };
const QUEUE_TTL_MS = 60 * 1000;
let queueCache: { at: number; items: QueueItem[] } | undefined;

export async function publicQueue(): Promise<QueueItem[] | null> {
	if (queueCache && Date.now() - queueCache.at < QUEUE_TTL_MS) return queueCache.items;
	try {
		const items = (await openIssues()).flatMap((i): QueueItem[] => {
			const s = parseIssue(i.body);
			if (!s || !httpUrl(s.url)) return [];
			const name = s.kind === 'video' ? s.tournament || s.videoTitle || '' : s.tournament;
			return [{ kind: s.kind, name, url: s.url, submitted: i.created_at }];
		});
		queueCache = { at: Date.now(), items };
		return items;
	} catch (e) {
		console.error('queue failed:', (e as Error).message);
		return null; // not set up, or GitHub is down: the page just leaves it out
	}
}

const sameUrl = (a: string, b: string) =>
	a.trim().replace(/\/+$/, '').toLowerCase() === b.trim().replace(/\/+$/, '').toLowerCase();

export async function github(method: string, apiPath: string, body?: unknown) {
	const repo = env('SUBMISSIONS_REPO');
	const token = env('SUBMISSIONS_GITHUB_TOKEN');
	if (!repo || !token)
		throw new Error('Submissions aren’t set up (SUBMISSIONS_REPO / SUBMISSIONS_GITHUB_TOKEN).');
	const res = await fetch(`https://api.github.com/repos/${repo}${apiPath}`, {
		method,
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'debate-motion-notes',
			...(body ? { 'Content-Type': 'application/json' } : {})
		},
		body: body ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(10000)
	});
	if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
	return res.status === 204 ? null : res.json();
}

// --- the whole flow ---------------------------------------------------------
const MIN_FILL_MS = 3000;

export async function submit(form: FormData, ip: string): Promise<Outcome> {
	// Bots: a filled honeypot or an instant submit gets a fake success, so they
	// don't learn to avoid it.
	const startedAt = Number(text(form, 'started'));
	if (text(form, 'website') || !startedAt || Date.now() - startedAt < MIN_FILL_MS) {
		return { ok: true };
	}

	const limited = rateLimited(ip);
	if (limited) return { ok: false, message: limited };

	if (!(await turnstileOk(text(form, 'cf-turnstile-response'), ip))) {
		return { ok: false, message: 'The bot check didn’t pass. Please try again.' };
	}

	const parsed = parse(form);
	if ('error' in parsed) return parsed.error;
	if ('duplicate' in parsed) return { ok: true, duplicate: parsed.duplicate };
	const s = parsed.submission;

	// Already waiting in the queue: no need for a second issue.
	if ((await publicQueue())?.some((q) => sameUrl(q.url, s.url))) {
		return { ok: true, duplicate: 'That’s already in the queue below.' };
	}

	if (s.kind === 'video') {
		const url = new URL(s.url);
		if (/^\/(@|channel\/|c\/|user\/)/.test(url.pathname)) {
			// A channel: oEmbed doesn't cover these, so it's checked on review.
			s.channelUrl = s.url;
		} else {
			// A video or playlist: oEmbed gives its title and channel.
			const info = await youtubeInfo(s.url);
			if (!info) {
				return { ok: false, field: 'url', message: 'YouTube couldn’t find that. Is it public?' };
			}
			Object.assign(s, info);
		}
	}

	try {
		await github('POST', '/issues', {
			title: issueTitle(s),
			body: issueBody(s),
			labels: [SUBMISSION_LABEL]
		});
	} catch (e) {
		console.error('submission failed:', (e as Error).message);
		return { ok: false, message: 'Something went wrong saving that. Please try again later.' };
	}
	recordSubmission(ip);
	queueCache = undefined;
	return { ok: true };
}

// Existing values offered as suggestions on the form, most used first.
const SUGGESTED = ['level', 'style', 'region', 'country', 'city'] as const;
type Suggested = Record<(typeof SUGGESTED)[number], string[]>;

export function suggestions() {
	// Not cached: the database is rebuilt in place when motions are added locally.
	return Object.fromEntries(
		SUGGESTED.map((col) => [
			col,
			(
				db
					.prepare(
						`SELECT ${col} AS v FROM motions WHERE ${col} != '' GROUP BY ${col} ORDER BY COUNT(*) DESC LIMIT 200`
					)
					.all() as { v: string }[]
			).map((r) => r.v)
		])
	) as Suggested;
}
