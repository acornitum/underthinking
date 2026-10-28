<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { FILTERS, parseFilters, type FilterKey, type FilterOption } from '#lib/filters.ts';

	let { options }: { options: Record<FilterKey, FilterOption[]> } = $props();

	let selected = $derived(parseFilters(page.url.searchParams));

	function setValues(key: FilterKey, values: string[]) {
		if (key === 'type' && !values.length) narrowed = [];
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

	// PREVIEW: secondary genres (options with a `group`) stay hidden behind a
	// button, except ones that are selected.
	let showSecondary = $state(false);

	// Picking a main genre shows the secondary genres linked to it (their
	// `parent`) in a block below. Picking one of those narrows the main genre
	// to it; unpicking the last one goes back to the main genre only if that
	// was picked first.
	const popupOf = (list: FilterOption[], main: string) => list.filter((o) => o.parent === main);

	function toggleMain(key: FilterKey, main: string, children: FilterOption[]) {
		narrowed = narrowed.filter((p) => p !== main);
		const group = [main, ...children.map((c) => c.value)];
		const values = selected[key];
		setValues(
			key,
			values.some((v) => group.includes(v))
				? values.filter((v) => !group.includes(v))
				: [...values, main]
		);
	}

	// Main genres that were picked before being narrowed to a subcategory, so
	// unpicking their last subcategory picks them again.
	let narrowed = $state<string[]>([]);

	function toggleSecondary(key: FilterKey, option: FilterOption, siblings: FilterOption[]) {
		const values = selected[key];
		const parent = option.parent;
		const open =
			parent && (values.includes(parent) || siblings.some((s) => values.includes(s.value)));
		if (!parent || !open) return toggle(key, option.value);
		if (values.includes(parent) && !narrowed.includes(parent)) narrowed.push(parent);
		let next = values.filter((v) => v !== parent);
		if (next.includes(option.value)) {
			next = next.filter((v) => v !== option.value);
			if (!siblings.some((s) => next.includes(s.value)) && narrowed.includes(parent)) {
				next.push(parent);
				narrowed = narrowed.filter((p) => p !== parent);
			}
		} else {
			next.push(option.value);
		}
		setValues(key, next);
	}

	function groups(list: FilterOption[]) {
		const byGroup = new Map<string, FilterOption[]>();
		for (const o of list) if (o.group) byGroup.set(o.group, [...(byGroup.get(o.group) ?? []), o]);
		return [...byGroup];
	}

	const chip = 'cursor-pointer rounded-md border transition-colors';
	const chipOn = 'border-selected bg-selected text-ink';
	const chipPartial = 'border-selected bg-surface text-ink';
	const chipIncluded = 'border-highlight bg-surface text-highlight hover:bg-line';
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
			{#if options[key].some((o) => o.group)}
				{@const secondary = options[key].filter((o) => o.group)}
				{@const mains = options[key].filter((o) => !o.group)}
				{@const isOpen = (main: string) =>
					selected[key].includes(main) ||
					popupOf(secondary, main).some((c) => selected[key].includes(c.value))}
				{@const linked = secondary.filter((o) => o.parent && isOpen(o.parent))}
				{@const picked = secondary.filter(
					(o) => selected[key].includes(o.value) && !linked.includes(o)
				)}
				<div class="flex flex-wrap gap-1">
					{#each mains as option (option.value)}
						{@const on = selected[key].includes(option.value)}
						{@const partial = !on && isOpen(option.value)}
						<button
							type="button"
							class="{chip} px-2.5 py-1 text-xs {on ? chipOn : partial ? chipPartial : chipOff}"
							aria-pressed={on ? 'true' : partial ? 'mixed' : 'false'}
							title="{option.count.toLocaleString()} motions"
							onclick={() => toggleMain(key, option.value, popupOf(secondary, option.value))}
						>
							{option.label ?? option.value}
						</button>
					{/each}
					{#if !showSecondary}
						{#each picked as option (option.value)}
							<button
								type="button"
								class="{chip} px-2 py-0.5 text-[11px] {chipOn}"
								aria-pressed="true"
								title="{option.count.toLocaleString()} motions"
								onclick={() => toggle(key, option.value)}
							>
								{option.label ?? option.value}
							</button>
						{/each}
					{/if}
				</div>
				<!-- The secondary genres linked to each picked main genre, under their
				     group headings (all of them show with "Show subcategories"). -->
				{#if !showSecondary && linked.length}
					<div class="mt-3 space-y-2.5 pl-2.5">
						{#each groups(linked) as [group, list] (group)}
							<div>
								<h3
									class="mb-1 text-[11px] font-bold {list.some((o) =>
										selected[key].includes(o.parent!)
									)
										? 'text-highlight'
										: 'text-muted'}"
								>
									{group}
								</h3>
								<div class="flex flex-wrap gap-1">
									{#each list as option (option.value)}
										{@const on = selected[key].includes(option.value)}
										<!-- Outlined in the highlight colour while its whole main genre is
										     picked, since it's included. -->
										{@const included = !on && selected[key].includes(option.parent!)}
										<button
											type="button"
											class="{chip} px-2 py-0.5 text-[11px] {on
												? chipOn
												: included
													? chipIncluded
													: chipOff}"
											aria-pressed={on}
											title="{option.count.toLocaleString()} motions"
											onclick={() =>
												toggleSecondary(key, option, popupOf(secondary, option.parent!))}
										>
											{option.label ?? option.value}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
				<button
					type="button"
					class="mt-2 cursor-pointer text-xs font-bold text-chip underline hover:text-ink"
					aria-expanded={showSecondary}
					onclick={() => (showSecondary = !showSecondary)}
				>
					{showSecondary ? 'Hide subcategories' : 'Show subcategories'}
				</button>
				{#if showSecondary}
					<div class="mt-3 space-y-2.5 pl-2.5">
						{#each groups(secondary) as [group, list] (group)}
							<div>
								<h3
									class="mb-1 text-[11px] font-bold {list.some(
										(o) => o.parent && selected[key].includes(o.parent)
									)
										? 'text-highlight'
										: 'text-muted'}"
								>
									{group}
								</h3>
								<div class="flex flex-wrap gap-1">
									{#each list as option (option.value)}
										{@const on = selected[key].includes(option.value)}
										{@const included =
											!on && !!option.parent && selected[key].includes(option.parent)}
										<button
											type="button"
											class="{chip} px-2 py-0.5 text-[11px] {on
												? chipOn
												: included
													? chipIncluded
													: chipOff}"
											aria-pressed={on}
											title="{option.count.toLocaleString()} motions"
											onclick={() =>
												toggleSecondary(
													key,
													option,
													option.parent ? popupOf(secondary, option.parent) : []
												)}
										>
											{option.label ?? option.value}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
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
								<span class="ml-0.5 text-base leading-none opacity-60"
									>{on || partial ? '▾' : '▸'}</span
								>
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
			{/if}
		</section>
	{/each}
</div>
