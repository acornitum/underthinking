<script lang="ts">
	import VideoEmbed from '#lib/VideoEmbed.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mb-6">
	<h1 class="text-3xl font-bold">Recorded rounds</h1>
	<p class="mt-1 text-sm text-muted">
		{data.videoCount.toLocaleString()} videos of {data.motions.length.toLocaleString()} rounds
	</p>
</div>

{#if data.motions.length}
	<!-- One card per round, newest first; each holds all of that round's videos. -->
	<div class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.motions as m (m.id)}
			<VideoEmbed motion={m} videos={m.videos ?? []} />
		{/each}
	</div>
{:else}
	<p class="text-muted">No recorded rounds match these filters.</p>
{/if}
