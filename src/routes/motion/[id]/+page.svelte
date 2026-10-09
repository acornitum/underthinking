<script lang="ts">
	import { tick } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let m = $derived(data.motion);
	let details = $derived(
		[m.tournament_name, m.round, m.style].filter((v) => v && v.trim() !== '-').join(' · ')
	);

	// Edits live only in this tab: nothing is saved, and reloading or closing
	// the page brings back the original. (The page is re-mounted per motion.)
	const original = () => ({ motion: data.motion.motion, infoslide: data.motion.infoslide ?? '' });
	let motion = $state(original().motion);
	let infoslide = $state(original().infoslide);
	let edited = $derived(motion !== m.motion || infoslide !== (m.infoslide ?? ''));

	// Click the motion or infoslide to edit it; click anywhere else (or press
	// Escape) to stop.
	let editing = $state(false);
	let editor = $state<HTMLElement>();
	let motionInput = $state<HTMLTextAreaElement>();
	let infoslideInput = $state<HTMLTextAreaElement>();

	async function startEditing(field: 'motion' | 'infoslide', e: MouseEvent) {
		// Place the cursor roughly where the text was clicked.
		const offset = document.caretPositionFromPoint?.(e.clientX, e.clientY)?.offset;
		editing = true;
		await tick();
		const input = field === 'motion' ? motionInput : infoslideInput;
		input?.focus();
		if (input && offset !== undefined) input.setSelectionRange(offset, offset);
	}

	function onwindowpointerdown(e: PointerEvent) {
		if (editing && !editor?.contains(e.target as Node)) editing = false;
	}

	function onwindowkeydown(e: KeyboardEvent) {
		if (editing && e.key === 'Escape') editing = false;
	}

	function reset() {
		({ motion, infoslide } = original());
	}

	function autosize(el: HTMLTextAreaElement) {
		const resize = () => {
			el.style.height = 'auto';
			el.style.height = `${el.scrollHeight}px`;
		};
		resize();
		el.addEventListener('input', resize);
		return () => el.removeEventListener('input', resize);
	}

	// Shared by the text and its edit box, so switching doesn't move anything.
	const box = 'w-full rounded-lg px-4 py-3 text-center';
	const motionClass =
		'max-w-[24em] text-[clamp(2rem,5vw,4.75rem)] leading-tight font-bold text-balance text-ink';
	const infoslideClass =
		'max-w-[48em] text-[clamp(1rem,1.9vw,1.6rem)] leading-relaxed whitespace-pre-line text-subtle';
	// Hovering either one highlights both (see `group` on the wrapper).
	const shownClass = 'cursor-text transition-colors group-hover:bg-surface/60';
	const fieldClass = 'block resize-none bg-surface placeholder:text-chip focus:outline-none';
</script>

<svelte:head>
	<title>{motion || m.motion}</title>
</svelte:head>

<svelte:window onpointerdown={onwindowpointerdown} onkeydown={onwindowkeydown} />

<a
	href="/"
	class="fixed top-4 left-4 z-10 rounded-md px-3 py-1.5 text-sm text-chip transition-colors hover:bg-surface hover:text-muted"
>
	← Back
</a>

<!-- Big, centred motion for showing on a projector or second screen. -->
<div
	class="flex min-h-screen flex-col items-center justify-center bg-page px-[6vw] pt-16 pb-24 text-center"
>
	{#if !edited}
		<p class="mb-[4vh] text-[clamp(0.875rem,1.6vw,1.25rem)] text-muted">{details}</p>
	{/if}

	<div bind:this={editor} class="group flex w-full flex-col items-center">
		{#if editing}
			<textarea
				bind:this={motionInput}
				{@attach autosize}
				bind:value={motion}
				rows="1"
				aria-label="Motion"
				placeholder="Motion"
				class="{box} {motionClass} {fieldClass}"></textarea>
			<textarea
				bind:this={infoslideInput}
				{@attach autosize}
				bind:value={infoslide}
				rows="2"
				aria-label="Infoslide"
				placeholder="Infoslide (optional)"
				class="mt-[2.5vh] {box} {infoslideClass} {fieldClass}"></textarea>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
			<h1
				class="{box} {motionClass} {shownClass}"
				title="Click to edit"
				onclick={(e) => startEditing('motion', e)}
			>
				{motion}
			</h1>
			{#if infoslide.trim()}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<p
					class="mt-[2.5vh] {box} {infoslideClass} {shownClass}"
					title="Click to edit"
					onclick={(e) => startEditing('infoslide', e)}
				>
					{infoslide}
				</p>
			{/if}
		{/if}
	</div>
</div>

{#if edited}
	<div class="fixed inset-x-0 bottom-4 flex justify-center text-sm">
		<button
			type="button"
			class="cursor-pointer rounded-md px-3 py-1.5 text-chip transition-colors hover:bg-surface hover:text-muted"
			onclick={reset}
		>
			Reset
		</button>
	</div>
{/if}
