<script lang="ts">
	import { page } from '$app/state';
	import { adminSlot } from '#lib/admin-slots.ts';
	import { iconButtonClass } from '#lib/iconButton.ts';
	import InfoSlide from '#lib/InfoSlide.svelte';
	import { hoverHint, toast } from '#lib/toast.svelte.ts';
	import type { Motion } from '#lib/server/db.ts';

	// Inside a tournament group the heading already names the tournament, so
	// only the round is shown. The recorded rounds page shows the videos
	// itself, so it turns off the play button.
	let {
		motion: m,
		grouped = false,
		fullInfoslide = false,
		showVideos = true
	}: {
		motion: Motion;
		grouped?: boolean;
		fullInfoslide?: boolean;
		showVideos?: boolean;
	} = $props();

	const AdminActions = adminSlot('MotionActions');

	// Clicking the motion copies it (with its infoslide). A click that ends a
	// text selection doesn't, so you can still select part of a motion.
	async function copy(at: { x: number; y: number }) {
		if (window.getSelection()?.toString()) return;
		await navigator.clipboard.writeText(
			m.infoslide ? `${m.motion}\n\nInfoslide: ${m.infoslide}` : m.motion
		);
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
		{#if showVideos && m.videos?.length}
			<!-- Recorded rounds: hovering (or tapping, which focuses it) shows the
			     videos' thumbnails, each opening on YouTube. The popup's top
			     padding bridges the gap so the mouse can move onto it. -->
			<div class="group relative">
				<button
					type="button"
					class={iconButtonClass}
					aria-label="Recorded rounds ({m.videos.length})"
					title="Recorded rounds"
				>
					<svg
						class="size-[0.9rem] md:size-[1.1rem]"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M6 4l13 8-13 8z" />
					</svg>
				</button>
				<div
					class="absolute top-full right-0 z-10 hidden pt-1 group-focus-within:block group-hover:block"
				>
					<div
						class="max-h-80 w-72 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-lg"
					>
						<p class="mb-1 px-1 text-xs font-semibold text-muted">
							{m.videos.length === 1 ? '1 recorded round' : `${m.videos.length} recorded rounds`}
						</p>
						<div class="grid {m.videos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}">
							{#each m.videos as v (v.id)}
								<a
									href="https://www.youtube.com/watch?v={v.id}"
									target="_blank"
									rel="noreferrer"
									class="block rounded-md p-1 text-xs text-card-details transition-colors hover:bg-line hover:not-in-data-[theme=hazel]:text-highlight"
									title={v.title}
								>
									<img
										src="https://i.ytimg.com/vi/{v.id}/mqdefault.jpg"
										alt={v.title}
										loading="lazy"
										class="m-0 aspect-video w-full rounded object-cover"
									/>
									{#if v.label}
										<span class="mt-0.5 block truncate">{v.label}</span>
									{/if}
								</a>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}
		{#if AdminActions}
			<AdminActions motion={m} />
		{/if}
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
