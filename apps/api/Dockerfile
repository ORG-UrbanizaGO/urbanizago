FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --no-audit --no-fund
FROM deps AS build
COPY apps/api/ apps/api/
COPY docs/api/openapi.yaml docs/api/openapi.yaml
RUN npm run build -w @urbanizago/api && chown -R node:node /app
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api ./apps/api
COPY --from=build --chown=node:node /app/docs/api ./docs/api
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate -w @urbanizago/api && npm run db:seed -w @urbanizago/api && exec node apps/api/dist/server.js"]
