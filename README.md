# underthink — debate motions site

A site for browsing debate motions. Also included are filters, random motion picker, and a page with a timer you could drill with. 

If you clone the site + run it locally, you also get access to a feature where you can take notes on each motion, on the site, and it'll be saved in markdown (viewable in Obsidian). 

Made with SvelteKit. 

## Setup

Requires **Node 22.13+** (the site and scripts use Node's built-in SQLite).

```sh
bun install    # or npm install
npm run dev
```

The first `npm run dev` builds `motions.db` from `data/motions.csv`, which takes
a few seconds. After that it's only rebuilt when the CSV changes.

## Motions data

- `data/motions.csv` is the source of truth and is committed to git. Rows are
  ordered **newest first**: that order is what "latest" means on the site.
- `motions.db` is built from it and gitignored.

`npm run motions:build` rebuilds the database from the CSV by hand.

## Notes

Notes are Markdown files in `notes/` (open the folder as an Obsidian vault).

## Other things

The database of motions is originally taken from debatedata. 