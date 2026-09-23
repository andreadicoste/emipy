FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG DATABASE_URL=file:/app/data/emipy.db
ARG BETTER_AUTH_SECRET=build-only-secret-not-used-at-runtime
ARG BETTER_AUTH_URL=http://localhost:3000
ARG APP_ORIGIN=http://localhost:3000
ENV DATABASE_URL=$DATABASE_URL BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET BETTER_AUTH_URL=$BETTER_AUTH_URL APP_ORIGIN=$APP_ORIGIN
RUN bun run db:generate && bun run build

FROM oven/bun:1.4.2
WORKDIR /app
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/content ./content
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/.output ./.output
RUN mkdir -p /app/data && chown 1000:1000 /app/data
USER 1000:1000
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production DATABASE_URL=file:/app/data/emipy.db
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD bun /app/scripts/healthcheck.ts
CMD ["sh", "-c", "touch /app/data/emipy.db && bun run db:deploy && exec bun run start"]
