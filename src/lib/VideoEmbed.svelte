<script lang="ts">
	import type { Motion } from '#lib/server/db.ts';
	import type { Video } from '#lib/server/videos.ts';

	// One recorded round, YouTube-style: like a playlist, it holds every video of
	// the round (one per room), with buttons to switch between them. Below the
	// video, the motion is the title (cut to three lines; hovering shows it in
	// full with the infoslide), then where it was debated.
	let { motion: m, videos }: { motion: Motion; videos: Video[] } = $props();

	let selected = $state(0);
	let video = $derived(videos[selected] ?? videos[0]);
	// Just the thumbnail until it's clicked: a page of YouTube players would load
	// megabytes of script, while a thumbnail is one small image. Once playing,
	// picking another room plays that one.
	let playing = $state(false);

	// Short YouTube-style numbers: "5.4K" (views), "3d ago", "2mo ago", "1y ago", "56:43".
	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const UNITS: [string, number][] = [
		['y', 365],
		['mo', 30],
		['d', 1]
	];

	function ago(date: string | null) {
		if (!date) return '';
		const days = (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000;
		for (const [unit, size] of UNITS) {
			if (days >= size) return `${Math.floor(days / size)}${unit} ago`;
		}
		return 'today';
	}

	function length(seconds: number | null) {
		if (seconds === null) return '';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = String(seconds % 60).padStart(2, '0');
		return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
	}

	// Whether the embedded video is playing rather than paused or ended, from
	// the YouTube player's state messages (1 means playing). The player only
	// sends them once it's asked to, when it loads.
	const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com';
	let player = $state<HTMLIFrameElement>();
	let playerState = $state(-1);

	function listen() {
		playerState = -1;
		player?.contentWindow?.postMessage(
			JSON.stringify({ event: 'listening', id: video.id, channel: 'widget' }),
			PLAYER_ORIGIN
		);
	}

	// A click on the card's empty parts (its padding, the tournament line's
	// gaps, the stats) opens the video on YouTube; the thumbnail, links and
	// buttons keep their own clicks. Keyboard users have the link
	// on the thumbnail. (The styles at the bottom light the corner link over
	// the same parts.)
	function openOnYouTube(e: MouseEvent) {
		const target = e.target as Element;
		if (target.closest('a, button, iframe')) return;
		// The motion opens it too when it's shown in full; a cut-off one opens
		// out on hover instead, and the infoslide is for reading.
		if (target.closest('[data-title]') && (clamped || !target.closest('h2'))) return;
		if (window.getSelection()?.toString()) return; // selecting text
		window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank', 'noreferrer');
	}

	// Whether the title is cut off at three lines. If it is, hovering opens it
	// out in full; if not, hovering only adds the infoslide below it.
	let clamped = $state(false);
	function measureTitle(el: HTMLElement) {
		const check = () => (clamped = el.scrollHeight > el.clientHeight + 1);
		check();
		const observer = new ResizeObserver(check);
		observer.observe(el);
		return () => observer.disconnect();
	}

	function onmessage(e: MessageEvent) {
		if (e.origin !== PLAYER_ORIGIN || !player || e.source !== player.contentWindow) return;
		let data: { event?: string; info?: unknown };
		try {
			data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
		} catch {
			return;
		}
		if (data.event === 'onStateChange' && typeof data.info === 'number') playerState = data.info;
		const info = data.info as { playerState?: unknown } | null;
		if (data.event === 'infoDelivery' && typeof info?.playerState === 'number') {
			playerState = info.playerState;
		}
	}
</script>

<svelte:window {onmessage} />

<!-- Hovering a card tints a rounded box around it, as on YouTube. The negative
     margin lets that padding spill into the grid gap, so cards stay in place. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
	class="group/card -m-2 cursor-pointer rounded-xl p-2 transition-colors hover:bg-line/50"
	onclick={openOnYouTube}
>
	<!-- Stacked edges above the thumbnail mark a card with several videos; the
	     same space is kept on single ones so the cards in a row line up. -->
	<div class="flex h-2 flex-col justify-end gap-0.5" aria-hidden="true">
		{#if videos.length > 1}
			<div class="mx-4 h-[3px] rounded-t bg-line opacity-60"></div>
			<div class="mx-2 h-[3px] rounded-t bg-line"></div>
		{/if}
	</div>

	<div class="relative mt-0.5 aspect-video overflow-hidden rounded-lg bg-line">
		{#if playing}
			{#key video.id}
				<iframe
					class="absolute inset-0 size-full"
					src="{PLAYER_ORIGIN}/embed/{video.id}?autoplay=1&enablejsapi=1"
					title={video.title}
					bind:this={player}
					onload={listen}
					allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
					allowfullscreen
				></iframe>
			{/key}
		{:else}
			<button
				type="button"
				class="group absolute inset-0 size-full cursor-pointer"
				aria-label="Play {video.title}"
				onclick={() => (playing = true)}
			>
				<img
					src="https://i.ytimg.com/vi/{video.id}/mqdefault.jpg"
					alt=""
					loading="lazy"
					class="m-0 size-full object-cover"
				/>
				<!-- Dims the thumbnail until the card is hovered. -->
				<span
					class="pointer-events-none absolute inset-0 bg-white/10 transition-opacity dark:bg-black/25 group-hover/card:opacity-0"
					aria-hidden="true"
				></span>
				<span
					class="absolute inset-0 m-auto flex h-10 w-14 items-center justify-center rounded-xl bg-black/70 text-white transition-colors group-hover:bg-[#f00]"
					aria-hidden="true"
				>
					<svg class="size-5" viewBox="0 0 24 24" fill="currentColor"
						><path d="M8 5v14l11-7z" /></svg
					>
				</span>
				{#if videos.length > 1}
					<span
						class="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1 py-px text-[0.625rem] font-semibold text-white"
					>
						{videos.length} videos
					</span>
				{/if}
				{#if video.duration}
					<span
						class="absolute right-1.5 bottom-1.5 rounded bg-black/80 px-1 py-px text-[0.625rem] font-semibold text-white tabular-nums"
					>
						{length(video.duration)}
					</span>
				{/if}
			</button>
		{/if}
		<!-- Faded while the video plays, so it doesn't cover the picture. -->
		<a
			href="https://www.youtube.com/watch?v={video.id}"
			target="_blank"
			rel="noreferrer"
			class="absolute top-1.5 right-1.5 z-10 rounded-md bg-black/70 p-1 text-white transition hover:opacity-100 hover:not-in-data-[theme=hazel]:text-[#9cc3ff] hover:in-data-[theme=hazel]:text-card-details {playing &&
			playerState === 1
				? 'opacity-10'
				: 'opacity-100'}"
			data-open-link
			aria-label="Open on YouTube (new tab)"
			title="Open on YouTube"
		>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
			</svg>
		</a>
	</div>

	<div class="group/title relative mt-2 cursor-auto" data-title>
		<h2
			{@attach measureTitle}
			data-opens={clamped ? undefined : ''}
			class="line-clamp-3 text-[0.8125rem] {clamped
				? ''
				: 'cursor-pointer'} leading-snug font-medium text-motion"
		>
			{m.motion}
			{#if m.infoslide}
				<!-- Marks that hovering shows an infoslide too. -->
				<svg
					class="inline size-3 align-[-0.1em] text-muted"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					aria-label="Has an infoslide"
					role="img"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M12 16v-4M12 8h.01" />
				</svg>
			{/if}
		</h2>
		{#if clamped}
			<!-- Cut off: on hover the title opens out in place, the full motion set
			     exactly where the cut-off one was, then the infoslide, over the
			     cards below. -->
			<div
				class="absolute -inset-x-2 -top-2 z-20 hidden max-h-96 overflow-y-auto rounded-lg border border-line bg-surface p-2 pt-[calc(0.5rem-1px)] shadow-lg group-hover/title:block"
			>
				<p class="-mx-px text-[0.8125rem] leading-snug font-medium text-motion">{m.motion}</p>
				{#if m.infoslide}
					<p
						class="-mx-px mt-2 border-t border-line pt-2 text-xs leading-relaxed wrap-break-word whitespace-pre-line text-infoslide"
					>
						{m.infoslide}
					</p>
				{/if}
			</div>
		{:else if m.infoslide}
			<!-- Shown in full already: just the infoslide, in a box below. Its top
			     padding bridges the gap so the mouse can move onto it. -->
			<div class="absolute -inset-x-2 top-full z-20 hidden pt-1 group-hover/title:block">
				<p
					class="max-h-80 overflow-y-auto rounded-lg border border-line bg-surface p-2 text-xs leading-relaxed wrap-break-word whitespace-pre-line text-infoslide shadow-lg"
				>
					{m.infoslide}
				</p>
			</div>
		{/if}
	</div>

	<!-- Tournament (linking to its tab) · round. A long tournament name is cut
	     short before the round is. -->
	<p class="mt-1 flex gap-1 text-[0.6875rem]">
		{#if m.tab_url}
			<a
				href={m.tab_url}
				target="_blank"
				rel="noreferrer"
				class="truncate text-card-tournament hover:underline"
				title="Open the tab">{m.tournament_name}</a
			>
		{:else}
			<span class="truncate text-card-tournament">{m.tournament_name}</span>
		{/if}
		<span class="shrink-0 text-muted" aria-hidden="true">·</span>
		<span class="shrink-0 whitespace-nowrap text-card-details">{m.round}</span>
	</p>

	{#if video.channelName || video.views !== null || video.published}
		<p class="flex items-center gap-1 text-[0.6875rem] text-muted">
			{#if video.channelName}
				<a
					href={video.channelLink}
					target="_blank"
					rel="noreferrer"
					class="truncate hover:text-ink hover:underline"
					title="{video.channelName} on YouTube">{video.channelName}</a
				>
				<span aria-hidden="true">·</span>
			{/if}
			{#if video.views !== null}
				<span
					class="flex shrink-0 items-center gap-0.5"
					title="{video.views.toLocaleString()} views"
				>
					<svg
						class="size-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linejoin="round"
						aria-label="Views"
						role="img"
					>
						<path d="M7 5l12 7-12 7z" />
					</svg>
					{compact.format(video.views)}
				</span>
			{/if}
			{#if video.views !== null && video.published}<span aria-hidden="true">·</span>{/if}
			{#if video.published}<span class="shrink-0">{ago(video.published)}</span>{/if}
		</p>
	{/if}

	{#if videos.length > 1}
		<div class="mt-2 flex flex-wrap gap-1" role="group" aria-label="Rooms">
			{#each videos as v, i (v.id)}
				<button
					type="button"
					class="cursor-pointer rounded border border-line px-1.5 py-0.5 text-[0.65rem] transition-colors {i ===
					selected
						? 'bg-line text-ink'
						: 'text-muted hover:bg-line'}"
					aria-pressed={i === selected}
					title={v.title}
					onclick={() => (selected = i)}
				>
					{v.label || `Video ${i + 1}`}
				</button>
			{/each}
		</div>
	{/if}
</article>

<style>
	/* The corner link lights up (as when hovered) while the pointer is over a
	   part of the card that a click opens the video from (see openOnYouTube):
	   the card, but not its links, buttons, player or title, unless the title
	   is a full motion that opens it too. */
	article:hover:not(:has(a:hover, button:hover, iframe:hover, [data-title]:hover))
		[data-open-link],
	article:has(h2[data-opens]:hover) [data-open-link] {
		/* The box behind it is always dark, so a light blue in every theme but
		   hazel (the light themes' own highlight is too dark to read on it). */
		color: #9cc3ff;
		opacity: 1;
	}
	:global([data-theme='hazel'])
		article:hover:not(:has(a:hover, button:hover, iframe:hover, [data-title]:hover))
		[data-open-link],
	:global([data-theme='hazel']) article:has(h2[data-opens]:hover) [data-open-link] {
		color: var(--color-card-details);
	}
</style>
