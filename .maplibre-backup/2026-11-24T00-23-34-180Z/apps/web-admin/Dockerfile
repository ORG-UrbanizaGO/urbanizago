FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/web-admin/package.json apps/web-admin/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/icons/package.json packages/icons/package.json
COPY packages/ui-tokens/package.json packages/ui-tokens/package.json
COPY packages/app-ui/package.json packages/app-ui/package.json
RUN npm install --no-audit --no-fund && chown -R node:node /app
FROM deps AS build
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
COPY apps/web-admin/ apps/web-admin/
COPY packages/ packages/
RUN npm run build -w @urbanizago/web-admin
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web-admin/dist/ /usr/share/nginx/html/
USER 101
EXPOSE 8080
