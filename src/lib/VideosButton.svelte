<script lang="ts">
	import { iconButtonClass } from '#lib/iconButton.ts';
	import type { Video } from '#lib/server/videos.ts';

	// `iconClass` sizes the play icon, so a bigger page can use a bigger button.
	let {
		videos,
		iconClass = 'size-[0.9rem] md:size-[1.1rem]'
	}: { videos: Video[]; iconClass?: string } = $props();
</script>

<!-- Recorded rounds: hovering (or tapping, which focuses it) shows the
     videos' thumbnails, each opening on YouTube. The popup's top
     padding bridges the gap so the mouse can move onto it. -->
<div class="group relative">
	<button
		type="button"
		class={iconButtonClass}
		aria-label="Recorded rounds ({videos.length})"
		title="Recorded rounds"
	>
		<svg
			class={iconClass}
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
			class="max-h-80 w-72 overflow-y-auto rounded-lg border border-line bg-surface p-2 text-left shadow-lg"
		>
			<p class="mb-1 px-1 text-xs font-semibold text-muted">
				{videos.length === 1 ? '1 recorded round' : `${videos.length} recorded rounds`}
			</p>
			<div class="grid {videos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}">
				{#each videos as v (v.id)}
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
