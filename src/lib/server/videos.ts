// Recorded rounds: YouTube videos matched to motions by scripts/videos.js
// (npm run videos:update), which writes data/videos.json.
import data from '../../../data/videos.json';

// `views`, `published` (YYYY-MM-DD, estimated from YouTube's "2 years ago") and
// `duration` (seconds) are as of the last scrape, and null if YouTube didn't say.
export type Video = {
	id: string;
	title: string;
	// The channel's video list URL, and its name and YouTube page (see Channel).
	channel: string;
	channelName: string | null;
	channelLink: string | null;
	label: string;
	views: number | null;
	published: string | null;
	duration: number | null;
};

// A matched round: the motion as scripts/videos.js picked it, and its videos.
type Round = { tournament_name: string; round: string; motion: string; videos: Video[] };

let byRound: Map<string, Round[]> | undefined;

// "tournament|round" → the rounds with videos there. A key can hold several
// rounds when one tournament name covers many editions (e.g. "HWS Round Robin").
function rounds(): Map<string, Round[]> {
	if (byRound) return byRound;
	byRound = new Map();
	const channelsByUrl = new Map(data.channels.map((c) => [c.url, c]));
	const collator = new Intl.Collator('en', { numeric: true });
	for (const v of data.videos) {
		const key = `${v.tournament_name}|${v.round}`;
		if (!byRound.has(key)) byRound.set(key, []);
		const list = byRound.get(key)!;
		let round = list.find((r) => r.motion === v.motion);
		if (!round) list.push((round = { ...v, videos: [] }));
		round.videos.push({
			id: v.id,
			title: v.title,
			channel: v.channel,
			channelName: channelsByUrl.get(v.channel)?.name ?? null,
			channelLink: channelsByUrl.get(v.channel)?.link ?? null,
			label: v.label,
			views: v.views ?? null,
			published: v.published ?? null,
			duration: v.duration ?? null
		});
	}
	// Rooms in order, e.g. "Room A" before "Room B", "Part 1" before "Part 2".
	for (const list of byRound.values()) {
		for (const r of list) r.videos.sort((a, b) => collator.compare(a.label, b.label));
	}
	return byRound;
}

// Motions are sometimes entered twice with small differences (see
// scripts/videos.js), so every copy of a round's motion gets its videos.
const words = (motion: string) => new Set(motion.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

function sameMotion(a: string, b: string) {
	const [x, y] = [words(a), words(b)];
	const shared = [...x].filter((w) => y.has(w)).length;
	return shared / Math.min(x.size, y.size) >= 0.8;
}

// Recordings of school tournaments aren't shown. Mixed ones (university
// tournaments that also had a schools break) are.
const HIDDEN_LEVELS = new Set(['School']);

export function videosFor(m: {
	tournament_name: string;
	round: string;
	motion: string;
	level_group: string;
}): Video[] {
	if (HIDDEN_LEVELS.has(m.level_group)) return [];
	const list = rounds().get(`${m.tournament_name}|${m.round}`);
	return list?.find((r) => r.motion === m.motion || sameMotion(r.motion, m.motion))?.videos ?? [];
}

// Each matched round's tournament, round and motion, as in the CSV.
export function recordedRounds(): Round[] {
	return [...rounds().values()].flat();
}

// A channel videos were scraped from: its name, YouTube link and picture.
export type Channel = { url: string; name: string; link: string; avatar: string | null };

export function channels(): Channel[] {
	return data.channels;
}
