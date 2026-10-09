<script lang="ts">
	import { Marked } from 'marked';
	// about.md lives at the project root, so it's easy to find and edit.
	import about from '../../../about.md?raw';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// "October 9, 2026"
	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC' // same on server and browser
		});

	// Links in about.md open in a new tab. (A separate Marked instance, so the
	// notes preview's links aren't affected.)
	const markdown = new Marked({
		renderer: {
			link({ href, title, tokens }) {
				const text = this.parser.parseInline(tokens);
				const titleAttr = title ? ` title="${title}"` : '';
				return `<a href="${href}"${titleAttr} target="_blank" rel="noreferrer">${text}</a>`;
			}
		}
	});

	const html = markdown.parse(about, { async: false });
</script>

<svelte:head>
	<title>About</title>
</svelte:head>

<article
	class="prose prose-sm max-w-none md:pt-10 dark:prose-invert prose-headings:text-ink prose-h1:mb-9 prose-h1:border-b prose-h1:border-line prose-h1:pb-3 prose-p:my-4 prose-p:leading-normal prose-p:text-motion prose-a:text-logo prose-strong:text-ink prose-code:text-subtle prose-code:before:content-none prose-code:after:content-none prose-ol:my-2 prose-ul:my-2 prose-li:my-0 prose-li:leading-normal prose-li:text-motion"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- your own about.md -->
	{@html html}
</article>

{#if data.commit}
	<p class="mt-10 font-mono text-sm text-muted">
		latest commit
		<a
			href={data.commit.url}
			target="_blank"
			rel="noreferrer"
			class="underline decoration-1 underline-offset-1 transition-colors hover:text-logo hover:decoration-wavy"
			>{data.commit.sha.slice(0, 7)}</a
		>
		on {formatDate(data.commit.date)}
	</p>
	<p class="font-mono text-sm text-muted">

		made by 
		<a 
			href="https://acon.zip"
			target="_blank"
			rel="noreferrer"
			class="underline decoration-1 underline-offset-1 transition-colors hover:text-logo hover:decoration-wavy"
		>acon</a>

		:3


	</p>
{/if}
