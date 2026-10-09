import { execFileSync } from 'node:child_process';

const REPO = 'acornitum/underthinking';
const CACHE_MS = 10 * 60 * 1000; // GitHub allows 60 unauthenticated requests an hour

export type Commit = { sha: string; url: string; date: string };

let cached: { commit: Commit | null; at: number } | undefined;

// The latest commit on GitHub, falling back to local git (e.g. offline in dev).
// null if neither is available; the about page then just leaves the line out.
export async function latestCommit(): Promise<Commit | null> {
	if (cached && Date.now() - cached.at < CACHE_MS) return cached.commit;
	const commit = (await fromGitHub()) ?? fromLocalGit();
	cached = { commit, at: Date.now() };
	return commit;
}

async function fromGitHub(): Promise<Commit | null> {
	try {
		const res = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`, {
			headers: { Accept: 'application/vnd.github+json' },
			signal: AbortSignal.timeout(3000)
		});
		if (!res.ok) return null;
		const [latest] = await res.json();
		return latest
			? { sha: latest.sha, url: latest.html_url, date: latest.commit.committer.date }
			: null;
	} catch {
		return null;
	}
}

function fromLocalGit(): Commit | null {
	try {
		const [sha, date] = execFileSync('git', ['log', '-1', '--format=%H %cI'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		})
			.trim()
			.split(' ');
		return sha ? { sha, url: `https://github.com/${REPO}/commit/${sha}`, date } : null;
	} catch {
		return null;
	}
}
