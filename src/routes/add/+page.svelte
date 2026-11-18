<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Kind = 'motion' | 'video';
	// Links can open a form and fill in the tournament: /add?kind=video&tournament=…
	let kind = $state<Kind>(page.url.searchParams.get('kind') === 'video' ? 'video' : 'motion');
	const prefill = page.url.searchParams.get('tournament') ?? '';

	// "Nov 18" this year, "Nov 18, 2025" before. UTC, so server and browser agree.
	function submittedOn(iso: string) {
		const d = new Date(iso);
		const thisYear = d.getUTCFullYear() === new Date().getUTCFullYear();
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: thisYear ? undefined : 'numeric',
			timeZone: 'UTC'
		});
	}
	let started = $state(0);
	let submitting = $state(false);

	const input =
		'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-chip focus:border-chip focus:outline-none';
	const label = 'mb-1 block text-xs font-bold text-muted';

	// Free-text tournament fields, with existing values suggested.
	const FIELDS = [
		['level', 'Level'],
		['style', 'Style'],
		['region', 'Region'],
		['country', 'Country'],
		['city', 'City']
	] as const;

	const invalid = (field: string) =>
		form && !form.ok && form.field === field ? ('true' as const) : undefined;

	// Cloudflare Turnstile, rendered explicitly so it also works after
	// client-side navigation to this page. Tokens are single use, so it's reset
	// after each submit.
	type Turnstile = {
		render: (el: HTMLElement, opts: Record<string, unknown>) => string;
		reset: (id?: string) => void;
	};
	let widget = $state<HTMLElement>();
	let widgetId: string | undefined;
	const turnstile = () => (window as unknown as { turnstile?: Turnstile }).turnstile;

	onMount(() => {
		started = Date.now();
		const key = data.turnstileSiteKey;
		if (!key || !widget) return;
		const render = () => (widgetId = turnstile()!.render(widget!, { sitekey: key, theme: 'auto' }));
		if (turnstile()) return void render();
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.onload = render;
		document.head.append(script);
	});
</script>

<svelte:head>
	<title>Submit a motion or recording · underthink</title>
</svelte:head>

<div class="mb-6 max-w-2xl">
	<h1 class="text-3xl font-bold">Submit</h1>
	<p class="mt-2 text-sm text-muted">
		Want to add tournament motions or a recorded round that’s missing? Fill out the form below! Note
		that everything submitted here is public.
	</p>
</div>

{#if form?.ok}
	<div class="mb-6 max-w-2xl rounded-lg border border-line bg-surface p-4 text-sm" role="status">
		{#if form.duplicate}
			<p class="font-bold">{form.duplicate}</p>
			<p class="mt-1 text-muted">
				If you think this is a mistake, message Acon on discord (or facebook)!
			</p>
		{:else}
			<p class="font-bold">Thanks! Your submission is in the queue.</p>
			<p class="mt-1 text-muted">It’ll show up on the site once it’s been reviewed.</p>
		{/if}
	</div>
{/if}

<form
	method="POST"
	class="max-w-2xl space-y-4"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
			started = Date.now();
			if (widgetId !== undefined) turnstile()?.reset(widgetId);
		};
	}}
