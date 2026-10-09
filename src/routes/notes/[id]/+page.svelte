<script lang="ts">
	import { beforeNavigate, invalidate } from '$app/navigation';
	import { marked } from 'marked';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let m = $derived(data.motion);

	// The editor owns the text after load; the page is re-keyed per motion
	// (see +layout.svelte), so this only needs the note it was opened with.
	const loaded = () => data.note?.body ?? '';
	let body = $state(loaded());
	const loadedFile = () => data.file;
	let file = $state(loadedFile());
	let saved = loaded();
	let status = $state<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
	let tab = $state<'write' | 'preview'>('write');
	let timer: ReturnType<typeof setTimeout>;

	let details = $derived(
		[m.round, [m.city, m.country].filter((v) => v && v.trim() !== '-').join(', '), m.level, m.style]
			.filter(Boolean)
			.join(' · ')
	);
	let preview = $derived(marked.parse(body, { async: false }));

	// `keepalive` lets the request finish even if the tab is closing.
	async function save() {
		clearTimeout(timer);
		if (body === saved) return;
		const sending = body;
		status = 'saving';
		try {
			const res = await fetch(`/api/notes/${m.id}`, {
				method: 'POST',
				body: sending,
				keepalive: true
			});
			if (!res.ok) throw new Error(res.statusText);
			file = (await res.json()).file;
			saved = sending;
			status = body === saved ? 'saved' : 'unsaved';
			invalidate('app:notes');
		} catch {
			status = 'error';
		}
	}

	function oninput() {
		status = 'unsaved';
		clearTimeout(timer);
		timer = setTimeout(save, 800);
	}

	function onkeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			save();
		}
	}

	// Save when leaving: in-app navigation, or closing/hiding the tab.
	beforeNavigate(() => save());

	function autosize(el: HTMLTextAreaElement) {
		const resize = () => {
			el.style.height = 'auto';
			el.style.height = `${el.scrollHeight}px`;
		};
		resize();
		el.addEventListener('input', resize);
		return () => el.removeEventListener('input', resize);
	}
</script>

<svelte:window
	{onkeydown}
	onpagehide={save}
	onvisibilitychange={() => document.visibilityState === 'hidden' && save()}
/>

<svelte:head>
	<title>Notes · {m.motion}</title>
</svelte:head>

<div class="mb-6 flex items-center justify-between gap-4 text-sm">
	<button
		type="button"
		class="cursor-pointer text-muted hover:text-ink"
		onclick={() => (history.length > 1 ? history.back() : (location.href = '/'))}
	>
		← Back
	</button>
	{#if file}
		<span class="ml-auto truncate font-mono text-xs text-chip" title={file.absolute}>
			{file.relative}
		</span>
		<a
			href="obsidian://open?path={encodeURIComponent(file.absolute)}"
			class="shrink-0 text-muted hover:text-ink"
		>
			Open in Obsidian
		</a>
	{/if}
	<span class="text-muted" aria-live="polite">
		{#if status === 'saving'}Saving…{:else if status === 'unsaved'}Unsaved changes{:else if status === 'error'}<span
				class="text-accent">Couldn't save — retrying when you type</span
			>{:else}Saved{/if}
	</span>
</div>

<article>
	<header class="mb-6 border-b border-line pb-6">
		<p class="mb-2 font-mono text-sm text-chip"># Motion</p>
		<h1 class="text-2xl leading-snug font-bold text-ink">{m.motion}</h1>
		<p class="mt-3 text-sm text-muted">
			{#if m.tab_url}
				<a href={m.tab_url} class="underline hover:text-ink" target="_blank" rel="noreferrer">
					{m.tournament_name}
				</a>
			{:else}
				{m.tournament_name}
			{/if}
			{#if details}· {details}{/if}
		</p>
		{#if m.infoslide}
			<blockquote
				class="mt-5 border-l-4 border-line pl-4 text-sm whitespace-pre-line text-infoslide"
			>
				{m.infoslide}
			</blockquote>
		{/if}
	</header>

	<div class="mb-4 flex gap-1 font-mono text-xs" role="tablist">
		{#each ['write', 'preview'] as const as t (t)}
			<button
				type="button"
				role="tab"
				aria-selected={tab === t}
				class="cursor-pointer rounded-md px-2.5 py-1 capitalize {tab === t
					? 'bg-line text-ink'
					: 'text-muted hover:text-ink'}"
				onclick={() => (tab = t)}
			>
				{t}
			</button>
		{/each}
	</div>

	{#if tab === 'write'}
		<textarea
			{@attach autosize}
			bind:value={body}
			{oninput}
			placeholder="Write notes in Markdown…"
			aria-label="Notes (Markdown)"
			spellcheck="true"
			class="block min-h-[60vh] w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-motion placeholder:text-chip focus:outline-none"
		></textarea>
	{:else if body.trim()}
		<div class="prose max-w-none dark:prose-invert">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- the user's own notes -->
			{@html preview}
		</div>
	{:else}
		<p class="text-sm text-chip">Nothing to preview yet.</p>
	{/if}
</article>
