<script lang="ts">
	import { fade } from 'svelte/transition';
	import { hoverHint, toast } from '#lib/toast.svelte.ts';

	// Keep the popup on screen: it's centred on x, so stay this far from the edges.
	const EDGE = 100;
	function clampX(x: number) {
		const min = window.scrollX + EDGE;
		const max = window.scrollX + document.documentElement.clientWidth - EDGE;
		return Math.min(Math.max(x, min), max);
	}
</script>

<!-- Announced to screen readers; the visible popup is below. -->
<div class="sr-only" role="status">{toast.current?.message ?? ''}</div>

{#if toast.current}
	{#key toast.current.id}
		<div
			in:fade={{ duration: 120 }}
			out:fade={{ duration: 400 }}
			aria-hidden="true"
			class="pointer-events-none absolute z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs font-semibold whitespace-nowrap text-ink shadow-xl"
			style:left="{clampX(toast.current.x)}px"
			style:top="{toast.current.y - 10}px"
		>
			<svg
				class="size-3 text-accent"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M20 6 9 17l-5-5" />
			</svg>
			{toast.current.message}
		</div>
	{/key}
{/if}

{#if hoverHint.current}
	<div
		in:fade={{ duration: 100 }}
		aria-hidden="true"
		class="pointer-events-none absolute z-40 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] whitespace-nowrap text-muted shadow-lg"
		style:left="{hoverHint.current.x + 12}px"
		style:top="{hoverHint.current.y + 16}px"
	>
		{hoverHint.current.message}
	</div>
{/if}
