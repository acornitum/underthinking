<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { FILTERS, parseFilters, type FilterKey, type FilterOption } from '#lib/filters.ts';

	let { options }: { options: Record<FilterKey, FilterOption[]> } = $props();

	// There are 100+ motion types, so only the most common show by default.
	const COLLAPSED_COUNT = 10;
	let showAll = $state<Partial<Record<FilterKey, boolean>>>({});

	let selected = $derived(parseFilters(page.url.searchParams));

	function visibleOptions(key: FilterKey) {
		const all = options[key];
		if (showAll[key] || all.length <= COLLAPSED_COUNT) return all;
		// Keep selected options visible even when they're outside the top few.
		return all.filter((o, i) => i < COLLAPSED_COUNT || selected[key].includes(o.value));
	}

	function setValues(key: FilterKey, values: string[]) {
		const url = new URL(page.url.href);
		url.searchParams.delete(key);
		for (const v of values) url.searchParams.append(key, v);
		// Keep focus on the clicked box, but show the new results from the top.
		goto(url, { reset: false }).then(() => window.scrollTo(0, 0));
	}

	function toggle(key: FilterKey, value: string) {
		const values = selected[key];
		setValues(key, values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
	}
</script>

<div class="space-y-5 px-4 py-4">
	{#each FILTERS as { key, label } (key)}
		<section>
			<div class="mb-2 flex items-baseline justify-between">
				<h2 class="text-sm font-bold">{label}</h2>
				<button
					type="button"
					class="cursor-pointer text-xs font-bold text-muted hover:text-ink disabled:cursor-default disabled:opacity-50"
					disabled={!selected[key].length}
					onclick={() => setValues(key, [])}
				>
					All
				</button>
			</div>
			<div class="flex flex-wrap gap-1">
				{#each visibleOptions(key) as option (option.value)}
					{@const on = selected[key].includes(option.value)}
					<button
						type="button"
						class="cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors {on
							? 'border-selected bg-selected text-ink'
							: 'border-line bg-surface text-muted hover:bg-line hover:text-ink'}"
						aria-pressed={on}
						title="{option.count.toLocaleString()} motions"
						onclick={() => toggle(key, option.value)}
					>
						{option.label ?? option.value}
					</button>
				{/each}
			</div>
			{#if options[key].length > COLLAPSED_COUNT}
				<button
					type="button"
					class="mt-2 cursor-pointer text-xs font-bold text-muted underline hover:text-ink"
					onclick={() => (showAll[key] = !showAll[key])}
				>
					{showAll[key] ? 'Show fewer' : `Show all ${options[key].length}`}
				</button>
			{/if}
		</section>
	{/each}
</div>
