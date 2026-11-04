<script lang="ts">
	import MotionCard from '#lib/MotionCard.svelte';
	import VideoEmbed from '#lib/VideoEmbed.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mb-6">
	<h1 class="text-3xl font-bold">Recorded rounds</h1>
	<p class="mt-1 text-sm text-muted">
		{data.videoCount.toLocaleString()} videos of {data.rounds.length.toLocaleString()} rounds
	</p>
</div>

{#if data.rounds.length}
	<div class="divide-y-[0.5px] divide-line md:divide-y">
		{#each data.rounds as r (r.motion.id)}
			<section class="pb-6">
				<ul>
					<MotionCard motion={r.motion} />
				</ul>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each r.videos as v (v.id)}
						<VideoEmbed video={v} />
					{/each}
				</div>
			</section>
		{/each}
	</div>
{:else}
	<p class="text-muted">No recorded rounds match these filters.</p>
{/if}
