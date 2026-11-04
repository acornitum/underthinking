// Recorded rounds: YouTube videos matched to motions by scripts/videos.js
// (npm run videos:update), which writes data/videos.json.
import type { Filters } from '#lib/filters.ts';
import { filterMotions, findMotionId, type Motion } from '#lib/server/db.ts';
import data from '../../../data/videos.json';

export type Video = { id: string; title: string; label: string };
export type RecordedRound = { motion: Motion; videos: Video[] };

let byMotion: Map<number, Video[]> | undefined;

// Motion id → its videos. The JSON names motions by tournament, round and text
// (ids change when the CSV is updated), so they're looked up once here.
function videosByMotion(): Map<number, Video[]> {
	if (byMotion) return byMotion;
	byMotion = new Map();
	for (const v of data.videos) {
		const id = findMotionId(v.tournament_name, v.round, v.motion);
		if (id === undefined) continue;
		if (!byMotion.has(id)) byMotion.set(id, []);
		byMotion.get(id)!.push({ id: v.id, title: v.title, label: v.label });
	}
	// Rooms in order, e.g. "Room A" before "Room B", "Part 1" before "Part 2".
	const collator = new Intl.Collator('en', { numeric: true });
	for (const videos of byMotion.values()) videos.sort((a, b) => collator.compare(a.label, b.label));
	return byMotion;
}

// Rounds with videos whose motion matches the filters, newest first.
export function recordedRounds(filters: Filters): RecordedRound[] {
	const videos = videosByMotion();
	return filterMotions(filters, [...videos.keys()]).map((motion) => ({
		motion,
		videos: videos.get(motion.id)!
	}));
}
