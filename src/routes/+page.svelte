<script lang="ts">
	import MotionList from '#lib/MotionList.svelte';
	import SearchBar from '#lib/SearchBar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>underthink.ing</title>
</svelte:head>

<div class="mb-4 flex items-baseline justify-between gap-4">
	<h1 class="text-3xl font-bold">Latest motions</h1>
	<p class="text-sm text-muted">
		{data.total.toLocaleString()} motion{data.total === 1 ? '' : 's'}
	</p>
</div>

<SearchBar />

{#if data.total === 0}
	<p class="text-muted">No motions match these filters.</p>
{:else}
	{#key data.query}
		<MotionList initial={data.motions} query={data.query} />
	{/key}
{/if}
