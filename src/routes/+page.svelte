<script lang="ts">
	import { page } from '$app/state';
	import MotionList from '#lib/MotionList.svelte';
	import SearchBar from '#lib/SearchBar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Nothing found: offer to submit it, with the search as the tournament name.
	let submitHref = $derived.by(() => {
		const q = page.url.searchParams.get('q')?.trim();
		return q ? `/add?${new URLSearchParams({ tournament: q })}` : '/add';
	});
</script>

<svelte:head>
	<title>underthink.ing</title>
	<meta
		name="description"
		content="A searchable database of competitive debate motions, with recorded rounds and a drills timer."
	/>
</svelte:head>

<div class="mb-4 flex items-baseline justify-between gap-4">
	<h1 class="text-3xl font-bold">Latest motions</h1>
	<p class="text-sm text-muted">
		{data.total.toLocaleString()} motion{data.total === 1 ? '' : 's'}
	</p>
</div>

<!-- Search, with a button beside it for submitting a missing tournament. -->
<div class="flex gap-2">
	<div class="min-w-0 flex-1"><SearchBar /></div>
	<!-- self-start: otherwise it stretches over the search bar's bottom margin. -->
	<a
		href="/add"
		class="flex size-11 shrink-0 items-center justify-center self-start rounded-lg bg-surface text-chip transition-colors hover:text-ink"
		aria-label="Submit motions"
		title="Submit motions"
	>
		<svg
			class="size-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg
		>
	</a>
</div>

{#if data.total === 0}
	<p class="text-muted">No motions match these filters. Want to add a tournament? <a href={submitHref} class="underline hover:text-ink">Submit its tab here</a
		>!</p>
{:else}
	{#key data.query}
		<MotionList initial={data.motions} query={data.query} />
	{/key}
{/if}
