<script lang="ts">
	// The drills timer bar, with markers you can add and remove.
	//
	// Markers are times in seconds: the time at that spot on the bar, i.e. what
	// the timer reads when the bar's edge gets there. Hovering shows a dot at the
	// nearest 10-second spot (with its time); clicking adds a marker line there,
	// or removes the one already there. Markers past `durationSec` are hidden.
	const MARKER_STEP = 10;

	let {
		fraction,
		durationSec,
		markers,
		ontoggle,
		barClass,
		fillClass,
		label
	}: {
		fraction: number; // how full the bar is, 0 to 1
		durationSec: number;
		markers: number[];
		ontoggle: (t: number) => void;
		barClass: string; // height of the bar
		fillClass: string; // colour (and transition) of the filled part
		label?: string; // for screen readers; without one the bar is hidden from them
	} = $props();

	let hoverAt = $state<number | null>(null);
	let shownMarkers = $derived(markers.filter((t) => t < durationSec));

	// The marker spot nearest the mouse, or null at the very ends of the bar.
	function markerSpot(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const position = (e.clientX - rect.left) / rect.width;
		const t = Math.round((position * durationSec) / MARKER_STEP) * MARKER_STEP;
		return t > 0 && t < durationSec ? t : null;
	}

	function onclick(e: MouseEvent) {
		const t = markerSpot(e);
		if (t !== null) ontoggle(t);
	}

	function formatSeconds(total: number) {
		return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
	}

	const left = (t: number) => `${(t / durationSec) * 100}%`;
</script>

<!-- The padding is extra room to aim, and how far marker lines stick out. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="relative min-w-0 flex-1 cursor-pointer py-1.5"
	onmousemove={(e) => (hoverAt = markerSpot(e))}
	onmouseleave={() => (hoverAt = null)}
	{onclick}
>
	<div
		class="w-full overflow-hidden rounded-full bg-line {barClass}"
		role={label ? 'progressbar' : undefined}
		aria-label={label}
		aria-valuemin={label ? 0 : undefined}
		aria-valuemax={label ? 100 : undefined}
		aria-valuenow={label ? Math.round(fraction * 100) : undefined}
		aria-hidden={label ? undefined : 'true'}
	>
		<div class="h-full rounded-full {fillClass}" style:width="{fraction * 100}%"></div>
	</div>
	{#each shownMarkers as t (t)}
		<div
			class="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.15)] transition-opacity {hoverAt ===
			t
				? 'opacity-50'
				: ''}"
			style:left={left(t)}
		></div>
	{/each}
	{#if hoverAt !== null}
		<span
			class="pointer-events-none absolute bottom-full -translate-x-1/2 rounded bg-page px-1 text-xs font-bold text-ink"
			style:left={left(hoverAt)}
		>
			{formatSeconds(hoverAt)}
		</span>
		{#if !markers.includes(hoverAt)}
			<span
				class="pointer-events-none absolute top-1/2 size-2.5 -translate-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.15)]"
				style:left={left(hoverAt)}
			></span>
		{/if}
	{/if}
</div>
