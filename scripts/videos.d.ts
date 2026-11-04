// Types for what scripts/videos.js exports (used by the local admin tools).
type VideoStats = { views: number | null; published: string | null; duration: number | null };
type SavedVideo = VideoStats & {
	id: string;
	title: string;
	channel: string;
	label: string;
	tournament_name: string;
	round: string;
	motion: string;
};
type UnmatchedVideo = { id: string; title: string; channel: string; reason: string };
type ChannelInfo = { url: string; name: string; link: string; avatar: string | null };
type VideosFile = { videos: SavedVideo[]; unmatched: UnmatchedVideo[]; channels: ChannelInfo[] };

export const VIDEOS_PATH: string;
export function breakOf(text: string): string;
export function roundKey(name: string): string | null;
export function sameMotion(a: string, b: string): boolean;
export function cleanest<T extends { id: number; motion: string }>(rows: T[]): T;
export function listUploads(url: string): Promise<({ id: string; title: string } & VideoStats)[]>;
export function channelInfo(url: string): Promise<ChannelInfo>;
export function readVideos(): VideosFile;
export function writeChannels(infos: ChannelInfo[]): VideosFile;
export function writeVideos(
	channels: string[],
	videos: SavedVideo[],
	unmatched?: UnmatchedVideo[]
): VideosFile;