>
	<!-- A segmented control: an outlined track, with the chosen option sunk into it. -->
	<fieldset
		class="inline-flex gap-0.5 rounded-lg border border-line p-0.5"
		aria-label="What are you submitting?"
	>
		{#each [['motion', 'Motions'], ['video', 'Recorded round']] as [value, text] (value)}
			<label
				class="cursor-pointer rounded-md px-3 py-1 text-sm font-bold transition-colors has-focus-visible:ring-2 has-focus-visible:ring-chip {kind ===
				value
					? 'bg-surface text-ink'
					: 'text-muted hover:text-ink'}"
			>
				<input type="radio" name="kind" {value} bind:group={kind} class="sr-only" />
				{text}
			</label>
		{/each}
	</fieldset>

	{#if kind === 'motion'}
		<!-- The same tournament fields as data/motions.csv; only the tab link is required. -->
		<div>
			<label for="tournament" class={label}>Tournament name</label>
			<input
				id="tournament"
				name="tournament"
				value={prefill}
				maxlength="150"
				placeholder="e.g. Waterloo IV 2026"
				class={input}
			/>
		</div>
		<div>
			<label for="url" class={label}>Tab URL *</label>
			<input
				id="url"
				name="url"
				type="url"
				maxlength="500"
				required
				placeholder="https://example.calicotab.com/tournament/motions/"
				class={input}
				aria-invalid={invalid('url')}
			/>
			<p class="mt-1 text-xs text-muted">Every motion is read from the tab during review.</p>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="date" class={label}>Date (first day)</label>
				<input id="date" name="date" type="date" class={input} aria-invalid={invalid('date')} />
			</div>
			{#each FIELDS as [name, text] (name)}
				<div>
					<label for={name} class={label}>{text}</label>
					<input
						id={name}
						{name}
						maxlength="60"
						list="{name}-list"
						autocomplete="off"
						class={input}
					/>
					<datalist id="{name}-list">
						{#each data.suggestions[name] as option (option)}
							<option value={option}></option>
						{/each}
					</datalist>
				</div>
			{/each}
		</div>
	{:else}
		<div>
			<label for="url" class={label}>YouTube link *</label>
			<input
				id="url"
				name="url"
				type="url"
				maxlength="500"
				required
				placeholder="https://www.youtube.com/watch?v=…"
				class={input}
				aria-invalid={invalid('url')}
			/>
			<p class="mt-1 text-xs text-muted">A single video, or a playlist or channel of rounds.</p>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="tournament" class={label}>Tournament</label>
				<input
					id="tournament"
					name="tournament"
					value={prefill}
					maxlength="150"
					placeholder="e.g. Waterloo IV 2026"
					class={input}
				/>
			</div>
			<div>
				<label for="round" class={label}>Round</label>
				<input
					id="round"
					name="round"
					maxlength="60"
					placeholder="e.g. Round 3, Grand Final"
					class={input}
				/>
			</div>
		</div>
		<div>
			<label for="motion" class={label}>Motion</label>
			<textarea
				id="motion"
				name="motion"
				maxlength="600"
				rows="2"
				class={input}
				placeholder="This house would…"></textarea>
		</div>
	{/if}

	<div>
		<label for="notes" class={label}>Anything else?</label>
		<textarea
			id="notes"
			name="notes"
			maxlength="1000"
			rows="2"
			class={input}
			placeholder="Context, who you are, how your day was, anything else really!"></textarea>
	</div>

	<!-- Bot traps: a field people never see, and when the form was opened. -->
	<div class="hidden" aria-hidden="true">
		<label>Website <input name="website" tabindex="-1" autocomplete="off" /></label>
	</div>
	<input type="hidden" name="started" value={started || ''} />

	{#if data.turnstileSiteKey}
		<div bind:this={widget}></div>
	{/if}

	<div class="flex flex-wrap items-center gap-3">
		<button
			type="submit"
			disabled={submitting}
			class="cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-50"
		>
			{submitting ? 'Sending…' : 'Submit'}
		</button>
		{#if form && !form.ok}
			<p class="text-sm text-red-500" role="alert">{form.message}</p>
		{/if}
	</div>
</form>

<!-- Open submissions, from the GitHub issues. Hidden if GitHub can't be reached. -->
{#if data.queue}
	<section class="mt-12 max-w-2xl">
		<h2 class="mb-1 text-lg font-bold">In the queue</h2>
		<p class="mb-3 text-sm text-muted">
			{data.queue.length
				? `${data.queue.length} submission${data.queue.length === 1 ? '' : 's'} waiting for review.`
				: 'Nothing currently in queue! New submissions may take a minute to show up.'}
		</p>
		{#if data.queue.length}
			<ul class="divide-y divide-line rounded-lg border border-line text-sm">
				{#each data.queue as item (item.url + item.submitted)}
					<li class="flex items-baseline gap-3 px-3 py-2">
						<!-- Links come from anyone: nofollow ugc, and no referrer. -->
						<a
							href={item.url}
							target="_blank"
							rel="nofollow ugc noreferrer"
							class="min-w-0 flex-1 truncate hover:underline"
						>
							{item.url.replace(/^https?:\/\/(www\.)?/, '')}
						</a>
						<span class="shrink-0 text-xs text-muted">
							Submitted <time datetime={item.submitted}>{submittedOn(item.submitted)}</time>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
