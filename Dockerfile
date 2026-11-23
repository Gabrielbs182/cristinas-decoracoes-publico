# Imagem de produção do app (Next em modo standalone), montada pela CI e baixada pela VPS (deploy/README.md).
# Sem segredo nem endereço dentro: o Supabase (NEXT_PUBLIC_SUPABASE_*), a chave secreta e o APP_URL entram quando o
# container sobe (lib/config.ts lê na hora). A mesma imagem serve para o teste e para a produção.
FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: os pós-instalação das ferramentas de desenvolvimento (CLI do Supabase, navegadores) não servem aqui.
RUN npm ci --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
RUN node node_modules/next/dist/bin/next build

FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=America/Sao_Paulo
RUN apk add --no-cache tzdata && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/saude > /dev/null || exit 1
CMD ["node", "server.js"]
