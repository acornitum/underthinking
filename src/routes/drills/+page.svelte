<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { Motion } from '#lib/server/db.ts';

	const PRESETS = [1, 3, 5, 10, 15];
	const STORAGE_KEY = 'drill-minutes';
	const SECONDS_KEY = 'drill-seconds';
	const DEFAULT_MINUTES = 15;

	type SideChoice = 'gov' | 'opp' | 'coin';
	const SIDES: { value: SideChoice; label: string }[] = [
		{ value: 'gov', label: 'Gov' },
		{ value: 'opp', label: 'Opp' },
		{ value: 'coin', label: 'Coin flip' }
	];
	const SIDE_KEY = 'drill-side';
	const SOUND_KEY = 'drill-sound';

	let minutes = $state(DEFAULT_MINUTES);
	let seconds = $state(0);
	let chosenMs = $derived(((minutes || 0) * 60 + (seconds || 0)) * 1000);
	let side = $state<SideChoice>('gov');
	let sound = $state(true);
	// The side for the current motion (coin flips happen once per motion), and
	// the setting it came from, so a changed setting re-assigns on "continue".
	let assigned = $state<{ side: 'Gov' | 'Opp'; from: SideChoice } | null>(null);
	let drilling = $state(false);
	let motion = $state<Motion | null>(null);
	let loading = $state(false);
	let noMatches = $state(false);

	let endsAt = 0;
	let durationMs = $state(0);
	let remainingMs = $state(0);
	let ticker: ReturnType<typeof setInterval> | undefined;

	let remainingText = $derived.by(() => {
		const total = Math.ceil(remainingMs / 1000);
		return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
	});
	let progress = $derived(durationMs ? remainingMs / durationMs : 0);
	let details = $derived(
		motion
			? [motion.tournament_name, motion.round, motion.style]
					.filter((v) => v && v.trim() !== '-')
					.join(' · ')
			: ''
	);

	onMount(() => {
		try {
			const saved = Number(localStorage.getItem(STORAGE_KEY));
			if (saved >= 0 && saved <= 180) minutes = saved;
			const savedSeconds = Number(localStorage.getItem(SECONDS_KEY));
			if (savedSeconds >= 0 && savedSeconds <= 59) seconds = savedSeconds;
			const savedSide = localStorage.getItem(SIDE_KEY);
			if (SIDES.some((s) => s.value === savedSide)) side = savedSide as SideChoice;
			if (localStorage.getItem(SOUND_KEY) === 'off') sound = false;
		} catch {
			// Storage blocked: keep the default.
		}
	});

	// Leaving the Drills page (e.g. to All motions) stops the timer and its sound
	// for good. Switching browser tabs doesn't: the timer keeps running and chimes.
	onDestroy(() => {
		clearInterval(ticker);
		audio?.close();
		audio = undefined;
	});

	let paused = $state(false);

	// Count down from `ms`, ticking a few times a second.
	function run(ms: number) {
		clearInterval(ticker);
		paused = false;
		endsAt = Date.now() + ms;
		remainingMs = ms;
		ticker = setInterval(() => {
			remainingMs = Math.max(0, endsAt - Date.now());
			if (remainingMs === 0) {
				clearInterval(ticker);
				if (sound) chime();
			}
		}, 250);
	}

	function startTimer() {
		durationMs = chosenMs;
		run(durationMs);
	}

	function togglePause() {
		if (paused) {
			run(remainingMs);
		} else {
			clearInterval(ticker);
			remainingMs = Math.max(0, endsAt - Date.now());
			paused = true;
		}
	}

	// A random motion matching the sidebar filters and search.
	function assignSide() {
		const isGov = side === 'coin' ? Math.random() < 0.5 : side === 'gov';
		assigned = { side: isGov ? 'Gov' : 'Opp', from: side };
	}

	async function newMotion() {
		loading = true;
		try {
			const res = await fetch(`/api/random${page.url.search}`);
			motion = await res.json();
			noMatches = motion === null;
			if (motion) {
				assignSide();
				startTimer();
			}
		} finally {
			loading = false;
		}
	}

	// A short rising three-note chime, synthesised so there's no audio file.
	// Browsers only allow sound after a user gesture, so the audio context is
	// created (unlocked) when start/continue is pressed, then reused later.
	let audio: AudioContext | undefined;

	function unlockAudio() {
		if (!sound) return;
		audio ??= new AudioContext();
		if (audio.state === 'suspended') audio.resume();
	}

	function chime() {
		if (!audio) return;
		const now = audio.currentTime;
		[880, 1108.73, 1318.51].forEach((freq, i) => {
			const osc = audio!.createOscillator();
			const gain = audio!.createGain();
			const t = now + i * 0.18;
			osc.type = 'sine';
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
			osc.connect(gain).connect(audio!.destination);
			osc.start(t);
			osc.stop(t + 0.95);
		});
	}

	async function start() {
		unlockAudio();
		minutes = Math.min(180, Math.max(0, Math.round(minutes) || 0));
		seconds = Math.min(59, Math.max(0, Math.round(seconds) || 0));
		if (minutes === 0 && seconds === 0) minutes = DEFAULT_MINUTES;
		try {
			localStorage.setItem(STORAGE_KEY, String(minutes));
			localStorage.setItem(SECONDS_KEY, String(seconds));
			localStorage.setItem(SIDE_KEY, side);
			localStorage.setItem(SOUND_KEY, sound ? 'on' : 'off');
		} catch {
			// Storage blocked: the choice lasts for this visit only.
		}
		drilling = true;
		if (!motion) return newMotion();
		if (assigned?.from !== side) assignSide();
		// Coming back from settings keeps the motion. Same prep time: carry on
		// where the timer was; a new prep time (or a finished one): start over.
		if (chosenMs === durationMs && remainingMs > 0) run(remainingMs);
		else startTimer();
	}

	// While drilling (and not typing in a field): space pauses/resumes, and
	// enter gets a new motion with a fresh timer.
	function onkeydown(e: KeyboardEvent) {
		if (!drilling || (e.code !== 'Space' && e.key !== 'Enter')) return;
		const target = e.target as HTMLElement;
		if (target.closest('input, textarea, select, [contenteditable]')) return;
		e.preventDefault(); // no page scroll, and no "click" on a focused button
		if (e.repeat) return;
		if (e.key === 'Enter') {
			if (!loading) newMotion();
		} else if (motion && remainingMs > 0) {
			togglePause();
		}
	}

	function editSettings() {
		// Pause rather than stop, so the timer can carry on afterwards.
		if (!paused) togglePause();
		drilling = false;
	}

	// Same size as the random page's buttons; only "start" uses the accent colour.
	const button =
		'cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-60';
	// The setup box's start/continue button is larger, to match the bigger box.
	const startButton =
		'w-full cursor-pointer rounded-lg bg-accent px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-accent-hover';
	const secondary = `${button} bg-surface text-muted hover:bg-line hover:text-ink`;
	const iconButton =
		'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-line hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<svelte:head>
	<title>Drills</title>
