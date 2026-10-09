<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { HAS_NOTES } from '#lib/filters.ts';
	import favicon from '#lib/assets/catfavicon.png';
	import logo from '#lib/assets/underthinklogo.svg';
	import cat from '#lib/assets/underthinkcat.png';
	import SidebarFilters from '#lib/SidebarFilters.svelte';
	import Toast from '#lib/Toast.svelte';
	import { THEMES, theme } from '#lib/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = [
		{ href: '/', label: 'All motions' },
		{ href: '/random', label: 'Random motion' },
		{ href: '/drills', label: 'Drills' }
	];

	let sidebarOpen = $state(true);

	// On phones the sidebar covers the page, so following one of its page links
	// closes it. (On desktop it sits beside the page and stays open.)
	function closeOnPhone() {
		if (window.innerWidth < 768) sidebarOpen = false;
	}

	// "With notes" toggles ?notes=yes on the motion lists, keeping other filters.
	let notesOn = $derived(page.url.searchParams.get('notes') === HAS_NOTES);
	let notesHref = $derived.by(() => {
		const onList = page.url.pathname === '/' || page.url.pathname === '/random';
		const url = new URL(onList ? page.url.href : '/', page.url.origin);
		if (notesOn) url.searchParams.delete('notes');
		else url.searchParams.set('notes', HAS_NOTES);
		return url.pathname + url.search;
	});

	// Start collapsed on phones so the sidebar doesn't cover the content.
	// Until then, the sidebar is hidden on phones so it doesn't flash open on load.
	let mounted = $state(false);
	onMount(() => {
		if (window.innerWidth < 768) sidebarOpen = false;
		theme.sync();
		mounted = true;
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={favicon} />
</svelte:head>

{#snippet toggle()}
	<button
		type="button"
		class="cursor-pointer rounded-md p-1 hover:bg-line"
		aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
		aria-expanded={sidebarOpen}
		onclick={() => (sidebarOpen = !sidebarOpen)}
	>
		<svg
			class="size-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<path d="M9 3v18" />
		</svg>
	</button>
{/snippet}

{#if page.url.pathname.startsWith('/motion/')}
	<!-- The large-text motion view is shown on its own, without the sidebar. -->
	{@render children()}
{:else}
	<!-- The notes editor gets the darker surface colour so it reads as a document. -->
	<div
		class="flex min-h-dvh text-ink {page.url.pathname.startsWith('/notes/')
			? 'bg-surface'
			: 'bg-page'}"
	>
		<!-- Phones get a top bar with the sidebar button and site name. -->
		<header
			class="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 text-subtle md:hidden"
		>
			{@render toggle()}
			<a href="/" class="text-base font-bold text-ink">debate motions</a>
			<button
				type="button"
				class="ml-auto cursor-pointer rounded-md px-2.5 py-1 text-sm text-chip transition-colors hover:bg-line hover:text-muted"
				onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
			>
				back to top
			</button>
		</header>

		{#if sidebarOpen}
			<!-- Phones: the sidebar opens over the page, so tapping anywhere else
			     closes it (without that tap reaching the page underneath). -->
			<button
				type="button"
				class="fixed inset-0 z-[25] cursor-default md:hidden {mounted ? '' : 'hidden'}"
				aria-label="Close sidebar"
				onclick={() => (sidebarOpen = false)}
			></button>
			<aside
				class="fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col border-r border-line bg-surface text-ink shadow-lg md:sticky md:top-0 md:h-screen md:shadow-none {mounted
					? ''
					: 'max-md:hidden'}"
			>
				<div class="flex items-center justify-between px-4 pt-4 pb-3">
					<!-- The logo is white artwork used as a mask, so it can take each
					     theme's logo colour. -->
					<a href="/" aria-label="underthink: all motions" onclick={closeOnPhone}>
						<span
							class="block h-[21px] w-[72px] bg-logo"
							style:mask="url({logo}) left center / contain no-repeat"
							style:-webkit-mask="url({logo}) left center / contain no-repeat"
							aria-hidden="true"
						></span>
					</a>
					{@render toggle()}
				</div>

				<nav class="border-b border-line px-2 pb-4">
					<ul class="space-y-0.5">
						{#each links as link (link.href)}
							<li>
								<a
									href={link.href + page.url.search}
									onclick={closeOnPhone}
									class="block rounded-md px-2.5 py-1 text-sm font-bold {page.url.pathname ===
									link.href
										? 'bg-line'
										: 'hover:bg-page'}"
									aria-current={page.url.pathname === link.href ? 'page' : undefined}
								>
									{link.label}
								</a>
							</li>
						{/each}
					</ul>
				</nav>

				<!-- Filters scroll; the notes link stays pinned at the bottom. -->
				<div class="min-h-0 flex-1 overflow-y-auto">
					<SidebarFilters options={data.filterOptions} />
				</div>

				<!-- Desktop: the cat sits on the divider line above the bottom section.
				     (On phones it's in the bottom-right corner instead; see below.) -->
				<img
					src={cat}
					alt="The underthink cat, thinking"
					width="491"
					height="407"
					class="pointer-events-none ml-3 hidden h-auto w-32 shrink-0 opacity-65 select-none md:block"
					draggable="false"
				/>

				<!-- Pinned to the bottom: the notes filter (when notes are on) and theme toggle. -->
				<div class="relative space-y-0.5 border-t border-line px-2 py-3">
					<img
						src={cat}
						alt=""
						width="491"
						height="407"
						class="pointer-events-none absolute right-4 bottom-0 m-0 h-auto w-20 opacity-65 select-none md:hidden"
						draggable="false"
					/>
					{#if data.notesEnabled}
						<a
							href={notesHref}
							class="flex items-center justify-between rounded-md px-2.5 py-1 text-sm font-bold {notesOn
								? 'bg-line'
								: 'hover:bg-page'}"
							aria-current={notesOn ? 'true' : undefined}
						>
							With notes
							<span class="text-xs font-semibold text-muted"
								>{data.notesCount.toLocaleString()}</span
							>
						</a>
					{/if}
					<!-- Theme switch. The highlight is chosen by CSS from <html data-theme>
					     (set before render), so it's right on first paint. -->
					<div class="flex gap-1 px-1 pt-1" role="group" aria-label="Colour theme">
						{#each THEMES as t (t)}
							<button
								type="button"
								class="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-page hover:text-ink {{
									dark: 'in-data-[theme=dark]:bg-line in-data-[theme=dark]:text-ink in-data-[theme=dark]:hover:bg-line',
									light:
										'in-data-[theme=light]:bg-line in-data-[theme=light]:text-ink in-data-[theme=light]:hover:bg-line',
									disc: 'in-data-[theme=disc]:bg-line in-data-[theme=disc]:text-ink in-data-[theme=disc]:hover:bg-line',
									hazel:
										'in-data-[theme=hazel]:bg-line in-data-[theme=hazel]:text-ink in-data-[theme=hazel]:hover:bg-line'
								}[t]}"
								aria-pressed={theme.current === t}
								aria-label="{t[0].toUpperCase() + t.slice(1)} theme"
								title="{t[0].toUpperCase() + t.slice(1)} theme"
								onclick={() => theme.set(t)}
							>
								<svg
									class="size-[1.125rem]"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									{#if t === 'dark'}
										<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
									{:else if t === 'light'}
										<circle cx="12" cy="12" r="4" />
										<path
											d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
										/>
									{:else if t === 'disc'}
										<!-- wind -->
										<path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
										<path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
										<path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
									{:else}
										<!-- rain -->
										<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.24" />
										<path d="M8 14v6M12 16v6M16 14v6" />
									{/if}
								</svg>
							</button>
						{/each}
					</div>

					<!-- [about] and [repo]: monospace, underlined words that go wavy and take
					     the theme's highlight colour on hover. -->
					<div class="flex gap-1 px-1 pt-1 font-mono text-xs">
						<a
							href="/about"
							onclick={closeOnPhone}
							class="group cursor-pointer text-muted transition-colors hover:text-logo"
							>[<span class="underline decoration-1 underline-offset-1 group-hover:decoration-wavy"
								>about</span
							>]</a
						>
						<a
							href="https://github.com/acornitum/underthinking"
							target="_blank"
							rel="noreferrer"
							class="group cursor-pointer text-muted transition-colors hover:text-logo"
							>[<span class="underline decoration-1 underline-offset-1 group-hover:decoration-wavy"
								>repo</span
							>]</a
						>
					</div>
				</div>
			</aside>
		{:else}
			<div class="fixed top-4 left-4 z-10 hidden text-subtle md:block">
				{@render toggle()}
			</div>
		{/if}

		<main
			class="mx-auto w-full min-w-0 px-6 {page.url.pathname === '/drills'
				? 'flex min-h-dvh flex-col pb-6'
				: 'max-w-[60rem] pb-10'} pt-24 {sidebarOpen ? 'md:pt-10' : 'md:pt-16'}"
		>
			<!-- Re-mount per URL path so per-page state (e.g. a notes editor) starts fresh. -->
			{#key page.url.pathname}
				{@render children()}
			{/key}
		</main>
	</div>
{/if}

<Toast />
