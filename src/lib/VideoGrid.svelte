<script lang="ts">
	import { tick } from 'svelte';
	import type { Motion } from '#lib/server/db.ts';
	import VideoEmbed from '#lib/VideoEmbed.svelte';

	// The Recorded rounds grid. It starts with the first page of rounds and
	// loads more from /api/videos as you near the bottom, like MotionList.
	// `query` is the filters and channel (e.g. "?q=x&channel=y"); the parent
	// re-keys this component when it changes, which starts over.
	let { initial, query, total }: { initial: Motion[]; query: string; total: number } = $props();

	let more = $state<Motion[]>([]);
	let loading = $state(false);
	let motions = $derived([...initial, ...more]);
	let done = $derived(motions.length >= total);
	let sentinel: HTMLElement;

	const PRELOAD_MARGIN = 800;

	async function loadMore() {
		if (loading || done) return;
		loading = true;
		try {
			const res = await fetch(`/api/videos${query ? `${query}&` : '?'}offset=${motions.length}`);
			const batch: Motion[] = await res.json();
			// Skip any already shown, in case the list changed in between.
			const seen = new Set(motions.map((m) => m.id));
			more.push(...batch.filter((m) => !seen.has(m.id)));
			if (!batch.length) total = motions.length;
		} finally {
			loading = false;
		}
		// On tall screens one batch may not push the sentinel out of view.
		await tick();
		if (sentinel.getBoundingClientRect().top < innerHeight + PRELOAD_MARGIN) loadMore();
	}

	function observe(el: HTMLElement) {
		sentinel = el;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) loadMore();
			},
			{ rootMargin: `${PRELOAD_MARGIN}px` }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}
</script>

<!-- One card per round, newest first; each holds all of that round's videos. -->
<div class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
	{#each motions as m (m.id)}
		<VideoEmbed motion={m} videos={m.videos ?? []} />
	{/each}
</div>

<div {@attach observe} class="pt-8 text-center text-sm text-muted">
	{#if loading}
		Loading…
	{:else if done && motions.length > initial.length}
		That is all the recorded rounds :3
	{/if}
</div>
