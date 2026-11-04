<script lang="ts">
	import SearchBar from '#lib/SearchBar.svelte';
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

<SearchBar />

<!-- The channels the videos come from, the one with the newest recorded
     tournament first. Each opens on YouTube. -->
{#if data.channels.length}
	<nav class="-mx-2 mb-6 flex gap-1 overflow-x-auto" aria-label="Channels">
		{#each data.channels as c (c.url)}
			<a
				href={c.link}
				target="_blank"
				rel="noreferrer"
				class="group flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-line/50"
				title="{c.name} on YouTube"
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
				<span class="line-clamp-2 text-[0.6875rem] leading-tight text-muted group-hover:text-ink"
					>{c.name}</span
				>
			</a>
		{/each}
	</nav>
{/if}

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
