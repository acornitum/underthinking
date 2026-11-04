<script lang="ts">
	import type { Video } from '#lib/server/videos.ts';

	let { video }: { video: Video } = $props();

	// Just the thumbnail until it's clicked: a page of YouTube players would load
	// megabytes of script, while a thumbnail is one small image.
	let playing = $state(false);
</script>

<figure class="m-0">
	<div class="relative aspect-video overflow-hidden rounded-lg bg-line">
		{#if playing}
			<iframe
				class="absolute inset-0 size-full"
				src="https://www.youtube-nocookie.com/embed/{video.id}?autoplay=1"
				title={video.title}
				allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
				allowfullscreen
			></iframe>
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
				<span
					class="absolute inset-0 m-auto flex h-10 w-14 items-center justify-center rounded-xl bg-black/70 text-white transition-colors group-hover:bg-[#f00]"
					aria-hidden="true"
				>
					<svg class="size-5" viewBox="0 0 24 24" fill="currentColor"
						><path d="M8 5v14l11-7z" /></svg
					>
				</span>
			</button>
		{/if}
	</div>
	<figcaption class="mt-1 flex justify-between gap-2 text-sm text-card-details">
		<span class="truncate">{video.label || video.title}</span>
		<a
			href="https://www.youtube.com/watch?v={video.id}"
			target="_blank"
			rel="noreferrer"
			class="shrink-0 underline hover:text-muted">YouTube</a
		>
	</figcaption>
</figure>
