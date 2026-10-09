<script lang="ts">
	import { page } from '$app/state';
	import { iconButtonClass } from '#lib/iconButton.ts';
	import InfoSlide from '#lib/InfoSlide.svelte';
	import { hoverHint, toast } from '#lib/toast.svelte.ts';
	import type { Motion } from '#lib/server/db.ts';

	// Inside a tournament group the heading already names the tournament, so
	// only the round is shown.
	let {
		motion: m,
		grouped = false,
		fullInfoslide = false
	}: { motion: Motion; grouped?: boolean; fullInfoslide?: boolean } = $props();

	// Clicking the motion copies it (with its infoslide). A click that ends a
	// text selection doesn't, so you can still select part of a motion.
	async function copy(at: { x: number; y: number }) {
		if (window.getSelection()?.toString()) return;
		await navigator.clipboard.writeText(m.infoslide ? `${m.motion}\n\n${m.infoslide}` : m.motion);
		toast.show('Copied to clipboard!', at);
	}

	// The popup appears where the mouse clicked...
	function onclick(e: MouseEvent) {
		hoverHint.hide();
		copy({ x: e.pageX, y: e.pageY });
	}

	// ...or, from the keyboard, just above the motion.
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			copy({ x: window.scrollX + rect.left + rect.width / 2, y: window.scrollY + rect.top });
		}
	}
</script>

<li class="flex items-start gap-3 py-4">
	<div class="min-w-0 flex-1">
		<div
			class="cursor-pointer text-[0.875rem] font-medium text-motion transition-colors hover:text-motion-hover md:text-base"
			role="button"
			tabindex="0"
			{onclick}
			{onkeydown}
			onmousemove={(e) => hoverHint.move('Copy to clipboard', e)}
			onmouseleave={() => hoverHint.hide()}
		>
			{m.motion}
			{#if grouped}
				<span class="text-sm font-normal whitespace-nowrap text-round">({m.round})</span>
			{/if}
		</div>

		{#if m.infoslide}
			<InfoSlide text={m.infoslide} alwaysOpen={fullInfoslide} />
		{/if}

		{#if !grouped}
			<p class="mt-2 text-sm text-card-details">
				{#if m.tab_url}
					<a
						href={m.tab_url}
						class="text-card-tournament underline"
						target="_blank"
						rel="noreferrer"
					>
						{m.tournament_name}
					</a>
				{:else}
					<span class="text-card-tournament">{m.tournament_name}</span>
				{/if}
				· {m.round}
				{#if m.city || m.country}· {[m.city, m.country].filter(Boolean).join(', ')}{/if}
				{#if m.level}· {m.level}{/if}
				{#if m.style}· {m.style}{/if}
			</p>
		{/if}
	</div>

	<div class="flex shrink-0">
		<a
			href="/motion/{m.id}"
			target="_blank"
			class={iconButtonClass}
			aria-label="Open in large text (new tab)"
			title="Open in large text"
		>
			<svg
				class="size-[0.9rem] md:size-[1.1rem]"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
			</svg>
		</a>
		{#if page.data.notesEnabled}
			<a
				href="/notes/{m.id}"
				class={iconButtonClass}
				class:text-muted={m.hasNotes}
				aria-label={m.hasNotes ? 'Open notes' : 'Write notes'}
				title={m.hasNotes ? 'Open notes' : 'Write notes'}
			>
				<svg
					class="size-[1.1rem]"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
				</svg>
			</a>
		{/if}
	</div>
</li>
