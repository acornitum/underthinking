<script lang="ts">
	import { beforeNavigate, invalidate } from '$app/navigation';
	import { createLivePreview } from '#lib/livePreview.ts';
	import { untrack } from 'svelte';
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
	let tab = $state<'plain' | 'rich'>('rich');
	// Focus the editor when switching tabs, but not on load (it'd scroll past the motion).
	let switched = false;
	let timer: ReturnType<typeof setTimeout>;

	// Words as you'd count them in the rendered note: list bullets, numbers,
	// heading and quote marks aren't words, and neither is stray punctuation.
	let words = $derived(
		body
			.replace(/^\s*(#{1,6}|[-*+]|\d+[.)]|>)\s+/gm, '')
			.split(/\s+/)
			.filter((w) => /[\p{L}\p{N}]/u.test(w)).length
	);
	let details = $derived(
		[m.round, [m.city, m.country].filter((v) => v && v.trim() !== '-').join(', '), m.level, m.style]
			.filter(Boolean)
			.join(' · ')
	);

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

	// The rich-formatting tab edits the same Markdown text (see livePreview.ts),
	// so the plain-text tab and saving don't need to know which tab was used.
	function richEditor(element: HTMLElement) {
		// Untracked, or every change to `body` would rebuild the editor.
		const view = createLivePreview(
			element,
			untrack(() => body),
			(text) => {
				body = text;
				oninput();
			}
		);
		if (switched) view.focus();
		return () => view.destroy();
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

	<div class="mb-4 flex items-center justify-between gap-4 font-mono text-xs">
		<div class="flex gap-1" role="tablist">
			{#each [['rich', 'Rich formatting'], ['plain', 'Plain text']] as const as [t, label] (t)}
				<button
					type="button"
					role="tab"
					aria-selected={tab === t}
					class="cursor-pointer rounded-md px-2.5 py-1 {tab === t
						? 'bg-line text-ink'
						: 'text-muted hover:text-ink'}"
					onclick={() => {
						switched = true;
						tab = t;
					}}
				>
					{label}
				</button>
			{/each}
		</div>
		<span class="text-chip">{words.toLocaleString()} {words === 1 ? 'word' : 'words'}</span>
	</div>

	{#if tab === 'plain'}
		<!-- The textarea grows with its text: an invisible copy of the text sits in
		     the same grid cell and sets the height, so the textarea never has to
		     collapse to be measured. The copy has a spare line at the end so it's
		     never shorter than the text, and the textarea is pinned to the top: if
		     it ever scrolled inside itself, typing would jump the text so the
		     cursor sat at its bottom edge. -->
		<div class="grid min-h-[60vh] font-mono text-sm leading-relaxed">
			<!-- prettier-ignore -->
			<div aria-hidden="true" class="invisible [grid-area:1/1] break-words whitespace-pre-wrap">{body}{'\n '}</div>
			<textarea
				bind:value={body}
				{oninput}
				onscroll={(e) => (e.currentTarget.scrollTop = 0)}
				placeholder="Write notes in Markdown…"
				aria-label="Notes (Markdown)"
				spellcheck="true"
				class="block w-full resize-none overflow-hidden bg-transparent text-motion [grid-area:1/1] placeholder:text-chip focus:outline-none"
			></textarea>
		</div>
	{:else}
		<div {@attach richEditor} class="text-base"></div>
	{/if}
</article>
