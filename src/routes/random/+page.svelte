<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import MotionCard from '#lib/MotionCard.svelte';
	import MotionList from '#lib/MotionList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Re-roll with the current filters, showing one motion or 20.
	function reroll(count: 1 | 20 | 'infinite') {
		const url = new URL(page.url.href);
		if (count === 1) url.searchParams.delete('count');
		else url.searchParams.set('count', String(count));
		goto(url, { refreshAll: true });
	}
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<h1 class="text-3xl font-bold">Random motion{data.mode === 'one' ? '' : 's'}</h1>
	<div class="flex gap-2">
		<button
			type="button"
			class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover"
			onclick={() => reroll(1)}
		>
			Another one
		</button>
		<button
			type="button"
			class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover"
			onclick={() => reroll(20)}
		>
			Another 20
		</button>
		<button
			type="button"
			class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover"
			onclick={() => reroll('infinite')}
		>
			Infinite
		</button>
	</div>
</div>

{#if data.mode === 'infinite' && data.motions.length}
	{#key data.query}
		<MotionList initial={data.motions} query={data.query} grouped={false} />
	{/key}
{:else if data.motions.length}
	<ul class="divide-y-[0.5px] divide-line md:divide-y">
		{#each data.motions as m (m.id)}
			<MotionCard motion={m} fullInfoslide={data.motions.length === 1} />
		{/each}
	</ul>
{:else}
	<p class="text-muted">No motions match these filters.</p>
{/if}