</svelte:head>

<svelte:window {onkeydown} />

{#if !drilling}
	<div class="flex flex-1 items-center justify-center">
		<form
			class="w-full max-w-lg rounded-xl bg-surface p-6 md:p-9"
			onsubmit={(e) => (e.preventDefault(), start())}
		>
			<h1 class="mb-6 text-3xl font-bold">Drills</h1>

			<label class="mb-3 block text-base font-bold" for="minutes">Prep time</label>
			<div class="mb-4 flex flex-wrap items-center gap-2.5">
				<input
					id="minutes"
					type="number"
					min="0"
					max="180"
					bind:value={minutes}
					class="w-24 rounded-lg bg-page px-4 py-2.5 text-xl font-bold text-ink focus:outline-none"
				/>
				<span class="text-muted">minutes</span>
				<input
					type="number"
					min="0"
					max="59"
					bind:value={seconds}
					aria-label="Seconds"
					class="ml-2 w-24 rounded-lg bg-page px-4 py-2.5 text-xl font-bold text-ink focus:outline-none"
				/>
				<span class="text-muted">seconds</span>
			</div>
			<div class="mb-8 flex flex-wrap gap-2">
				{#each PRESETS as preset (preset)}
					<button
						type="button"
						class="cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm transition-colors {minutes ===
							preset && !seconds
							? 'border-selected bg-selected text-ink'
							: 'border-line text-muted hover:bg-line hover:text-ink'}"
						onclick={() => ((minutes = preset), (seconds = 0))}
					>
						{preset} min
					</button>
				{/each}
			</div>

			<p class="mb-3 text-base font-bold">Side</p>
			<div class="mb-8 flex flex-wrap gap-2">
				{#each SIDES as option (option.value)}
					<button
						type="button"
						class="cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm transition-colors {side ===
						option.value
							? 'border-selected bg-selected text-ink'
							: 'border-line text-muted hover:bg-line hover:text-ink'}"
						aria-pressed={side === option.value}
						onclick={() => (side = option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>

			<div class="mb-8 flex items-center justify-between gap-3">
				<span class="text-base font-bold" id="sound-label"
					>Sound <span class="font-normal text-muted">(when timer finishes)</span></span
				>
				<button
					type="button"
					role="switch"
					aria-checked={sound}
					aria-labelledby="sound-label"
					class="relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors {sound
						? 'bg-selected'
						: 'bg-line'}"
					onclick={() => (sound = !sound)}
				>
					<span
						class="absolute top-0.5 left-0.5 size-6 rounded-full bg-ink transition-transform {sound
							? 'translate-x-5'
							: ''}"
					></span>
				</button>
			</div>

			<button type="submit" class={startButton}>{motion ? 'continue' : 'start'}</button>
		</form>
	</div>
{:else}
	<div class="flex flex-1 flex-col">
		<div class="flex justify-center gap-3">
			<button type="button" class={secondary} disabled={loading} onclick={newMotion}>
				new motion
			</button>
			<button type="button" class={secondary} onclick={editSettings}>edit settings</button>
		</div>
		<!-- The space above and below the motion is split evenly, so the motion
		     sits centred between the buttons and the timer. -->
		<div class="min-h-12 flex-1"></div>

		<!-- w-fit: the motion sets the width, and the infoslide (w-0 min-w-full)
		     takes exactly that width without widening it. -->
		<div class="mx-auto flex w-fit max-w-full flex-col items-center text-center">
			{#if motion}
				<p class="mb-[3vh] text-[clamp(0.8rem,1.2vw,1rem)] text-muted">{details}</p>
				<h1
					class="max-w-[34em] text-[clamp(1.25rem,2.5vw,2.25rem)] leading-tight font-bold text-pretty text-ink"
				>
					{motion.motion}
				</h1>
				{#if motion.infoslide}
					<p
						class="mt-[3vh] w-0 min-w-full text-[clamp(0.9rem,1.3vw,1.15rem)] leading-relaxed whitespace-pre-line text-infoslide"
					>
						{motion.infoslide}
					</p>
				{/if}
			{:else if noMatches}
				<p class="text-muted">No motions match these filters.</p>
			{/if}
		</div>
		<div class="min-h-12 flex-1"></div>

		{#if motion}
			<div class="text-center">
				{#if assigned}
					<!-- Opposition uses the paused-timer colour, so the sides look different. -->
					<p
						class="mb-1 text-sm font-bold {assigned.side === 'Opp'
							? 'text-progress-paused'
							: 'text-tournament'}"
					>
						You are on side: {assigned.side === 'Opp' ? 'Opposition' : 'Government'}
					</p>
				{/if}
				<p class="mb-2 text-sm font-bold text-muted md:text-base" aria-live="polite">
					{remainingMs > 0 ? `${remainingText} left${paused ? ' · paused' : ''}` : "Time's up"}
				</p>
				<div class="flex items-center gap-1">
					<button
						type="button"
						class={iconButton}
						disabled={remainingMs === 0}
						aria-label={paused ? 'Resume timer' : 'Pause timer'}
						title={paused ? 'Resume' : 'Pause'}
						onclick={togglePause}
					>
						<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							{#if paused}
								<path
									d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"
								/>
							{:else}
								<rect x="6" y="4" width="4" height="16" rx="1.5" />
								<rect x="14" y="4" width="4" height="16" rx="1.5" />
							{/if}
						</svg>
					</button>
					<div
						class="h-4 w-full min-w-0 flex-1 overflow-hidden rounded-full bg-line md:h-5"
						role="progressbar"
						aria-label="Prep time remaining"
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={Math.round(progress * 100)}
					>
						<div
							class="h-full rounded-full transition-[width,background-color] duration-300 ease-linear {paused
								? 'bg-progress-paused'
								: 'bg-progress'}"
							style:width="{progress * 100}%"
						></div>
					</div>
					<button
						type="button"
						class={iconButton}
						aria-label="Reset timer"
						title="Reset"
						onclick={() => run(durationMs)}
					>
						<svg
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
							<path d="M3 3v5h5" />
						</svg>
					</button>
				</div>
				<p class="-mt-1 text-xs text-chip">
					Press space to pause timer. Press enter for new motion.
				</p>
			</div>
		{/if}
	</div>
{/if}
