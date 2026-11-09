FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
FROM node:24-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 lvt && useradd --system --uid 1001 --gid lvt lvt
COPY --from=build --chown=lvt:lvt /app/.next/standalone ./
COPY --from=build --chown=lvt:lvt /app/.next/static ./.next/static
COPY --from=build --chown=lvt:lvt /app/public ./public
COPY --from=build --chown=lvt:lvt /app/db ./db
COPY --from=build --chown=lvt:lvt /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build --chown=lvt:lvt /app/scripts/docker-start.mjs ./scripts/docker-start.mjs
USER lvt
EXPOSE 3000
CMD ["node","scripts/docker-start.mjs"]
