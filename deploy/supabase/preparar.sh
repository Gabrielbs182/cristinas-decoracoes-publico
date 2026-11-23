#!/usr/bin/env bash
# Baixa o Supabase oficial (self-hosting) numa versão fixa, gera os segredos e aplica os ajustes da Cristina's.
# Roda uma vez, na VPS:  APP_URL=https://sistema.exemplo.com.br deploy/supabase/preparar.sh
set -euo pipefail
cd "$(dirname "$0")"
# supabase/supabase em 24/10/2026: o compose dessa versão fixa as imagens (Postgres 17.6, GoTrue v2.197…).
VERSAO=7e866ef83e89e35cdda45a6c98abd069d5fa1b2f
if [ ! -d docker ]; then
  git clone --quiet --filter=blob:none --no-checkout https://github.com/supabase/supabase.git oficial
  git -C oficial sparse-checkout set docker
  git -C oficial checkout --quiet "$VERSAO"
  cp -r oficial/docker ./docker
  rm -rf oficial
fi
cp docker-compose.cristinas.yml docker/
if [ ! -f docker/.env ]; then
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/..:/w" -w /w/supabase -e APP_URL node:22-alpine node gerar-segredos.mjs
fi
echo "Pronto. Suba com: (cd deploy/supabase/docker && docker compose up -d)"
