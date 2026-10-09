# underthink - debate motions site

Site for browsing debate motions. 

Also included:
- Filter for majors, motion genres, etc
- Random motion generator (choose 1 or 20 or infinite scroll!)
- Drills - get a random motion + side, and watch a countdown timer too
- Many different color themes you can choose from

If you clone the site + run it locally, you also get access to a feature where you can take notes on each motion, on the site, and it'll be saved in markdown (viewable in Obsidian). 

Made with SvelteKit and too much claude. 

## Setup

(Instructions will probably be updated sometime!)

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