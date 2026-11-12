# syntax=docker/dockerfile:1

# One image serves both the web app and the worker: they share the same
# dependencies and the same source, and differ only in the command run
# (see compose.yaml). Two images would double build time to ship one
# `tsx` invocation.

FROM node:24-alpine AS base
WORKDIR /app
# `postgres` is pure JS, so no build toolchain is needed here.
ENV NEXT_TELEMETRY_DISABLED=1


# ── deps ─────────────────────────────────────────────────────────────
# Full install, cached on the manifests alone.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci


# ── build ────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `next build` prerenders the static routes, and the dynamic ones are only
# compiled — no page is rendered at build time, so no database is contacted.
# A placeholder is enough to satisfy a module that reads DATABASE_URL at
# import; the real value arrives at run time.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV BETTER_AUTH_URL=http://localhost:3000

RUN npm run build


# ── runner ───────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# `output: 'standalone'` (below) gives a server that carries only the modules
# it traced, so the full node_modules never ships.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Migrations and the worker's TypeScript source are not part of the traced
# standalone bundle, so both are copied deliberately.
#   - drizzle/          : `npm run db:migrate` in the one-shot migrate service
#   - src/, tsconfig*   : the worker runs from source via tsx
#   - node_modules/     : tsx and drizzle-kit live in devDependencies, which a
#                         production install omits; copied from the full tree.
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build --chown=nextjs:nodejs /app/src ./src
COPY --from=build --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=nextjs:nodejs /app/tsconfig.worker.json ./tsconfig.worker.json
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json

# Attachments are written to disk (see api/attachments/route.ts), so the
# directory must exist and be writable by the unprivileged user. compose.yaml
# mounts a volume here; without it the files die with the container.
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads
VOLUME /app/uploads

USER nextjs
EXPOSE 3000

# Liveness only: no `?ready=1`, so a database blip never gets a healthy
# container restarted. `wget` ships with Alpine's busybox.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
