# Browse-only build of the site: notes are turned off (NOTES_ENABLED=false).
# motions.db is built from data/motions.csv during the build (npm run build
# runs the motions build first), so a plain git checkout is enough.

# --- build ---
FROM node:24-slim AS build
WORKDIR /app
# Dependencies are locked with Bun; the build itself runs on Node because
# SvelteKit loads the server code (which uses node:sqlite) while building.
RUN npm install -g bun@1.1.30
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN npm run build

# --- run ---
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
	NOTES_ENABLED=false \
	PORT=3000
# adapter-node bundles every dependency into build/, so no node_modules needed.
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=build /app/motions.db ./
EXPOSE 3000
USER node
CMD ["node", "build"]
