<script lang="ts">
	// `alwaysOpen` shows the full text with no toggle.
	let { text, alwaysOpen = false }: { text: string; alwaysOpen?: boolean } = $props();

	let open = $state(false);
	// Assume long until measured: most infoslides overflow one line.
	let truncated = $state(true);

	function measure(el: HTMLElement) {
		const observer = new ResizeObserver(() => {
			truncated = el.scrollWidth > el.clientWidth;
		});
		observer.observe(el);
		return () => observer.disconnect();
	}
</script>

{#snippet body()}
	{#if truncated}
		<span
			class="flex h-5 shrink-0 items-center text-[0.7rem] transition-transform"
			class:rotate-90={open}
			aria-hidden="true"
		>
			▶
		</span>
	{/if}

	{#if open}
		<span class="block min-w-0 flex-1 whitespace-pre-line">{text}</span>
	{:else}
		<span
			{@attach measure}
			class="block min-w-0 flex-1 overflow-hidden whitespace-nowrap"
			class:[mask-image:linear-gradient(to_right,black_60%,transparent)]={truncated}
		>
			{text}
		</span>
	{/if}
{/snippet}

<!-- Long infoslides are one big toggle button; short ones are plain text. -->
{#if alwaysOpen}
	<p class="mt-2 text-sm whitespace-pre-line text-infoslide">{text}</p>
{:else if truncated}
	<button
		type="button"
		class="mt-2 flex w-full cursor-pointer items-start gap-1.5 text-left text-sm text-infoslide"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		{@render body()}
	</button>
{:else}
	<div class="mt-2 flex items-start gap-1.5 text-sm text-infoslide">
		{@render body()}
	</div>
{/if}
