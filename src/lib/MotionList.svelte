<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import MotionCard from '#lib/MotionCard.svelte';
	import type { Motion } from '#lib/server/db.ts';

	// `query` is the filter query string (e.g. "?style=BP"); the parent re-keys
	// this component when it changes, which resets the loaded motions.
	// `grouped` (the default) shows tournament headings; the random page's
	// infinite mode shows a flat list with each motion's tournament details.
	let {
		initial,
		query,
		grouped = true
	}: { initial: Motion[]; query: string; grouped?: boolean } = $props();

	let more = $state<Motion[]>([]);
	let loading = $state(false);
	let done = $state(false);
	let sentinel: HTMLElement;

	const PRELOAD_MARGIN = 600;

	let motions = $derived([...initial, ...more]);

	// Consecutive motions from the same tournament edition share one heading.
	let groups = $derived.by(() => {
		const result: { key: number; motions: Motion[] }[] = [];
		for (const m of motions) {
			const last = result.at(-1);
			if (last?.key === m.tournament_order) last.motions.push(m);
			else result.push({ key: m.tournament_order, motions: [m] });
		}
		return result;
	});

	// Tournament groups (by key) whose motions are hidden.
	const collapsed = new SvelteSet<number>();
	function toggle(key: number) {
		if (collapsed.has(key)) collapsed.delete(key);
		else collapsed.add(key);
	}

	const usable = (value: string) => value && value.trim() !== '-';

	function details(m: Motion) {
		const place = usable(m.country) ? m.country : usable(m.region) ? m.region : '';
		return [place, m.level, m.style].filter((v) => v && usable(v)).join(' · ');
	}

	async function loadMore() {
		if (loading || done) return;
		loading = true;
		try {
			const res = await fetch(`/api/motions${query ? `${query}&` : '?'}offset=${motions.length}`);
			const batch: Motion[] = await res.json();
			more.push(...batch);
			if (batch.length === 0) done = true;
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

{#if !grouped}
	<ul class="divide-y-[0.5px] divide-line md:divide-y">
		{#each motions as m (m.id)}
			<MotionCard motion={m} />
		{/each}
	</ul>
{:else}
	<div>
		{#each groups as group (group.key)}
			{@const first = group.motions[0]}
			<!-- Collapsed tournaments sit close together; open ones get room. -->
			<section class={collapsed.has(group.key) ? 'mb-px md:mb-2' : 'mb-10'}>
				<!-- Edge to edge on phones (cancelling the page padding); a rounded box on desktop. -->
				<header
					class="-mx-6 flex items-center gap-3 bg-heading px-6 py-4 md:mx-0 md:rounded-md md:px-4 md:py-3"
				>
					<div class="min-w-0 flex-1">
						<h2 class="text-lg font-bold text-tournament md:text-xl">
							{#if first.tab_url}
								<a href={first.tab_url} class="group" target="_blank" rel="noreferrer">
									<span class="group-hover:underline">{first.tournament_name}</span>
									<svg
										class="relative -top-0.5 ml-1 inline size-[1.125rem] align-middle text-dim group-hover:text-muted"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-label="(opens tab in a new window)"
										role="img"
									>
										<path
											d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
										/>
									</svg>
								</a>
							{:else}
								{first.tournament_name}
							{/if}
						</h2>
						<p class="text-sm text-muted">{details(first)}</p>
					</div>
					<button
						type="button"
						class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-dim transition-colors hover:bg-line hover:text-muted"
						aria-expanded={!collapsed.has(group.key)}
						aria-controls="group-{group.key}"
						aria-label="{collapsed.has(group.key)
							? 'Show'
							: 'Hide'} motions from {first.tournament_name}"
						onclick={() => toggle(group.key)}
					>
						<!-- Points down when open, left when collapsed. -->
						<svg
							class="size-6 transition-transform"
							class:rotate-90={collapsed.has(group.key)}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="m6 9 6 6 6-6" />
						</svg>
					</button>
				</header>
				<!-- Inset on desktop to line up with the tournament name (and chevron). -->
				<ul
					id="group-{group.key}"
					class="divide-y-[0.5px] divide-line md:divide-y md:px-4"
					hidden={collapsed.has(group.key)}
				>
					{#each group.motions as m (m.id)}
						<MotionCard motion={m} grouped />
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}

<div {@attach observe} class="pt-6 text-center text-sm text-muted">
	{#if loading}
		Loading…
	{:else if done && motions.length}
		That is all the motions :3
	{/if}
</div>
