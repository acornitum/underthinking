<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let input: HTMLInputElement;
	let value = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout>;

	// Follow the URL (back button, cleared filters) unless the user is typing.
	$effect(() => {
		const q = page.url.searchParams.get('q') ?? '';
		if (document.activeElement !== input) value = q;
	});

	function search(q: string) {
		const url = new URL(page.url.href);
		if (q.trim()) url.searchParams.set('q', q.trim());
		else url.searchParams.delete('q');
		goto(url, { replace: true, reset: false });
	}

	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(() => search(value), 250);
	}

	function clear() {
		clearTimeout(timer);
		value = '';
		search('');
		input.focus();
	}
</script>

<form class="relative mb-6" role="search" onsubmit={(e) => (e.preventDefault(), search(value))}>
	<input
		bind:this={input}
		bind:value
		{oninput}
		type="search"
		placeholder="Search motions…"
		aria-label="Search motions"
		class="w-full rounded-lg bg-surface py-2.5 pr-10 pl-4 text-ink placeholder:text-chip focus:bg-line focus:outline-none [&::-webkit-search-cancel-button]:hidden"
	/>
	{#if value}
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted hover:text-ink"
			aria-label="Clear search"
			onclick={clear}
		>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	{:else}
		<svg
			class="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-chip"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7" />
			<path d="m20 20-3.5-3.5" />
		</svg>
	{/if}
</form>
