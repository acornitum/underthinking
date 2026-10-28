// A Markdown editor that shows formatting as you write, like Obsidian's live
// preview. It edits the Markdown text itself, so nothing outside what you type
// is ever rewritten (the notes are plain files that Obsidian opens too).
// Formatting marks (`**`, `## `, `[](url)`, ...) are hidden except on the
// lines the cursor is on, so they can still be edited.
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import type { EditorState, Range } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
	keymap,
	placeholder
} from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { tags } from '@lezer/highlight';

// Marks hidden away from the cursor. Heading marks also take the space after them.
const HIDDEN = new Set([
	'HeaderMark',
	'EmphasisMark',
	'CodeMark',
	'StrikethroughMark',
	'LinkMark',
	'URL'
]);
// Inside a link, the URL is hidden; elsewhere (a bare autolink) it's the text.
const IN_LINK = new Set(['URL']);

class Bullet extends WidgetType {
	eq() {
		return true;
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-list-mark cm-bullet';
		span.textContent = '•';
		return span;
	}
}
const bullet = Decoration.replace({ widget: new Bullet() });
const hide = Decoration.replace({});

// List items are indented as a block: the marker (with its space) sits in a
// fixed-width slot, and wrapped lines line up with the text after it. Each
// level of nesting steps in further.
const LIST_STEP = 1.5; // em per nesting level
const MARK_WIDTH = { BulletList: 1.25, OrderedList: 1.75 }; // em
const LISTS = new Set(Object.keys(MARK_WIDTH));

function listDepth(node: SyntaxNode) {
	let depth = 0;
	for (let p = node.parent; p; p = p.parent) if (LISTS.has(p.name)) depth++;
	return depth;
}

// The line numbers the selection touches, where marks stay visible.
function activeLines(state: EditorState) {
	const lines = new Set<number>();
	for (const range of state.selection.ranges) {
		const first = state.doc.lineAt(range.from).number;
		const last = state.doc.lineAt(range.to).number;
		for (let n = first; n <= last; n++) lines.add(n);
	}
	return lines;
}

function decorate(view: EditorView): DecorationSet {
	const { state } = view;
	const active = activeLines(state);
	const decorations: Range<Decoration>[] = [];
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(state).iterate({
			from,
			to,
			enter: (node) => {
				const heading = /^ATXHeading(\d)$/.exec(node.name);
				if (heading) {
					const line = state.doc.lineAt(node.from);
					decorations.push(Decoration.line({ class: `cm-h${heading[1]}` }).range(line.from));
				}
				if (node.name === 'Blockquote') {
					for (let pos = node.from; pos <= node.to;) {
						const line = state.doc.lineAt(pos);
						decorations.push(Decoration.line({ class: 'cm-quote' }).range(line.from));
						pos = line.to + 1;
					}
				}
				if (node.name === 'ListItem') {
					const list = node.node.parent?.name as keyof typeof MARK_WIDTH;
					const pad = listDepth(node.node) * LIST_STEP + MARK_WIDTH[list];
					// Lines of nested lists are left to their own items.
					const nested = [
						...node.node.getChildren('BulletList'),
						...node.node.getChildren('OrderedList')
					];
					for (let pos = node.from; pos <= node.to;) {
						const line = state.doc.lineAt(pos);
						pos = line.to + 1;
						if (nested.some((n) => line.from >= n.from && line.from < n.to)) continue;
						const indent =
							line.from === state.doc.lineAt(node.from).from
								? `text-indent: -${MARK_WIDTH[list]}em;`
								: '';
						decorations.push(
							Decoration.line({ attributes: { style: `padding-left: ${pad}em; ${indent}` } }).range(
								line.from
							)
						);
					}
				}
				if (node.name === 'ListMark') {
					const line = state.doc.lineAt(node.from);
					// The source's own indentation is replaced by the padding above.
					if (node.from > line.from && !line.text.slice(0, node.from - line.from).trim()) {
						decorations.push(hide.range(line.from, node.from));
					}
					const end = state.doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to;
					const kind = node.node.parent?.parent?.name === 'BulletList' ? 'cm-bullet' : 'cm-number';
					if (kind === 'cm-bullet' && !active.has(line.number)) {
						decorations.push(bullet.range(node.from, end));
					} else {
						decorations.push(
							Decoration.mark({ class: `cm-list-mark ${kind}` }).range(node.from, end)
						);
					}
					return;
				}
				if (active.has(state.doc.lineAt(node.from).number)) return;

				if (node.name === 'QuoteMark') {
					const end = state.doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to;
					decorations.push(hide.range(node.from, end));
				} else if (HIDDEN.has(node.name)) {
					if (IN_LINK.has(node.name) && node.node.parent?.name !== 'Link') return;
					let end = node.to;
					if (node.name === 'HeaderMark' && state.doc.sliceString(end, end + 1) === ' ') end++;
					if (end > node.from) decorations.push(hide.range(node.from, end));
				}
			}
		});
	}
	return Decoration.set(decorations, true);
}

