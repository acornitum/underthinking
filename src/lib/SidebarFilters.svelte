<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { FILTERS, parseFilters, type FilterKey, type FilterOption } from '#lib/filters.ts';

	let { options }: { options: Record<FilterKey, FilterOption[]> } = $props();

	let selected = $derived(parseFilters(page.url.searchParams));

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

	// A parent is "partial" when some of its children are selected instead of
	// the whole parent. Clicking a selected or partial parent clears the group.
	function toggleParent(key: FilterKey, option: FilterOption) {
		const group = [option.value, ...(option.children ?? []).map((c) => c.value)];
		const values = selected[key];
		setValues(
			key,
			values.some((v) => group.includes(v))
				? values.filter((v) => !group.includes(v))
				: [...values, option.value]
		);
	}

	// Picking a child narrows the parent to it; unpicking the last child goes
	// back to the whole parent.
	function toggleChild(key: FilterKey, parent: FilterOption, value: string) {
		const siblings = parent.children!.map((c) => c.value);
		let values = selected[key].filter((v) => v !== parent.value);
		if (values.includes(value)) {
			values = values.filter((v) => v !== value);
			if (!values.some((v) => siblings.includes(v))) values.push(parent.value);
		} else {
			values.push(value);
		}
		setValues(key, values);
	}

	const chip = 'cursor-pointer rounded-md border transition-colors';
	const chipOn = 'border-selected bg-selected text-ink';
	const chipPartial = 'border-selected bg-surface text-ink';
	const chipOff = 'border-line bg-surface text-muted hover:bg-line hover:text-ink';
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
				{#each options[key] as option (option.value)}
					{#if option.children?.length}
						{@const on = selected[key].includes(option.value)}
						{@const partial = !on && option.children.some((c) => selected[key].includes(c.value))}
						<button
							type="button"
							class="{chip} px-2.5 py-1 text-xs {on ? chipOn : partial ? chipPartial : chipOff}"
							aria-pressed={on ? 'true' : partial ? 'mixed' : 'false'}
							aria-expanded={on || partial}
							title="{option.count.toLocaleString()} motions"
							onclick={() => toggleParent(key, option)}
						>
							{option.label ?? option.value}
							<span class="ml-0.5 text-base leading-none opacity-60">{on || partial ? '▾' : '▸'}</span>
						</button>
						{#if on || partial}
							<div class="mb-1 flex w-full flex-wrap gap-1 border-l-2 border-line pl-2">
								{#each option.children as child (child.value)}
									{@const childOn = selected[key].includes(child.value)}
									<button
										type="button"
										class="{chip} px-2 py-0.5 text-[11px] {childOn ? chipOn : chipOff}"
										aria-pressed={childOn}
										title="{child.count.toLocaleString()} motions"
										onclick={() => toggleChild(key, option, child.value)}
									>
										{child.label ?? child.value}
									</button>
								{/each}
							</div>
						{/if}
					{:else}
						{@const on = selected[key].includes(option.value)}
						<button
							type="button"
							class="{chip} px-2.5 py-1 text-xs {on ? chipOn : chipOff}"
							aria-pressed={on}
							title="{option.count.toLocaleString()} motions"
							onclick={() => toggle(key, option.value)}
						>
							{option.label ?? option.value}
						</button>
					{/if}
				{/each}
			</div>
		</section>
	{/each}
</div>
