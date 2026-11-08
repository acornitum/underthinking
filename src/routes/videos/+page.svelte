<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SearchBar from '#lib/SearchBar.svelte';
	import VideoGrid from '#lib/VideoGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The channel row scrolls sideways; arrows show on whichever side has more.
	let row = $state<HTMLElement>();
	let canLeft = $state(false);
	let canRight = $state(false);
	function measure() {
		if (!row) return;
		canLeft = row.scrollLeft > 1;
		canRight = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
	}
	$effect(() => {
		if (!row) return;
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(row);
		return () => observer.disconnect();
	});
	// Clicking a channel shows only its videos (keeping the other filters);
	// clicking it again shows every channel's.
	function channelHref(handle: string) {
		const url = new URL(page.url.href);
		if (data.selected === handle) url.searchParams.delete('channel');
		else url.searchParams.set('channel', handle);
		return `${url.pathname}${url.search}`;
	}

	// A sort option's link, keeping the search, filters and channel.
	function sortHref(sort: string) {
		const url = new URL(page.url.href);
		if (sort === 'tournament') url.searchParams.delete('sort');
		else url.searchParams.set('sort', sort);
		return `${url.pathname}${url.search}`;
	}

	let sortOpen = $state(false);
	let sortMenu = $state<HTMLElement>();
	let currentSort = $derived(data.sorts.find((s) => s.value === data.sort) ?? data.sorts[0]);

	function pickSort(sort: string) {
		sortOpen = false;
		goto(sortHref(sort), { replace: true, reset: false });
	}

	// The open sort menu closes on a click elsewhere or Escape.
	function closeSort(e: Event) {
		if (!sortOpen) return;
		if (e instanceof KeyboardEvent ? e.key === 'Escape' : !sortMenu?.contains(e.target as Node)) {
			sortOpen = false;
		}
	}

	function scrollRow(direction: 1 | -1) {
		row?.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: 'smooth' });
	}
</script>

<svelte:window onclick={closeSort} onkeydown={closeSort} />


{#snippet arrow(direction: 1 | -1)}
	<div
		class="pointer-events-none absolute inset-y-0 flex items-center {direction === 1
			? 'right-0 bg-linear-to-l pl-8'
			: 'left-0 bg-linear-to-r pr-8'} from-page via-page/90 to-transparent"
	>
		<button
			type="button"
			class="pointer-events-auto flex size-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink"
			aria-label={direction === 1 ? 'More channels' : 'Previous channels'}
			onclick={() => scrollRow(direction)}
		>
			<svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2"
				><path
					d={direction === 1 ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'}
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
		</button>
	</div>
{/snippet}

<div class="mb-6">
	<h1 class="text-3xl font-bold">Recorded rounds</h1>
	<p class="mt-1 text-sm text-muted">
		{data.videoCount.toLocaleString()} videos of {data.rounds.toLocaleString()} rounds
	</p>
</div>

<!-- Search, with a sort icon beside it that opens the sort orders. -->
<div class="flex gap-2">
	<div class="min-w-0 flex-1"><SearchBar /></div>
	<!-- self-start: otherwise it stretches over the search bar's bottom margin
	     and the menu opens a gap below the icon. -->
	<div class="relative shrink-0 self-start" bind:this={sortMenu}>
		<button
			type="button"
			class="flex size-11 cursor-pointer items-center justify-center rounded-lg bg-surface transition-colors focus:outline-none {sortOpen
				? 'text-highlight'
				: 'text-muted hover:text-ink'}"
			aria-haspopup="listbox"
			aria-expanded={sortOpen}
			aria-label="Sort by: {currentSort.label}"
			title="Sort by: {currentSort.label}"
			onclick={() => (sortOpen = !sortOpen)}
		>
			<!-- Arrows up and down: the usual "sort" glyph. -->
			<svg
				class="size-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /><path d="m21 16-4 4-4-4" /><path
					d="M17 20V4"
				/></svg
			>
		</button>
		{#if sortOpen}
			<div
				class="absolute top-full right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg bg-surface py-1 text-sm ring-1 ring-line"
				role="listbox"
				aria-label="Sort by"
			>
				{#each data.sorts as s (s.value)}
					{@const on = s.value === data.sort}
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-left transition-colors focus:outline-none {on
							? 'text-ink'
							: 'text-muted hover:text-ink focus:text-ink'}"
						role="option"
						aria-selected={on}
						onclick={() => (on ? (sortOpen = false) : pickSort(s.value))}
					>
						{s.label}
						{#if on}
							<svg
								class="size-4 shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg
							>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- The channels the videos come from, the one with the newest recorded
     tournament first. Each opens on YouTube. -->
{#if data.channels.length}
	<div class="relative -mx-2 mb-6">
		<nav
			bind:this={row}
			onscroll={measure}
			class="flex [scrollbar-width:none] gap-1 overflow-x-auto"
			aria-label="Channels"
		>
			{#each data.channels as c (c.url)}
				{@const on = data.selected === c.handle}
				<div class="group relative w-24 shrink-0">
					<a
						href={channelHref(c.handle)}
						data-sveltekit-noscroll
						aria-current={on ? 'true' : undefined}
						class="flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors {on
							? 'bg-line'
							: 'hover:bg-line/50'}"
						title={on ? 'Show every channel' : `Only ${c.name}`}
					>
						{#if c.avatar}
							<img
								src={c.avatar}
								alt=""
								loading="lazy"
								referrerpolicy="no-referrer"
								class="m-0 size-16 rounded-full bg-line object-cover"
							/>
						{:else}
							<span
								class="flex size-16 items-center justify-center rounded-full bg-line text-xl font-bold text-muted"
								aria-hidden="true">{c.name[0]}</span
							>
						{/if}
						<span
							class="line-clamp-2 text-[0.6875rem] leading-tight {on
								? 'text-ink'
								: 'text-muted group-hover:text-ink'}">{c.name}</span
						>
					</a>
					<!-- Opens the channel on YouTube. -->
					<a
						href={c.link}
						target="_blank"
						rel="noreferrer"
						class="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full text-muted transition hover:bg-line hover:text-ink focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
						title="{c.name} on YouTube"
						aria-label="{c.name} on YouTube"
					>
						<svg
							viewBox="0 0 24 24"
							class="size-3.5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><path
								d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
							/></svg
						>
					</a>
				</div>
			{/each}
		</nav>
		{#if canLeft}{@render arrow(-1)}{/if}
		{#if canRight}{@render arrow(1)}{/if}
	</div>
{/if}

{#if data.rounds}
	{#key data.query}
		<VideoGrid initial={data.motions} query={data.query} total={data.rounds} />
	{/key}
{:else}
	<p class="text-muted">No recorded rounds match these filters.</p>
{/if}