const livePreview = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = decorate(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = decorate(update.view);
			}
		}
	},
	{ decorations: (plugin) => plugin.decorations }
);

const highlight = HighlightStyle.define([
	{ tag: tags.heading, fontWeight: '700', color: 'var(--color-ink)' },
	{ tag: tags.strong, fontWeight: '700', color: 'var(--color-ink)' },
	{ tag: tags.emphasis, fontStyle: 'italic' },
	{ tag: tags.strikethrough, textDecoration: 'line-through' },
	{ tag: tags.link, color: 'var(--color-motion-hover)', textDecoration: 'underline' },
	{ tag: tags.url, color: 'var(--color-motion-hover)' },
	{ tag: tags.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.9em' },
	// The marks themselves, where they're shown (the lines being edited).
	{ tag: [tags.processingInstruction, tags.contentSeparator], color: 'var(--color-chip)' }
]);

const theme = EditorView.theme({
	'&': { color: 'var(--color-motion)' },
	'&.cm-focused': { outline: 'none' },
	'.cm-scroller': { fontFamily: 'inherit' },
	'.cm-content': {
		padding: '0',
		minHeight: '60vh',
		fontFamily: 'inherit',
		lineHeight: '1.625',
		caretColor: 'var(--color-ink)'
	},
	'.cm-line': { padding: '0' },
	'.cm-placeholder': { color: 'var(--color-chip)' },
	'.cm-h1': { fontSize: '1.6em', lineHeight: '1.4' },
	'.cm-h2': { fontSize: '1.35em', lineHeight: '1.4' },
	'.cm-h3': { fontSize: '1.15em' },
	'.cm-quote': { borderLeft: '4px solid var(--color-line)', paddingLeft: '1em' },
	// Whitespace inside the slot would wrap or collapse; keep it as typed.
	'.cm-list-mark': { display: 'inline-block', textIndent: '0', whiteSpace: 'pre' },
	'.cm-bullet': { width: `${MARK_WIDTH.BulletList}em`, color: 'var(--color-muted)' },
	'.cm-number': { width: `${MARK_WIDTH.OrderedList}em` }
});

/** Mounts the editor in `parent`; `onchange` gets the full text after each edit. */
export function createLivePreview(
	parent: HTMLElement,
	doc: string,
	onchange: (text: string) => void
) {
	return new EditorView({
		parent,
		doc,
		extensions: [
			history(),
			keymap.of([...defaultKeymap, ...historyKeymap]),
			markdown({ base: markdownLanguage }),
			syntaxHighlighting(highlight),
			livePreview,
			theme,
			EditorView.lineWrapping,
			placeholder('Write notes…'),
			EditorView.contentAttributes.of({
				spellcheck: 'true',
				'aria-label': 'Notes (rich formatting)'
			}),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) onchange(update.state.doc.toString());
			})
		]
	});
}
